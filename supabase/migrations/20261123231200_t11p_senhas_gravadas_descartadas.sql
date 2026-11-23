-- T11, parte P (diagnostico de 23/11/2026, achado A8): senhas gravadas em
-- colunas legiveis.
--
-- users.password_hash e fornecedores.senha_fornecedor nao sao usadas pelo app
-- atual (poloWearB2B), mas o app antigo (DevCresza/poloWear, polo-wear.vercel.app,
-- mesmo banco) ainda GRAVA nelas: password_hash no cadastro e na criacao de
-- usuario (inclusive a senha digitada, em texto puro, no ClientForm) e
-- senha_fornecedor no cadastro de fornecedor. Apagar as colunas agora quebraria
-- esses fluxos do app antigo com "column does not exist".
--
-- Entao, por decisao do dono (23/11/2026):
--   1. os valores gravados sao zerados;
--   2. um trigger descarta qualquer valor novo nessas colunas (grava NULL), de
--      modo que o app antigo segue funcionando e nada fica salvo;
--   3. as colunas serao apagadas quando o app antigo sair do ar (tarefa T20),
--      com supabase/migrations_pendentes/T20_apagar_colunas_de_senha.sql.
--
-- Rollback: drop trigger trg_users_descarta_senha on public.users;
--           drop trigger trg_fornecedores_descarta_senha on public.fornecedores;
--           drop function public.descarta_senha_gravada();
--   (os valores zerados nao voltam: eram segredos e nao devem ser restaurados.)

create or replace function public.descarta_senha_gravada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'users' then
    new.password_hash := null;
  elsif tg_table_name = 'fornecedores' then
    new.senha_fornecedor := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.descarta_senha_gravada() from anon, public;

drop trigger if exists trg_users_descarta_senha on public.users;
create trigger trg_users_descarta_senha
  before insert or update of password_hash on public.users
  for each row execute function public.descarta_senha_gravada();

drop trigger if exists trg_fornecedores_descarta_senha on public.fornecedores;
create trigger trg_fornecedores_descarta_senha
  before insert or update of senha_fornecedor on public.fornecedores
  for each row execute function public.descarta_senha_gravada();

alter table public.users alter column password_hash drop default;

update public.users        set password_hash    = null where password_hash    is not null;
update public.fornecedores set senha_fornecedor = null where senha_fornecedor is not null;

comment on column public.users.password_hash is
  'DESATIVADA: sempre NULL (trigger trg_users_descarta_senha). Apagar quando o app antigo sair do ar (T20).';
comment on column public.fornecedores.senha_fornecedor is
  'DESATIVADA: sempre NULL (trigger trg_fornecedores_descarta_senha). Apagar quando o app antigo sair do ar (T20).';
