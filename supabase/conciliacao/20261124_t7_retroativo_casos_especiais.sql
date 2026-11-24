-- Conciliação de 24/11/2026 (T7): 3 dos 22 casos especiais, aprovados pelo
-- dono depois do retroativo principal (20261124_t7_faturamento_retroativo.sql).
--
--   * 782C0265  NF 271.685 gravada com data 27/07/2027 (pedido criado em
--               21/07/2026): a data vira 27/07/2026 e o faturamento é
--               registrado.
--   * 45A85186 e 156CD85C  mesma NF 5810 do mesmo fornecedor: NF de lote,
--               registrada nos dois pedidos (o índice único é por pedido).
--
-- Mesmo padrão do script principal: 1 faturamento por pedido com a NF do
-- pedido e valor = valor_final, itens marcados como faturados, valor_faturado
-- e meses_faturamento; sem títulos, sem mudança de status, triggers de usuário
-- de pedidos desligados só dentro da transação, observacoes 'retroativo T7'.
-- Os outros 19 casos (sem título) ficam com o dono e os fornecedores.
--
-- Backup: backups._t7_retro_casos_20261124_pedidos (linhas inteiras, antes).
-- Rollback (não executado; tem DELETE, pede o clique do dono), numa transação:
--   alter table public.pedidos disable trigger user;
--   delete from public.faturamentos
--    where observacoes = 'retroativo T7 24/11/2026 (caso especial)';
--   update public.pedidos p
--      set itens = b.itens, valor_faturado = b.valor_faturado,
--          meses_faturamento = b.meses_faturamento, nf_data_upload = b.nf_data_upload
--     from backups._t7_retro_casos_20261124_pedidos b where b.id = p.id;
--   alter table public.pedidos enable trigger user;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temp table t7c_conf_antes as
select count(*) filter (where situacao is not null) as n from public.vw_conferencia_cobranca;

create table backups._t7_retro_casos_20261124_pedidos as
select p.*
  from public.pedidos p
 where upper(right(p.id::text, 8)) in ('782C0265', '45A85186', '156CD85C')
   and p.status in ('faturado', 'em_transporte', 'finalizado', 'pendente_pagamento')
   and not exists (select 1 from public.faturamentos f where f.pedido_id = p.id);
alter table backups._t7_retro_casos_20261124_pedidos enable row level security;

do $$
begin
  if (select count(*) from backups._t7_retro_casos_20261124_pedidos) <> 3 then
    raise exception 'Esperado 3 pedidos; veio %', (select count(*) from backups._t7_retro_casos_20261124_pedidos);
  end if;
end $$;

alter table public.pedidos disable trigger user;

-- 782C0265: 27/07/2027 -> 27/07/2026 (mesmo dia e mês, mesmo horário).
update public.pedidos p
   set nf_data_upload = p.nf_data_upload - interval '1 year'
  from backups._t7_retro_casos_20261124_pedidos b
 where b.id = p.id
   and upper(right(p.id::text, 8)) = '782C0265'
   and extract(year from p.nf_data_upload) = 2027;

insert into public.faturamentos (
  pedido_id, numero_nf, data_emissao, nf_url, nf_arquivos, itens, valor_total,
  status, transportadora, pagamentos, metodo_pagamento, observacoes
)
select p.id,
       btrim(p.nf_numero),
       p.nf_data_upload::date,
       p.nf_url,
       jsonb_build_array(jsonb_build_object(
         'url', p.nf_url, 'nome', null, 'numero', btrim(p.nf_numero),
         'data_emissao', to_char(p.nf_data_upload, 'YYYY-MM-DD'))),
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
           from jsonb_array_elements(case when jsonb_typeof(p.itens) = 'array' then p.itens else '[]'::jsonb end)
                with ordinality as t(e, o)
          cross join lateral (select coalesce((e->>'quantidade')::numeric, 0)
                                     - coalesce((e->>'qtd_faturada')::numeric, 0)
                                     - coalesce((e->>'qtd_quebra')::numeric, 0) as saldo) x
          where x.saldo > 0), '[]'::jsonb),
       round(coalesce(p.valor_final, p.valor_total), 2),
       'faturado',
       p.transportadora,
       jsonb_build_array(jsonb_build_object(
         'metodo', coalesce(nullif(p.metodo_pagamento, ''), 'boleto_faturado'),
         'valor',  round(coalesce(p.valor_final, p.valor_total), 2))),
       coalesce(nullif(p.metodo_pagamento, ''), 'boleto_faturado'),
       'retroativo T7 24/11/2026 (caso especial)'
  from public.pedidos p
  join backups._t7_retro_casos_20261124_pedidos b on b.id = p.id;

update public.pedidos p
   set itens = (
         select jsonb_agg(
                  case
                    when coalesce((e->>'quantidade')::numeric, 0) - coalesce((e->>'qtd_quebra')::numeric, 0) > 0 then
                      e || jsonb_build_object(
                             'qtd_faturada', coalesce((e->>'quantidade')::numeric, 0) - coalesce((e->>'qtd_quebra')::numeric, 0),
                             'status_item', 'faturado',
                             'mes_faturamento', coalesce(nullif(e->>'mes_faturamento', ''), to_char(p.nf_data_upload, 'YYYY-MM')))
                    else e || jsonb_build_object('status_item', 'quebra')
                  end order by o)
           from jsonb_array_elements(p.itens) with ordinality as t(e, o)),
       valor_faturado    = round(coalesce(p.valor_final, p.valor_total), 2),
       meses_faturamento = public.calc_meses_faturamento(p.id)
  from backups._t7_retro_casos_20261124_pedidos b
 where b.id = p.id
   and jsonb_typeof(p.itens) = 'array';

alter table public.pedidos enable trigger user;

do $$
declare v_fat int; v_ok int; v_resto int; v_conf int; v_data text;
begin
  select count(*) into v_fat from public.faturamentos
   where observacoes = 'retroativo T7 24/11/2026 (caso especial)';
  select count(*) into v_ok from public.pedidos p join backups._t7_retro_casos_20261124_pedidos b on b.id = p.id
   where p.valor_faturado = round(coalesce(b.valor_final, b.valor_total), 2)
     and p.status = b.status and p.updated_at is not distinct from b.updated_at
     and p.meses_faturamento = public.calc_meses_faturamento(p.id)
     and not exists (select 1 from jsonb_array_elements(p.itens) e
                      where coalesce((e->>'qtd_faturada')::numeric, 0) + coalesce((e->>'qtd_quebra')::numeric, 0)
                            < coalesce((e->>'quantidade')::numeric, 0));
  select count(*) into v_resto from public.pedidos p
   where p.status in ('faturado', 'em_transporte', 'finalizado', 'pendente_pagamento')
     and not exists (select 1 from public.faturamentos f where f.pedido_id = p.id);
  select (select count(*) filter (where situacao is not null) from public.vw_conferencia_cobranca)
         - (select n from t7c_conf_antes) into v_conf;
  select nf_data_upload::date::text into v_data from public.pedidos where upper(right(id::text, 8)) = '782C0265';
  if v_fat <> 3 or v_ok <> 3 or v_resto <> 87 or v_conf > 0 or v_data <> '2026-07-27' then
    raise exception 'Conferência falhou: faturamentos=% (3) pedidos_ok=% (3) sem_faturamento=% (87) conferencia=% (<= 0) data_782C0265=% (2026-07-27)',
      v_fat, v_ok, v_resto, v_conf, v_data;
  end if;
end $$;

commit;
