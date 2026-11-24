-- T8 + T9 (fase 2): estorno automatico e fim do INSERT direto.
--
-- APLICAR SO DEPOIS QUE O FRONT DESTE PR ESTIVER NO AR (Vercel, main).
-- Antes disso o front antigo:
--   * devolve o estoque na mao ao cancelar (PedidosFornecedor) -> com o
--     trigger, devolveria em dobro;
--   * cria pedido com Pedido.create + aplicar_baixa_estoque + Carteira.create
--     -> sem o INSERT, o checkout antigo para de funcionar.
-- Quando aplicar: mover este arquivo para supabase/migrations/ com o
-- timestamp do dia e aplicar pelo MCP (apply_migration) com o mesmo nome.
--
-- Antes de aplicar, conferir o texto atual das policies pedidos_insert e
-- carteira_insert (o T19 reescreve policies com (select ...)): o que muda
-- aqui e so quem pode inserir.
--
-- Rollback:
--   alter table public.pedidos disable trigger trg_pedidos_zz_estoque;
--     (ou remover o trigger)
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
  with check (public.is_admin());

alter policy carteira_insert on public.carteira
  with check (public.is_admin()
              or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id()));
