-- T19: adia o preenchimento de carteira.fornecedor_id ate o front do PR estar
-- no ar (ver 20261124113621_t19_carteira_fornecedor_do_pedido.sql).
--
-- O front em producao listava a carteira do fornecedor por fornecedor_id sem
-- filtrar parcela; com a coluna preenchida, ele passaria a ver os titulos
-- provisorios na lista. Volta os provisorios a fornecedor_id nulo a partir do
-- backup (sem disparar os triggers da carteira: nada de notificacao) e
-- desliga o trigger novo.
--
-- APLICADO EM 24/11/2026 11:36 UTC (18 s depois do preenchimento). Conferido:
-- 7.585 nulos, todos provisorios; nenhuma parcela sem fornecedor.
--
-- Rollback = o passo pos-merge: supabase/scripts/t19_carteira_pos_merge.sql.

set local lock_timeout = '3s';
alter table public.carteira disable trigger trg_carteira_a_fornecedor_do_pedido;
set local session_replication_role = replica;
update public.carteira c
   set fornecedor_id = null
  from backups._t19_carteira_fornecedor_nulo b
 where b.id = c.id
   and b.fornecedor_id is null
   and c.parcela_numero is null;
set local session_replication_role = origin;
