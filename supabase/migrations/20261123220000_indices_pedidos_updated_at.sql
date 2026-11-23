-- Indices para o sino de notificacoes (diagnostico A3 / tarefa T2).
--
-- A consulta nº 1 do banco era `pedidos ORDER BY updated_at DESC LIMIT 20`
-- (sino do admin): sem indice em updated_at, cada chamada varria a tabela
-- inteira e ordenava as linhas com `itens` — media de 957 ms e 128 MB lidos por
-- chamada, 65% do tempo total do banco. A nº 2 era a mesma coisa filtrada por
-- fornecedor_id (sino do fornecedor, 71 ms, 19 MB por chamada).
--
-- Testado em producao dentro de BEGIN ... ROLLBACK, com RLS (set role
-- authenticated + request.jwt.claims) para admin, fornecedor, multimarca,
-- franqueado e cadastro: a consulta do admin cai para ~0,1 ms (Index Scan em
-- idx_pedidos_updated_at) e a do fornecedor para ~0,1 ms (idx_pedidos_fornecedor_updated).
--
-- APLICADO EM 23/11/2026 via execute_sql, FORA de transacao: CREATE INDEX
-- CONCURRENTLY nao roda dentro de BEGIN/COMMIT e nao bloqueia escrita em
-- pedidos. Por isso nao foi pelo apply_migration. O `if not exists` torna esta
-- migracao inofensiva se for reaplicada (ex.: supabase db push), mas o CLI
-- executa o arquivo numa transacao; nesse caso rode as duas linhas a mao.

create index concurrently if not exists idx_pedidos_updated_at
  on public.pedidos (updated_at desc);

create index concurrently if not exists idx_pedidos_fornecedor_updated
  on public.pedidos (fornecedor_id, updated_at desc);

-- Rollback (fora de transacao, um por vez):
--   drop index concurrently if exists public.idx_pedidos_updated_at;
--   drop index concurrently if exists public.idx_pedidos_fornecedor_updated;
