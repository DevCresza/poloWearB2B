-- Produto apagado não muda mais o mês de entrega, e produto/cápsula que já
-- aparece em pedido não pode ser excluído (só arquivado).
--
-- Achado de 24/11 (PR #31): o produto 1aa81619 foi apagado pelo portal (24/11,
-- 11h43) e 22 pedidos ficaram com meses_entrega_efetivos diferente da regra:
-- o item cujo produto não existe mais ("órfão") caía na data prevista do
-- PEDIDO, e o próximo recálculo trocaria o mês. Em 24/11 eram 334 pedidos com
-- item órfão sem mes_entrega (23 produtos apagados).
--
-- 1) Mês do item órfão congelado: interno.pedidos_mes_produto_apagado guarda,
--    por (pedido, produto apagado), o mês que o item já tinha no pedido:
--      * produto 1aa81619 -> 2026-07 (o mês da data prevista dele; é o mês que
--        sobra nos 22 pedidos divergentes);
--      * os outros 22 produtos (apagados antes) -> o mês que a regra já dava,
--        a data prevista do pedido (ou o mês de criação), igual ao gravado.
--    calc_meses_entrega_efetivos ganha a versão com o id do pedido, que usa
--    esse mês para o item órfão. Resultado: igual ao gravado nos 7.6 mil
--    pedidos, inclusive os 22 (nenhum pedido é recalculado aqui). A versão de
--    3 argumentos continua existindo, com a regra antiga (sem o pedido).
--    pedidos_calc_resumo e produtos_propagar_meses_pedidos passam o id.
-- 2) BEFORE DELETE em produtos e capsulas: recusa a exclusão quando o produto
--    (itens[].produto_id) ou a cápsula (itens[].origem_capsula) aparece em
--    algum pedido. Daqui para frente não surge item órfão novo.
-- 3) produtos_com_pedidos(uuid[]) e capsulas_com_pedidos(uuid[]): dizem à tela
--    de gestão quais ids têm pedido, para trocar "Excluir" por "Arquivar"
--    (cadastro não lê pedidos pela RLS). Só para quem gere o catálogo.
--
-- Rollback: supabase/rollbacks/20261125000500_produto_apagado_rollback.sql

set local lock_timeout = '3s';

-- 1) Mês do item órfão -----------------------------------------------------

create table if not exists interno.pedidos_mes_produto_apagado (
  pedido_id  uuid not null,
  produto_id uuid not null,
  mes        text not null check (mes ~ '^\d{4}-\d{2}$'),
  criado_em  timestamptz not null default now(),
  primary key (pedido_id, produto_id)
);
alter table interno.pedidos_mes_produto_apagado enable row level security;
revoke all on interno.pedidos_mes_produto_apagado from public, anon, authenticated;

