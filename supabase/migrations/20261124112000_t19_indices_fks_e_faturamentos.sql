-- T19 / M16 do diagnostico de 23/11: indices que faltavam.
--
-- * faturamentos(pedido_id): 85.404 seq scans contra 490 idx scans. O unico
--   indice com pedido_id era parcial (numero_nf is not null) e nao servia para
--   "faturamentos deste pedido" nem para a vw_conferencia_cobranca.
-- * carteira(fornecedor_id, data_vencimento): cobre a FK e a lista da
--   carteira do fornecedor (where fornecedor_id = X order by data_vencimento).
-- * as demais: chaves estrangeiras apontadas pelo advisor unindexed_foreign_keys.
--
-- APLICADO EM 24/11/2026 (~11:20 UTC) via execute_sql, um por vez e FORA de
-- transacao: CREATE INDEX CONCURRENTLY nao bloqueia escrita e nao roda dentro
-- de BEGIN/COMMIT. Todos conferidos com indisvalid = true. O `if not exists`
-- torna o arquivo inofensivo se reaplicado; como o CLI roda o arquivo numa
-- transacao, nesse caso rode as linhas a mao.
--
-- NAO removidos ainda: os indices sem uso do advisor unused_index. As
-- estatisticas foram zeradas em 10/11; reavaliar depois de 10/12.
-- Indice duplicado de franqueados (idx_franqueados_codigo = a unique
-- franqueados_codigo_franquia_key): sai em 20261124230000_t19_rls_rapida.sql.

create index concurrently if not exists idx_faturamentos_pedido            on public.faturamentos (pedido_id);
create index concurrently if not exists idx_carteira_fornecedor_vencimento on public.carteira (fornecedor_id, data_vencimento);
create index concurrently if not exists idx_fornecedores_responsavel_user  on public.fornecedores (responsavel_user_id);
create index concurrently if not exists idx_movimentacoes_pedido           on public.movimentacoes_estoque (pedido_id);
create index concurrently if not exists idx_movimentacoes_user             on public.movimentacoes_estoque (user_id);
create index concurrently if not exists idx_pedidos_franqueado             on public.pedidos (franqueado_id);
create index concurrently if not exists idx_pending_users_approved_by      on public.pending_users (approved_by);
create index concurrently if not exists idx_pending_users_contact          on public.pending_users (contact_id);
create index concurrently if not exists idx_pending_users_fornecedor       on public.pending_users (fornecedor_id);
create index concurrently if not exists idx_users_fornecedor               on public.users (fornecedor_id);
create index concurrently if not exists idx_users_franqueado               on public.users (franqueado_id);

-- Rollback (fora de transacao, um por vez):
--   drop index concurrently if exists public.idx_faturamentos_pedido;
--   drop index concurrently if exists public.idx_carteira_fornecedor_vencimento;
--   drop index concurrently if exists public.idx_fornecedores_responsavel_user;
--   drop index concurrently if exists public.idx_movimentacoes_pedido;
--   drop index concurrently if exists public.idx_movimentacoes_user;
--   drop index concurrently if exists public.idx_pedidos_franqueado;
--   drop index concurrently if exists public.idx_pending_users_approved_by;
--   drop index concurrently if exists public.idx_pending_users_contact;
--   drop index concurrently if exists public.idx_pending_users_fornecedor;
--   drop index concurrently if exists public.idx_users_fornecedor;
--   drop index concurrently if exists public.idx_users_franqueado;
