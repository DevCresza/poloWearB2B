-- T11, parte P (diagnostico de 23/11/2026, achado A8): senhas gravadas em
-- colunas legiveis.
--
-- users.password_hash (1 linha preenchida, legivel pelo staff) e
-- fornecedores.senha_fornecedor (1 linha, legivel por qualquer logado) nao sao
-- usadas pelo app atual (grep em src/ e supabase/functions/: nada le nem grava;
-- o FornecedorForm so usa senha_fornecedor como campo do formulario e apaga a
-- chave antes de salvar). Nenhuma view, funcao ou trigger depende delas.
--
-- O app antigo (DevCresza/poloWear) gravava nas duas, mas desde 23/11/2026
-- polo-wear.vercel.app redireciona (308) para o portal novo em todos os
-- caminhos, entao ninguem mais grava. O dono autorizou apagar.
--
-- Rollback (estrutura apenas; os valores eram segredos e nao voltam):
--   alter table public.users add column password_hash varchar default ''::character varying;
--   alter table public.fornecedores add column senha_fornecedor varchar;

set local lock_timeout = '3s';

alter table public.users        drop column if exists password_hash;
alter table public.fornecedores drop column if exists senha_fornecedor;
