-- T19 / M19 do diagnostico: movimentacoes_estoque sem escopo de fornecedor.
--
-- A policy movimentacoes_all era `pode_gerir_catalogo() or is_admin()`: um
-- fornecedor lia e gravava as movimentacoes de estoque de TODOS os
-- fornecedores. Agora a tabela tem fornecedor_id, preenchido pelo banco a
-- partir do produto (o que vier do cliente e ignorado), e a policy recorta:
-- admin e cadastro veem tudo; fornecedor so as dos produtos dele.
--
-- Testado em producao, transacao desfeita, como o fornecedor com mais
-- pedidos: antes via as 92 movimentacoes e inseria em produto de outro
-- fornecedor; depois ve 0 (nenhuma e de produto dele) e o INSERT em produto
-- de outro e negado (42501). Nenhuma outra tabela mudou para ele. Para admin e
-- cadastro a regra e a mesma de antes; vendedor e clientes continuam sem acesso.
--
-- APLICADO EM 24/11/2026 11:37 UTC via apply_migration (antes do front do PR,
-- que passa a filtrar por esta coluna em GestaoEstoque).
--
-- Rollback:
--   alter policy movimentacoes_all on public.movimentacoes_estoque
--     using (pode_gerir_catalogo() or is_admin()) with check (pode_gerir_catalogo() or is_admin());
--   drop trigger if exists trg_movimentacoes_fornecedor on public.movimentacoes_estoque;
--   drop function if exists public.movimentacoes_fornecedor_do_produto();
--   drop index if exists public.idx_movimentacoes_fornecedor_data;
--   alter table public.movimentacoes_estoque drop column if exists fornecedor_id;

set local lock_timeout = '3s';
alter table public.movimentacoes_estoque
  add column if not exists fornecedor_id uuid references public.fornecedores(id);

create or replace function public.movimentacoes_fornecedor_do_produto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Sempre do produto: o que vier do cliente e ignorado.
  new.fornecedor_id := (select p.fornecedor_id from public.produtos p where p.id = new.produto_id);
  return new;
end;
$$;
revoke execute on function public.movimentacoes_fornecedor_do_produto() from public, anon, authenticated;

create trigger trg_movimentacoes_fornecedor
  before insert or update of produto_id, fornecedor_id on public.movimentacoes_estoque
  for each row execute function public.movimentacoes_fornecedor_do_produto();

update public.movimentacoes_estoque m
   set fornecedor_id = p.fornecedor_id
  from public.produtos p
 where p.id = m.produto_id
   and m.fornecedor_id is distinct from p.fornecedor_id;

create index if not exists idx_movimentacoes_fornecedor_data
  on public.movimentacoes_estoque (fornecedor_id, created_at desc);

alter policy movimentacoes_all on public.movimentacoes_estoque
  using (
    (select public.app_role()) = any (array['admin', 'cadastro'])
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id()))
  )
  with check (
    (select public.app_role()) = any (array['admin', 'cadastro'])
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id()))
  );
