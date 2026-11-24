-- Conciliação de 24/11/2026 (T7 / A7): faturamento retroativo dos pedidos
-- "faturados" sem registro em faturamentos. Aprovado pelo dono.
--
-- Até a T7, o botão "Enviar NF" do detalhe do pedido levava o pedido de
-- em_producao para faturado gravando só a NF no pedido: sem faturamento, sem
-- baixa de item e sem valor_faturado. Em 24/11 eram 394 pedidos (faturado, em
-- transporte, pendente de pagamento ou finalizado) nessa situação:
--   * 324 com NF no pedido (nf_numero + nf_url) -> registrar o faturamento;
--   * 70 sem NF nenhuma                         -> só marcar.
--
-- Ficam DE FORA, para o dono decidir um a um (22 pedidos):
--   * 782C0265       NF datada de 27/07/2027;
--   * 45A85186 e 156CD85C  mesma NF 5810 do mesmo fornecedor;
--   * 19 sem título nenhum na carteira (17 com NF, 2 sem NF).
-- Resultado esperado: 304 faturamentos retroativos e 68 pedidos marcados.
--
-- Para cada um dos 304:
--   * 1 linha em faturamentos com a NF do pedido (número, data, arquivo), valor
--     = valor_final, itens = o saldo de cada item ao preço do pedido, e
--     observacoes = 'retroativo T7 24/11/2026';
--   * itens do pedido marcados como faturados (qtd_faturada = quantidade -
--     quebra, status_item, mes_faturamento = mês da NF), valor_faturado =
--     valor_final e meses_faturamento recalculado.
-- Para cada um dos 68: valor_faturado = valor_final e uma linha em
-- pedido_historico ("Sistema") com a marcação.
--
-- NÃO cria nem mexe em títulos (a cobrança já existe, por pedido, sem
-- faturamento_id: criar títulos cobraria em dobro) e NÃO muda status.
-- Os triggers de usuário de pedidos ficam desligados DENTRO da transação: o
-- webhook notify-pedido (e-mails) não dispara, o histórico automático não
-- grava 372 linhas e updated_at não muda.
--
-- Backup: backups._t7_retro_20261124_pedidos (as linhas inteiras dos 372
-- pedidos antes da mudança, com a coluna acao_t7 = 'faturar' | 'marcar').
-- Rollback: supabase/conciliacao/20261124_t7_faturamento_retroativo_rollback.sql

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Divergências da conferência de cobrança antes (para provar que não cresce).
create temp table t7_conf_antes as
select count(*) filter (where situacao is not null) as n from public.vw_conferencia_cobranca;

-- 1) Quem entra, congelado no backup.
create table backups._t7_retro_20261124_pedidos as
select p.*,
       case when p.nf_numero is not null and btrim(p.nf_numero) <> ''
             and p.nf_url is not null and btrim(p.nf_url) <> ''
            then 'faturar' else 'marcar' end as acao_t7
  from public.pedidos p
 where p.status in ('faturado', 'em_transporte', 'finalizado', 'pendente_pagamento')
   and not exists (select 1 from public.faturamentos f where f.pedido_id = p.id)
   and upper(right(p.id::text, 8)) not in (
         -- NF datada de 2027-07
         '782C0265',
         -- mesma NF (5810) em dois pedidos do mesmo fornecedor
         '45A85186', '156CD85C',
         -- sem título nenhum na carteira
         '337BC7E5', '133D6DBA', '489F2389', '559CA9F0', '1231209C', 'C1CE931C',
         '8EF9205B', '26D95071', '2E6D49DF', '04132114', '336091EE', '248AC99E',
         'ADB5B055', 'EC196F3E', '88381A89', '808D8BB2', 'BA88D7F1', '815B608B',
         'E2A53F05');
alter table backups._t7_retro_20261124_pedidos enable row level security;

do $$
declare nf int; nm int;
begin
  select count(*) filter (where acao_t7 = 'faturar'), count(*) filter (where acao_t7 = 'marcar')
    into nf, nm from backups._t7_retro_20261124_pedidos;
  if nf <> 304 or nm <> 68 then
    raise exception 'Esperado 304 a faturar e 68 a marcar; veio % e %', nf, nm;
  end if;
end $$;

alter table public.pedidos disable trigger user;

-- 2) Faturamentos retroativos (o trigger trg_faturamentos_meses atualiza
--    meses_faturamento do pedido; com os triggers de pedidos desligados, sem
--    efeito colateral).
insert into public.faturamentos (
  pedido_id, numero_nf, data_emissao, nf_url, nf_arquivos, itens, valor_total,
  status, transportadora, pagamentos, metodo_pagamento, observacoes
)
select b.id,
       btrim(b.nf_numero),
       b.nf_data_upload::date,
       b.nf_url,
       jsonb_build_array(jsonb_build_object(
         'url', b.nf_url, 'nome', null, 'numero', btrim(b.nf_numero),
         'data_emissao', to_char(b.nf_data_upload, 'YYYY-MM-DD'))),
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'produto_id',     coalesce(e->'produto_id', e->'id'),
                  'nome',           e->'nome',
                  'cor',            coalesce(e #>> '{cor_selecionada,cor_nome}', ''),
                  'referencia',     coalesce(e->>'referencia', ''),
                  'qtd_faturada',   x.saldo,
                  'preco_unitario', coalesce((e->>'preco')::numeric, 0),
                  'total',          round(x.saldo * coalesce((e->>'preco')::numeric, 0), 2))
                order by o)
           from jsonb_array_elements(case when jsonb_typeof(b.itens) = 'array' then b.itens else '[]'::jsonb end)
                with ordinality as t(e, o)
          cross join lateral (select coalesce((e->>'quantidade')::numeric, 0)
                                     - coalesce((e->>'qtd_faturada')::numeric, 0)
                                     - coalesce((e->>'qtd_quebra')::numeric, 0) as saldo) x
          where x.saldo > 0), '[]'::jsonb),
       round(coalesce(b.valor_final, b.valor_total), 2),
       'faturado',
       b.transportadora,
       jsonb_build_array(jsonb_build_object(
         'metodo', coalesce(nullif(b.metodo_pagamento, ''), 'boleto_faturado'),
         'valor',  round(coalesce(b.valor_final, b.valor_total), 2))),
       coalesce(nullif(b.metodo_pagamento, ''), 'boleto_faturado'),
       'retroativo T7 24/11/2026'
  from backups._t7_retro_20261124_pedidos b
 where b.acao_t7 = 'faturar';

