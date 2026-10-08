-- A conferencia anterior (20261008000003) comparava NF x titulos e nada mais.
--
-- Isso nao basta, e quase custou caro: na NF 1199 ela acusou "falta cobrar
-- R$ 8.343,60" e a leitura natural foi reemitir o boleto. Mas o pedido do
-- franqueado vale R$ 4.171,80 -- quem estava fora era a NOTA, que faturou 51
-- grades de um pedido de 17. Reemitir teria cobrado 3x o que ele comprou.
--
-- Entao a nota passa a ser confrontada tambem com o pedido, e o excesso de
-- faturamento tem PRECEDENCIA sobre a diferenca de titulos: quando a nota esta
-- errada, o descasamento dos titulos e sintoma, nao a doenca. Avisar primeiro
-- o sintoma e o que induz a corrigir o lado errado.
--
-- Comparacoes que NAO sao erro, e por isso ficam de fora:
--   nota menor que o pedido  -> faturamento parcial em andamento
--   nota ainda sem titulos   -> boleto nao emitido ainda

drop view if exists public.vw_conferencia_titulos_nf;

create or replace view public.vw_conferencia_cobranca
with (security_invoker = true) as
  with nf as (
    select f.id, f.pedido_id, f.numero_nf, f.data_emissao,
           f.valor_total,
           coalesce(f.valor_cartao, 0) as valor_cartao,
           (select coalesce(sum(c.valor), 0) from public.carteira c
             where c.faturamento_id = f.id and c.parcela_numero is not null) as soma_titulos,
           (select count(*) from public.carteira c
             where c.faturamento_id = f.id and c.parcela_numero is not null) as titulos,
           (select count(*) from public.carteira c
             where c.faturamento_id = f.id and c.parcela_numero is not null
               and c.status = 'pago') as titulos_pagos
      from public.faturamentos f
  ),
  ped as (
    select p.id,
           p.valor_total as valor_pedido,
           (select coalesce(sum(f2.valor_total), 0) from public.faturamentos f2
             where f2.pedido_id = p.id) as total_faturado
      from public.pedidos p
  )
  select nf.id          as faturamento_id,
         nf.pedido_id,
         nf.numero_nf,
         nf.data_emissao,
         nf.valor_total as valor_nota,
         nf.valor_cartao,
         nf.soma_titulos,
         round(nf.valor_total - nf.soma_titulos, 2) as diferenca_titulos,
         nf.titulos,
         nf.titulos_pagos,
         ped.valor_pedido,
         ped.total_faturado,
         round(ped.total_faturado - ped.valor_pedido, 2) as excesso_faturado,
         case
           -- A nota (ou o conjunto delas) cobre mais do que o cliente pediu.
           when ped.total_faturado - ped.valor_pedido > 0.05
             then 'faturado_acima_do_pedido'
           -- Nota coerente com o pedido, mas a cobranca nao bate com ela.
           when nf.titulos > 0 and abs(nf.valor_total - nf.soma_titulos) > 0.05
             then 'titulos_fora_da_nota'
           when nf.titulos > 0 and abs(nf.valor_total - nf.soma_titulos) > 0.01
             then 'arredondamento'
         end as situacao
    from nf
    join ped on ped.id = nf.pedido_id;

comment on view public.vw_conferencia_cobranca is
  'Conferencia de cobranca por NF. faturado_acima_do_pedido tem precedencia: quando a nota excede o pedido, a diferenca de titulos e consequencia e corrigir a cobranca seria o erro.';

grant select on public.vw_conferencia_cobranca to anon, authenticated;
