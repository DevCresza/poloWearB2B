-- Admin e fornecedor discordavam do mes de faturamento em 1.301 pedidos.
--
-- Havia DUAS regras rodando ao mesmo tempo:
--
--   forte  por item: item.mes_entrega > produto.data_prevista_entrega >
--          pedido.data_prevista_entrega > pedido.created_date.
--          Usada em PedidosFornecedor e MeusPedidos (telas que carregam itens).
--
--   fraca  coluna meses_entrega (= so o item.mes_entrega gravado) e, quando
--          vazia, a data do PEDIDO -- pulando a data do produto.
--          Usada em PedidosAdmin e DashboardAdmin (telas que carregam o resumo).
--
-- A fraca existia so porque o resumo nao traz o itens. O preco disso: 650
-- pedidos vivos, R$ 5.493.887,49, caiam em meses diferentes conforme a tela
-- que se olhasse. O fornecedor fechava setembro e o dashboard mostrava agosto.
--
-- A regra forte e a correta -- usa a informacao mais especifica disponivel --
-- e foi a escolhida. Para as duas telas poderem usa-la sem carregar o itens,
-- o resultado dela passa a ser materializado em meses_entrega_efetivos.
--
-- Por que uma coluna nova e nao consertar meses_entrega: meses_entrega
-- significa "os meses que os ITENS trazem escritos", e e isso que
-- formatMesesEntrega mostra na tela do pedido. A coluna nova significa outra
-- coisa -- "o mes que cada item efetivamente cai depois de resolver os
-- fallbacks" -- e sobrescrever a primeira com a segunda mudaria aquela tela de
-- lado.
--
-- A NF continua resolvida na LEITURA, nao aqui: nf_data_upload vence tudo, e
-- gravar isso na coluna obrigaria a recalcular o pedido a cada anexo de nota
-- para um valor que o front ja tem em maos de graca.

-- ---------------------------------------------------------------- calculo --
-- Uma funcao so, usada pelo trigger de pedidos, pelo de produtos e pelo
-- backfill. Duas copias desta regra foi exatamente o que criou o problema.
create or replace function public.calc_meses_entrega_efetivos(
  p_itens          jsonb,
  p_data_prevista  date,
  p_created        timestamp
)
returns text[]
language sql
stable
set search_path to 'public'
as $$
  select coalesce(array_agg(distinct m order by m), '{}')
    from (
      select coalesce(
               -- 1) mes escolhido na compra, quando o item traz
               nullif(left(e->>'mes_entrega', 7), ''),
               -- 2) previsao cadastrada no PRODUTO (o passo que a regra fraca pulava)
               to_char(pr.data_prevista_entrega, 'YYYY-MM'),
               -- 3) previsao do pedido, 4) data do pedido
               to_char(coalesce(p_data_prevista, p_created::date), 'YYYY-MM')
             ) as m
        from jsonb_array_elements(
               case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end
             ) e
        -- O cast tem que ser no VALOR, nao em produtos.id: com pr.id::text o
        -- planner abandona a primary key e varre produtos inteiro uma vez por
        -- pedido (2,9 s nos 6.813; com o cast deste lado, 772 ms).
        left join public.produtos pr
          on pr.id = case
                       when (e->>'produto_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                       then (e->>'produto_id')::uuid
                     end
    ) x
   where m is not null;
$$;

comment on function public.calc_meses_entrega_efetivos(jsonb, date, timestamp) is
  'Meses YYYY-MM em que os itens do pedido caem, resolvendo item > produto > pedido. Fonte unica da regra forte.';

alter table public.pedidos
  add column if not exists meses_entrega_efetivos text[] not null default '{}';

comment on column public.pedidos.meses_entrega_efetivos is
  'Meses de entrega ja resolvidos (item > produto > pedido). A NF, quando existe, vence na leitura. Mantido por trigger.';

-- --------------------------------------------------- trigger nos pedidos --
-- Mesma funcao de antes, agora gravando tambem a coluna nova.
create or replace function public.pedidos_calc_resumo()
returns trigger
language plpgsql
as $function$
declare
  v_pecas integer := 0;
  v_meses text[] := '{}';
begin
  if new.itens is not null and jsonb_typeof(new.itens) = 'array' then
    select coalesce(sum(
             (coalesce((e->>'quantidade')::numeric, 0))
             * case when (e->>'tipo_venda') = 'grade'
                         and coalesce((e->>'total_pecas_grade')::numeric,0) > 0
                    then (e->>'total_pecas_grade')::numeric else 1 end
           ), 0)::integer,
           coalesce(array_agg(distinct (e->>'mes_entrega'))
                    filter (where (e->>'mes_entrega') is not null), '{}')
      into v_pecas, v_meses
    from jsonb_array_elements(new.itens) e;
  end if;
  new.qtd_pecas := v_pecas;
  new.meses_entrega := v_meses;
  new.meses_entrega_efetivos := public.calc_meses_entrega_efetivos(
    new.itens, new.data_prevista_entrega, new.created_date);
  return new;
