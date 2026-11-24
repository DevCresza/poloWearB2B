-- T19 / M17: vw_conferencia_cobranca lia 2,8 GB por chamada (4,1 s).
--
-- O plano (EXPLAIN ANALYZE como admin) mostrava o motivo: os CTEs eram
-- inlinados e cada uso de nf.soma_titulos / ped.total_faturado repetia a
-- subconsulta -- 3 Seq Scans de faturamentos por nota (sem indice em
-- pedido_id) e 7 buscas na carteira por nota, cada uma com a RLS avaliada
-- linha a linha. 955 mil blocos lidos para devolver 1.396 linhas.
--
-- Agora cada nota faz UMA agregacao na carteira (LATERAL, pelo indice
-- carteira_parcela_unica_por_faturamento) e UMA em faturamentos (pelo novo
-- idx_faturamentos_pedido). Mesmas colunas, mesmos tipos, mesma regra.
-- Continua security_invoker: cada papel ve so o que a RLS deixa.
--
-- Conferido em producao, transacao desfeita, como admin, fornecedor e
-- franqueado: resultado identico linha a linha (EXCEPT ALL nos dois sentidos
-- = 0; 1.396 / 14 / 226 linhas).
-- Tempo (admin): 3.358 ms -> 690 ms com a RLS atual; ~20 ms com o resto do
-- M15 (20261124230000_t19_rls_rapida.sql).
--
-- APLICADO EM 24/11/2026 11:27 UTC via apply_migration.
--
-- Rollback: recriar a versao de 20261008000004_conferencia_inclui_pedido.sql
-- (create or replace view com os CTEs nf/ped).

create or replace view public.vw_conferencia_cobranca
with (security_invoker = true) as
  select f.id          as faturamento_id,
         f.pedido_id,
         f.numero_nf,
         f.data_emissao,
         f.valor_total as valor_nota,
         coalesce(f.valor_cartao, 0) as valor_cartao,
         tit.soma_titulos,
         round(f.valor_total - tit.soma_titulos, 2) as diferenca_titulos,
         tit.titulos,
         tit.titulos_pagos,
         p.valor_total as valor_pedido,
         fat.total_faturado,
         round(fat.total_faturado - p.valor_total, 2) as excesso_faturado,
         case
           -- A nota (ou o conjunto delas) cobre mais do que o cliente pediu.
           when fat.total_faturado - p.valor_total > 0.05
             then 'faturado_acima_do_pedido'
           -- Nota coerente com o pedido, mas a cobranca nao bate com ela.
           when tit.titulos > 0 and abs(f.valor_total - tit.soma_titulos) > 0.05
             then 'titulos_fora_da_nota'
           when tit.titulos > 0 and abs(f.valor_total - tit.soma_titulos) > 0.01
             then 'arredondamento'
         end as situacao
    from public.faturamentos f
    join public.pedidos p on p.id = f.pedido_id
    -- Agregado sem GROUP BY sempre devolve 1 linha: nota sem titulo da 0/0/0,
    -- igual ao coalesce(...) das subconsultas antigas.
    cross join lateral (
      select coalesce(sum(c.valor), 0)                 as soma_titulos,
             count(*)                                  as titulos,
             count(*) filter (where c.status = 'pago') as titulos_pagos
        from public.carteira c
       where c.faturamento_id = f.id
         and c.parcela_numero is not null
    ) tit
    cross join lateral (
      select coalesce(sum(f2.valor_total), 0) as total_faturado
        from public.faturamentos f2
       where f2.pedido_id = p.id
    ) fat;

comment on view public.vw_conferencia_cobranca is
  'Conferencia de cobranca por NF. faturado_acima_do_pedido tem precedencia: quando a nota excede o pedido, a diferenca de titulos e consequencia e corrigir a cobranca seria o erro.';
