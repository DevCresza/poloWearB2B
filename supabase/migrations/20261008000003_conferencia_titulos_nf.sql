-- Conferencia: a soma dos titulos da carteira tem que fechar com o valor da NF.
--
-- Veio de um caso real: a NF 1199 vale R$ 12.515,40 e tem 4 titulos de
-- R$ 1.042,95, somando R$ 4.171,80. Esse valor e 1/12 da nota, nao 1/4 -- os
-- titulos nasceram certos para uma nota menor e o valor do faturamento mudou
-- depois, sem nada ressincronizar. Duas parcelas ja foram pagas. Na pratica o
-- franqueado esta sendo cobrado R$ 8.343,60 a menos, e ninguem tinha como
-- perceber: nenhuma tela compara as duas coisas.
--
-- A view mostra so o que NAO fecha, separando dois casos muito diferentes:
--
--   arredondamento -- ate 5 centavos. E a divisao em float que existia antes
--                     de 20261008000002 (22 das 200 notas em producao). Nao da
--                     para simplesmente corrigir: boa parte tem parcela paga,
--                     e mexer no valor de titulo quitado e pior que o centavo.
--   divergencia    -- o resto. Alguem precisa olhar.
--
-- security_invoker: quem consulta ve pelo recorte da RLS de faturamentos e
-- carteira -- admin ve tudo, fornecedor so as notas dele, cliente so as suas.

create or replace view public.vw_conferencia_titulos_nf
with (security_invoker = true) as
  select f.id            as faturamento_id,
         f.pedido_id,
         f.numero_nf,
         f.data_emissao,
         f.valor_total   as valor_nota,
         coalesce(f.valor_cartao, 0) as valor_cartao,
         round(sum(c.valor), 2)      as soma_titulos,
         round(f.valor_total - sum(c.valor), 2) as diferenca,
         count(c.id)                             as titulos,
         count(c.id) filter (where c.status = 'pago') as titulos_pagos,
         case
           when abs(f.valor_total - sum(c.valor)) <= 0.05 then 'arredondamento'
           else 'divergencia'
         end as situacao
    from public.faturamentos f
    join public.carteira c
      on c.faturamento_id = f.id
     and c.parcela_numero is not null   -- placeholder sem boleto nao e titulo
   group by f.id, f.pedido_id, f.numero_nf, f.data_emissao,
            f.valor_total, f.valor_cartao
  having abs(f.valor_total - sum(c.valor)) > 0.01;

comment on view public.vw_conferencia_titulos_nf is
  'Notas cujos titulos na carteira nao somam o valor da NF. situacao=divergencia pede acao; arredondamento e residuo historico de centavos.';

grant select on public.vw_conferencia_titulos_nf to anon, authenticated;