-- 3) Pedidos faturados: itens baixados e valor_faturado.
update public.pedidos p
   set itens = (
         select jsonb_agg(
                  case
                    when coalesce((e->>'quantidade')::numeric, 0) - coalesce((e->>'qtd_quebra')::numeric, 0) > 0 then
                      e || jsonb_build_object(
                             'qtd_faturada', coalesce((e->>'quantidade')::numeric, 0) - coalesce((e->>'qtd_quebra')::numeric, 0),
                             'status_item', 'faturado',
                             'mes_faturamento', coalesce(nullif(e->>'mes_faturamento', ''), to_char(b.nf_data_upload, 'YYYY-MM')))
                    else e || jsonb_build_object('status_item', 'quebra')
                  end order by o)
           from jsonb_array_elements(case when jsonb_typeof(p.itens) = 'array' then p.itens else '[]'::jsonb end)
                with ordinality as t(e, o)),
       valor_faturado    = round(coalesce(b.valor_final, b.valor_total), 2),
       meses_faturamento = public.calc_meses_faturamento(p.id)
  from backups._t7_retro_20261124_pedidos b
 where b.id = p.id
   and b.acao_t7 = 'faturar'
   and jsonb_typeof(p.itens) = 'array';

-- 4) Pedidos sem NF: só valor_faturado e a marcação no histórico.
update public.pedidos p
   set valor_faturado = round(coalesce(b.valor_final, b.valor_total), 2)
  from backups._t7_retro_20261124_pedidos b
 where b.id = p.id
   and b.acao_t7 = 'marcar';

insert into public.pedido_historico (pedido_id, acao, autor_papel, status_de, status_para, campos, mudancas)
select b.id, 'alterado', 'service_role', b.status, b.status,
       array['valor_faturado'],
       jsonb_build_object(
         'valor_faturado', jsonb_build_object('de', coalesce(b.valor_faturado, 0),
                                              'para', round(coalesce(b.valor_final, b.valor_total), 2)),
         'observacao', jsonb_build_object('de', null,
                                          'para', 'Faturado sem NF registrada no portal (retroativo T7 24/11/2026)'))
  from backups._t7_retro_20261124_pedidos b
 where b.acao_t7 = 'marcar';

alter table public.pedidos enable trigger user;

-- 5) Conferências.
do $$
declare v_fat int; v_vf int; v_resto int; v_conf int; v_hist int; v_div int;
begin
  select count(*) into v_fat from public.faturamentos where observacoes = 'retroativo T7 24/11/2026';
  select count(*) into v_vf from public.pedidos p join backups._t7_retro_20261124_pedidos b on b.id = p.id
   where p.valor_faturado = round(coalesce(b.valor_final, b.valor_total), 2)
     and p.status = b.status and p.updated_at is not distinct from b.updated_at;
  select count(*) into v_resto from public.pedidos p
   where p.status in ('faturado', 'em_transporte', 'finalizado', 'pendente_pagamento')
     and not exists (select 1 from public.faturamentos f where f.pedido_id = p.id);
  -- Conferência de cobrança: o total de divergências não pode crescer. (Os
  -- faturamentos novos não têm título, então só poderiam cair em
  -- 'faturado_acima_do_pedido'.)
  select (select count(*) filter (where situacao is not null) from public.vw_conferencia_cobranca)
         - (select n from t7_conf_antes) into v_conf;
  select count(*) into v_hist from public.pedido_historico h
    join backups._t7_retro_20261124_pedidos b on b.id = h.pedido_id
   where h.mudancas ? 'observacao' and h.quando > now() - interval '5 minutes';
  select count(*) into v_div from public.pedidos p join backups._t7_retro_20261124_pedidos b on b.id = p.id
   where b.acao_t7 = 'faturar' and p.meses_faturamento is distinct from public.calc_meses_faturamento(p.id);
  if v_fat <> 304 or v_vf <> 372 or v_resto <> 90 or v_conf > 0 or v_hist <> 68 or v_div <> 0 then
    raise exception 'Conferência falhou: faturamentos=% (304) pedidos_ok=% (372) sem_faturamento=% (90) conferencia=% (<= 0) historico=% (68) meses_div=% (0)',
      v_fat, v_vf, v_resto, v_conf, v_hist, v_div;
  end if;
end $$;

commit;
