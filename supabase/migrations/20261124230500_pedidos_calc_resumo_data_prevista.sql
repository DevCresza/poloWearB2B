-- Meses de entrega recalculados quando muda a data prevista do pedido.
--
-- Bug (achado na conciliação T15, PR #30): meses_entrega_efetivos usa
-- calc_meses_entrega_efetivos(itens, data_prevista_entrega, created_date).
-- Item sem mes_entrega cujo produto não tem data prevista cai na data prevista
-- do PEDIDO. Mas trg_pedidos_calc_resumo só disparava em UPDATE OF itens:
-- quando o fornecedor preenchia a data prevista no aceite (sem mexer nos
-- itens), a coluna ficava com o mês antigo (7 pedidos em 24/11).
--
-- Correção: o trigger dispara também em UPDATE OF data_prevista_entrega e
-- created_date (as outras colunas do cálculo). A função não muda; qtd_pecas e
-- meses_entrega vêm de itens e saem iguais. A data prevista do produto continua
-- com trg_produtos_propagar_meses (em produtos).
--
-- De quebra: search_path fixo em pedidos_calc_resumo (advisor
-- function_search_path_mutable). A função só chama nomes com public.
--
-- CREATE OR REPLACE TRIGGER pega um lock em pedidos por um instante: aplicar
-- depois das 20h de Brasília.
--
-- Rollback:
--   create or replace trigger trg_pedidos_calc_resumo
--     before insert or update of itens on public.pedidos
--     for each row execute function public.pedidos_calc_resumo();
--   alter function public.pedidos_calc_resumo() reset search_path;

set local lock_timeout = '3s';

create or replace trigger trg_pedidos_calc_resumo
  before insert or update of itens, data_prevista_entrega, created_date
  on public.pedidos
  for each row execute function public.pedidos_calc_resumo();

alter function public.pedidos_calc_resumo() set search_path = public;
