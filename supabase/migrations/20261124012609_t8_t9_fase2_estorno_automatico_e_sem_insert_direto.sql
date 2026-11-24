-- T8 + T9 (fase 2): estorno automatico e fim do INSERT direto.
--
-- Aplicada em producao em 24/11/2026 01:26 UTC, depois do deploy do PR #17
-- (commit 8bab913). Testada antes numa transacao desfeita: cliente nao insere
-- pedido nem titulo, ninguem logado executa aplicar_baixa_estoque, o
-- fornecedor segue criando titulo proprio e o admin segue inserindo pedido.
--
-- Rollback (rodar tudo junto; o front volta sozinho ao caminho antigo de
-- estoque porque estoque_automatico_ativo() passa a dar falso):
--   alter table public.pedidos disable trigger trg_pedidos_zz_estoque;
--   grant execute on function public.aplicar_baixa_estoque(jsonb) to authenticated;
--   alter policy pedidos_insert on public.pedidos
--     with check ((comprador_user_id = auth.uid()) or ve_todos_pedidos());
--   alter policy carteira_insert on public.carteira
--     with check ((cliente_user_id = auth.uid()) or is_admin()
--                 or ((app_role() = 'fornecedor') and (fornecedor_id = meu_fornecedor_id()))
--                 or ve_todos_pedidos());

-- Estorno uma unica vez ao cancelar; diferenca de estoque na revisao de itens.
-- O nome comeca com "zz" para rodar depois do trg_pedidos_guard_colunas.
create trigger trg_pedidos_zz_estoque
  before update of status, itens on public.pedidos
  for each row execute function public.pedidos_estoque_automatico();

-- A RPC antiga deixava qualquer logado zerar o estoque de qualquer produto.
revoke execute on function public.aplicar_baixa_estoque(jsonb) from public, anon, authenticated;

-- Pedido e titulo do checkout so nascem por criar_pedido / emitir_pedido_lote.
-- Admin continua podendo inserir (correcoes manuais); fornecedor continua
-- criando os titulos do proprio faturamento (FaturarPedidoModal).
alter policy pedidos_insert on public.pedidos
  with check ((select public.is_admin()));

alter policy carteira_insert on public.carteira
  with check ((select public.is_admin())
              or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id())));