end;
$function$;

-- -------------------------------------------- propagacao a partir do produto --
-- A regra forte le a data do produto, e o JS a lia AO VIVO: mudar a previsao
-- do produto movia os pedidos de mes na hora. Materializar sem isto congelaria
-- o valor e reintroduziria divergencia -- agora entre o banco e a realidade.
--
-- So pedidos sem NF entram: com nota emitida a leitura ignora esta coluna.
create or replace function public.produtos_propagar_meses_pedidos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.data_prevista_entrega is not distinct from old.data_prevista_entrega then
    return new;
  end if;

  update public.pedidos p
     set meses_entrega_efetivos = public.calc_meses_entrega_efetivos(
           p.itens, p.data_prevista_entrega, p.created_date)
   where p.nf_data_upload is null
     and p.itens @> jsonb_build_array(jsonb_build_object('produto_id', new.id::text));

  return new;
end;
$$;

drop trigger if exists trg_produtos_propagar_meses on public.produtos;
create trigger trg_produtos_propagar_meses
  after update of data_prevista_entrega on public.produtos
  for each row execute function public.produtos_propagar_meses_pedidos();

-- Sem este indice o UPDATE acima varre os 6.813 pedidos a cada data de
-- produto alterada. jsonb_path_ops serve o operador @> e e menor que o padrao.
create index if not exists idx_pedidos_itens_gin
  on public.pedidos using gin (itens jsonb_path_ops);

-- -------------------------------------------- historico nao audita derivada --
-- qtd_pecas, meses_entrega e meses_entrega_efetivos sao CALCULADAS por
-- trigger: ninguem as "altera". Sem ignora-las, o backfill desta migration
-- escreveria 6.813 linhas de auditoria sem autor, e dai em diante toda
-- mudanca de data em um produto registraria "alterou 1 campo" nos pedidos
-- que o contem -- enterrando as alteracoes de verdade.
--
-- Quando a derivada e a UNICA mudanca, a funcao sai sem gravar nada
-- (cardinality(v_campos) = 0), que e o comportamento desejado: a causa real
-- (itens, ou a data do produto) ja esta registrada onde aconteceu.
create or replace function public.pedidos_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  c_ignorados constant text[] := array['updated_at', 'qtd_pecas',
                                       'meses_entrega', 'meses_entrega_efetivos'];
  c_volumosos constant text[] := array['itens', 'endereco_entrega', 'parcelas_info'];
begin
  if tg_op = 'INSERT' then
    v_acao       := 'criado';
    v_pedido_id  := new.id;
    v_status_ate := new.status;

  elsif tg_op = 'DELETE' then
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
    coalesce(nullif(public.app_role(), ''),
             case when coalesce(auth.role(), '') = 'service_role' then 'service_role' end),
    v_status_de,
    v_status_ate,
    v_campos,
    v_mudancas
  );

  return null;
end;
$function$;

-- ------------------------------------------------------------- backfill --
update public.pedidos p
   set meses_entrega_efetivos = public.calc_meses_entrega_efetivos(
         p.itens, p.data_prevista_entrega, p.created_date);

-- ------------------------------------------------------- resumo exposto --
-- A view precisa entregar a coluna nova, senao as telas que usam o resumo
-- continuam presas a regra fraca.
create or replace view public.pedidos_resumo as
 SELECT id, comprador_user_id, fornecedor_id, status, status_pagamento,
    valor_total, desconto, valor_frete, valor_final, endereco_entrega,
    data_prevista_entrega, data_entrega_real, transportadora, codigo_rastreio,
    nota_fiscal, observacoes, observacoes_internas, created_date, updated_at,
    franqueado_id, mes_referencia, metodo_pagamento, metodo_pagamento_original,
    data_pagamento, data_aprovacao, data_envio_real, nf_url, nf_numero,
    nf_data_upload, boleto_url, boleto_data_upload, cliente_confirmou_boleto,
    cliente_confirmou_nf, cliente_confirmou_recebimento, observacoes_comprador,
    observacoes_fornecedor, urgente, motivo_recusa, comprovante_pagamento_url,
    comprovante_pagamento_data, qtd_parcelas, parcelas_info, link_rastreio,
    valor_frete_fob, data_confirmacao_nf, data_confirmacao_boleto,
    data_confirmacao_recebimento, loja_id, tipo_frete, frete_incluso_boleto,
    frete_modo_cobranca, impresso, data_impressao, valor_faturado, valor_quebra,
    observacao_recebimento, estoque_baixado, pix_info, itens_revisados_em,
    cartao_link_pagamento, emitido_por_admin_user_id, criado_por_user_id,
    criado_por_papel, qtd_pecas, meses_entrega,
    meses_entrega_efetivos
   FROM pedidos p;
