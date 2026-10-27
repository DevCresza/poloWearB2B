-- Quem mexeu no pedido: trilha de auditoria.
--
-- O Bruno perguntou quem cancelou 9 pedidos e a resposta foi "nao da para
-- saber". `pedidos` guarda o estado ATUAL e um updated_at; quem mudou, o que
-- havia antes e quando, nada disso existia. O log de autenticacao do Supabase
-- nao supre: ele registra login e renovacao de token, nao acoes, e em qualquer
-- janela de 20 minutos ha dezenas de sessoes abertas.
--
-- Esta tabela e so-escrita-pelo-sistema: nao existe policy de INSERT, UPDATE
-- nem DELETE, entao nem admin altera uma linha pelo PostgREST. Quem escreve e
-- o trigger, que roda security definer e por isso passa pela RLS. Auditoria que
-- o auditado consegue editar nao serve para nada.
--
-- pedido_id NAO tem foreign key de proposito. is_admin() pode apagar pedido
-- (policy pedidos_delete), e e exatamente ai que a trilha importa mais -- com
-- ON DELETE CASCADE ela sumiria junto com a evidencia.

create table if not exists public.pedido_historico (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid        not null,
  -- clock_timestamp(), nao now(): now() e o horario de INICIO da transacao,
  -- entao duas mudancas na mesma transacao (ex.: um update que dispara cascata)
  -- nasceriam com o mesmo instante e a ordem da trilha se perderia.
  quando        timestamptz not null default clock_timestamp(),
  acao          text        not null,  -- criado | status | alterado | apagado
  autor_user_id uuid,
  autor_email   text,                  -- desnormalizado: sobrevive ao usuario
  autor_papel   text,
  status_de     text,
  status_para   text,
  campos        text[]      not null default '{}',
  mudancas      jsonb       not null default '{}'::jsonb
);

comment on table public.pedido_historico is
  'Trilha de auditoria de pedidos. Escrita so pelo trigger trg_pedidos_historico; sem policy de escrita, nem para admin.';
comment on column public.pedido_historico.campos is
  'Todas as colunas que mudaram, inclusive as volumosas.';
comment on column public.pedido_historico.mudancas is
  'de/para por coluna. Exclui itens, endereco_entrega e parcelas_info: o nome fica em campos, o conteudo nao.';

create index if not exists idx_pedido_historico_pedido
  on public.pedido_historico (pedido_id, quando desc);

-- "Quem cancelou?" e a pergunta que originou a tabela; indice parcial para ela.
create index if not exists idx_pedido_historico_cancelamentos
  on public.pedido_historico (quando desc)
  where status_para = 'cancelado';

create index if not exists idx_pedido_historico_autor
  on public.pedido_historico (autor_user_id, quando desc);

-- O diff e calculado comparando to_jsonb(old) com to_jsonb(new), entao colunas
-- novas no futuro entram sozinhas, sem precisar mexer aqui.
create or replace function public.pedidos_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old        jsonb;
  v_new        jsonb;
  v_campos     text[] := '{}';
  v_mudancas   jsonb  := '{}'::jsonb;
  v_uid        uuid   := auth.uid();
  v_acao       text;
  v_pedido_id  uuid;
  v_status_de  text;
  v_status_ate text;
  -- updated_at muda em toda escrita: registrar seria so ruido.
  c_ignorados constant text[] := array['updated_at'];
  -- Colunas grandes: o nome entra em `campos`, o conteudo nao entra em
  -- `mudancas`. Um itens[] inteiro por linha encheria a tabela a toa.
  c_volumosos constant text[] := array['itens', 'endereco_entrega', 'parcelas_info'];
begin
  if tg_op = 'INSERT' then
    v_acao       := 'criado';
    v_pedido_id  := new.id;
    v_status_ate := new.status;

  elsif tg_op = 'DELETE' then
    -- NEW e nulo num trigger de DELETE: nao referencie new aqui.
    v_acao      := 'apagado';
    v_pedido_id := old.id;
    v_status_de := old.status;

  else
    v_old        := to_jsonb(old);
    v_new        := to_jsonb(new);
    v_pedido_id  := new.id;
    v_status_de  := old.status;
    v_status_ate := new.status;

    select coalesce(array_agg(k order by k), '{}')
      into v_campos
      from jsonb_object_keys(v_new) as k
     where not (k = any(c_ignorados))
       and (v_new -> k) is distinct from (v_old -> k);

    -- Escrita que nao mudou nada (ou so o updated_at) nao vira linha.
    if cardinality(v_campos) = 0 then
      return null;
    end if;

    select coalesce(
             jsonb_object_agg(k, jsonb_build_object('de', v_old -> k, 'para', v_new -> k)),
             '{}'::jsonb)
      into v_mudancas
      from unnest(v_campos) as k
     where not (k = any(c_volumosos));

    v_acao := case when new.status is distinct from old.status then 'status' else 'alterado' end;
  end if;

  insert into public.pedido_historico
    (pedido_id, acao, autor_user_id, autor_email, autor_papel,
     status_de, status_para, campos, mudancas)
  values (
    v_pedido_id,
    v_acao,
    v_uid,
    (select u.email from public.users u where u.id = v_uid),
    -- Sem sessao de aplicacao (job, Edge Function, SQL direto) app_role() e
    -- nulo; marcar a origem evita confundir isso com "autor desconhecido".
    coalesce(nullif(public.app_role(), ''),
             case when coalesce(auth.role(), '') = 'service_role' then 'service_role' end),
    v_status_de,
    v_status_ate,
    v_campos,
    v_mudancas
  );

  return null;
end;
$$;

drop trigger if exists trg_pedidos_historico on public.pedidos;
create trigger trg_pedidos_historico
  after insert or update or delete on public.pedidos
  for each row execute function public.pedidos_registrar_historico();

-- Le quem ja pode ler o pedido: equipe ve tudo, cliente ve o proprio, fornecedor
-- ve os dele. Nao ha policy de escrita em lugar nenhum -- e proposital.
alter table public.pedido_historico enable row level security;

drop policy if exists pedido_historico_select on public.pedido_historico;
create policy pedido_historico_select on public.pedido_historico
for select to authenticated
using (
  public.ve_todos_pedidos()
  or exists (
    select 1
      from public.pedidos p
     where p.id = pedido_historico.pedido_id
       and (p.comprador_user_id = auth.uid()
            or (public.app_role() = 'fornecedor' and p.fornecedor_id = public.meu_fornecedor_id()))
  )
);

revoke all on public.pedido_historico from anon, authenticated;
grant select on public.pedido_historico to authenticated;
