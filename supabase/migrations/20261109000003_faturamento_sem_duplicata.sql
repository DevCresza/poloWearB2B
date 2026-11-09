-- Mesma nota, mesmo valor, lancada duas vezes no mesmo pedido.
--
-- Aconteceu no pedido #FCAB78CE: NF 274.856, R$ 1.185,00, as 16:52:07 e de
-- novo as 16:52:36. Duas linhas identicas -- mesmos 3 itens, mesmo arquivo.
-- O pedido em si ficou certo (valor_faturado 1.185 e itens 1 de 1), porque o
-- segundo envio leu o pedido ainda sem faturamento e recalculou 0 + 1.185.
-- Quem mentia era a soma dos faturamentos: R$ 2.370 num pedido de R$ 1.185.
-- Nenhum titulo chegou a nascer, entao o cliente nunca foi cobrado em dobro.
-- A linha repetida foi apagada em 09/11/2026.
--
-- A chave inclui valor_total de proposito. A primeira versao desta trava era
-- (pedido_id, numero_nf), e ela teria BARRADO um caso legitimo: no pedido
-- #02F23258 a NF 95305 cobre dois faturamentos parciais de verdade, com itens
-- e valores diferentes (R$ 980 e R$ 5.849). Uma nota cobrindo duas remessas
-- parciais e normal; a mesma nota com o mesmo valor duas vezes nao e.
--
-- Indice unico e nao trigger: o caso e corrida entre dois envios. Um trigger
-- que consulta antes de inserir tem exatamente a janela que o duplo clique
-- usa.
--
-- numero_nf nulo fica de fora: faturamento sem nota (quebra) nao se repete
-- por este caminho, e NULL nao casa com NULL em indice unico de qualquer
-- forma.

create unique index if not exists uniq_faturamento_nota_valor
  on public.faturamentos (pedido_id, numero_nf, valor_total)
  where numero_nf is not null;
