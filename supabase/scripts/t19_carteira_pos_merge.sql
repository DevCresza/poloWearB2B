-- T19: preenchimento definitivo de carteira.fornecedor_id.
--
-- EXECUTADO em producao em 24/11/2026 as 20h39 (Brasilia): 7.620 titulos
-- preenchidos (35 novos foram incluidos no backup antes do UPDATE); depois,
-- 0 nulos e 0 divergentes do pedido. Nao rodar de novo.
--
-- RODAR SO DEPOIS do merge do PR do T19 estar publicado na Vercel (a lista,
-- a parcela X/Y e os detalhes da Carteira do fornecedor passam a filtrar so
-- parcelas). E depois das 20h (Brasilia): atualiza ~7.600 linhas da carteira.
--
-- Liga o trigger que deriva fornecedor_id do pedido e preenche os
-- provisorios que estao nulos. Sem disparar os triggers da carteira (o
-- notify-pedido mandaria aviso por linha; os totais do cliente nao dependem
-- desta coluna). O backup das linhas e backups._t19_carteira_fornecedor_nulo.
--
-- Conferir depois:
--   select count(*) from public.carteira where fornecedor_id is null;        -- esperado 0
--   select count(*) from public.carteira c join public.pedidos p on p.id = c.pedido_id
--    where c.fornecedor_id is distinct from p.fornecedor_id;                    -- esperado 0
--
-- Rollback: supabase/migrations/20261124113639_t19_carteira_fornecedor_adiado_ate_front.sql

begin;
set local lock_timeout = '3s';
alter table public.carteira enable trigger trg_carteira_a_fornecedor_do_pedido;
set local session_replication_role = replica;
update public.carteira c
   set fornecedor_id = p.fornecedor_id
  from public.pedidos p
 where p.id = c.pedido_id
   and c.fornecedor_id is null
   and p.fornecedor_id is not null;
set local session_replication_role = origin;
commit;
