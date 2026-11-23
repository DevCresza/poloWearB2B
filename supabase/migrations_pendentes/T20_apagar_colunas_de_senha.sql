-- NAO APLICADA. Aplicar so quando o app antigo (DevCresza/poloWear,
-- polo-wear.vercel.app) sair do ar (tarefa T20): ele ainda grava nestas colunas.
-- Antes, conferir de novo com grep que nenhum codigo no ar usa
-- password_hash nem senha_fornecedor.
--
-- Para aplicar: mover para supabase/migrations/ com o timestamp do dia e
-- aplicar pelo apply_migration com o mesmo nome.
--
-- Rollback: alter table public.users add column password_hash varchar;
--           alter table public.fornecedores add column senha_fornecedor varchar;
--           (e recriar os triggers de 20261123231200_t11p_senhas_gravadas_descartadas.sql)

drop trigger if exists trg_users_descarta_senha on public.users;
drop trigger if exists trg_fornecedores_descarta_senha on public.fornecedores;
drop function if exists public.descarta_senha_gravada();

alter table public.users        drop column if exists password_hash;
alter table public.fornecedores drop column if exists senha_fornecedor;