insert into interno.pedidos_mes_produto_apagado (pedido_id, produto_id, mes)
select distinct p.id, (e->>'produto_id')::uuid,
       case when e->>'produto_id' = '1aa81619-e131-485f-9b5c-a9d30825f8be'
            then '2026-07'
            else to_char(coalesce(p.data_prevista_entrega, public.data_br(p.created_date)), 'YYYY-MM')
       end
  from public.pedidos p
 cross join lateral jsonb_array_elements(
         case when jsonb_typeof(p.itens) = 'array' then p.itens else '[]'::jsonb end) e
 where (e->>'produto_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   and nullif(left(e->>'mes_entrega', 7), '') is null
   and not exists (select 1 from public.produtos pr where pr.id = (e->>'produto_id')::uuid)
on conflict do nothing;

create or replace function public.calc_meses_entrega_efetivos(
  p_itens jsonb, p_data_prevista date, p_created timestamp, p_pedido_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct m order by m), '{}')
    from (
      select coalesce(
               nullif(left(e->>'mes_entrega', 7), ''),
               to_char(pr.data_prevista_entrega, 'YYYY-MM'),
               case when pr.id is null then ap.mes end,
               to_char(coalesce(p_data_prevista, public.data_br(p_created)), 'YYYY-MM')
             ) as m
        from jsonb_array_elements(
               case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end
             ) e
        left join public.produtos pr
          on pr.id = case
                       when (e->>'produto_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                       then (e->>'produto_id')::uuid
                     end
        left join interno.pedidos_mes_produto_apagado ap
          on ap.pedido_id = p_pedido_id
         and ap.produto_id = case
                               when (e->>'produto_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                               then (e->>'produto_id')::uuid
                             end
    ) x
   where m is not null;
$$;

revoke execute on function public.calc_meses_entrega_efetivos(jsonb, date, timestamp, uuid) from public, anon;
grant execute on function public.calc_meses_entrega_efetivos(jsonb, date, timestamp, uuid) to authenticated, service_role;

create or replace function public.pedidos_calc_resumo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pecas integer := 0;
  v_meses text[] := '{}';
begin
  if new.itens is not null and jsonb_typeof(new.itens) = 'array' then
    select coalesce(sum(public.pecas_item(e)), 0)::integer,
           coalesce(array_agg(distinct (e->>'mes_entrega'))
                    filter (where (e->>'mes_entrega') is not null), '{}')
      into v_pecas, v_meses
    from jsonb_array_elements(new.itens) e;
  end if;
  new.qtd_pecas := v_pecas;
  new.meses_entrega := v_meses;
  new.meses_entrega_efetivos := public.calc_meses_entrega_efetivos(
    new.itens, new.data_prevista_entrega, new.created_date, new.id);
  return new;
end;
$$;

create or replace function public.produtos_propagar_meses_pedidos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.data_prevista_entrega is not distinct from old.data_prevista_entrega then
    return new;
  end if;
  update public.pedidos p
     set meses_entrega_efetivos = public.calc_meses_entrega_efetivos(
           p.itens, p.data_prevista_entrega, p.created_date, p.id)
   where p.nf_data_upload is null
     and p.itens @> jsonb_build_array(jsonb_build_object('produto_id', new.id::text));
  return new;
end;
$$;

-- 2) Exclusão bloqueada ---------------------------------------------------

create or replace function public.produtos_bloqueia_excluir_com_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n
    from public.pedidos p
   where p.itens @> jsonb_build_array(jsonb_build_object('produto_id', old.id::text));
  if n > 0 then
    raise exception 'O produto "%" aparece em % pedido(s) e não pode ser excluído. Arquive o produto em vez de excluir.',
      coalesce(old.nome, old.id::text), n
      using errcode = 'P0001', hint = 'Use "Arquivar": o produto sai do catálogo e continua nos pedidos.';
  end if;
  return old;
end;
$$;

create or replace function public.capsulas_bloqueia_excluir_com_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n
    from public.pedidos p
   where p.itens @> jsonb_build_array(jsonb_build_object('origem_capsula', old.id::text));
  if n > 0 then
    raise exception 'A cápsula "%" aparece em % pedido(s) e não pode ser excluída. Arquive a cápsula em vez de excluir.',
      coalesce(old.nome, old.id::text), n
      using errcode = 'P0001', hint = 'Use "Arquivar": a cápsula sai do catálogo e continua nos pedidos.';
  end if;
  return old;
end;
$$;

revoke execute on function public.produtos_bloqueia_excluir_com_pedido() from public, anon, authenticated;
revoke execute on function public.capsulas_bloqueia_excluir_com_pedido() from public, anon, authenticated;

create or replace trigger trg_produtos_bloqueia_excluir_com_pedido
  before delete on public.produtos
  for each row execute function public.produtos_bloqueia_excluir_com_pedido();

create or replace trigger trg_capsulas_bloqueia_excluir_com_pedido
  before delete on public.capsulas
  for each row execute function public.capsulas_bloqueia_excluir_com_pedido();

-- 3) Consulta para a tela ---------------------------------------------------

create or replace function public.produtos_com_pedidos(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select i
    from unnest(p_ids) as i
   where public.pode_gerir_catalogo()
     and exists (select 1 from public.pedidos p
                  where p.itens @> jsonb_build_array(jsonb_build_object('produto_id', i::text)));
$$;

create or replace function public.capsulas_com_pedidos(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select i
    from unnest(p_ids) as i
   where public.pode_gerir_catalogo()
     and exists (select 1 from public.pedidos p
                  where p.itens @> jsonb_build_array(jsonb_build_object('origem_capsula', i::text)));
$$;

revoke execute on function public.produtos_com_pedidos(uuid[]) from public, anon;
revoke execute on function public.capsulas_com_pedidos(uuid[]) from public, anon;
grant execute on function public.produtos_com_pedidos(uuid[]) to authenticated;
grant execute on function public.capsulas_com_pedidos(uuid[]) to authenticated;

-- Conferência: com o mês congelado, a regra bate com o gravado em todos os
-- pedidos (inclusive os 22).
do $$
declare n int;
begin
  select count(*) into n from public.pedidos p
   where p.meses_entrega_efetivos is distinct from
         public.calc_meses_entrega_efetivos(p.itens, p.data_prevista_entrega, p.created_date, p.id);
  if n <> 0 then
    raise exception 'Regra nova difere do gravado em % pedido(s)', n;
  end if;
end $$;
