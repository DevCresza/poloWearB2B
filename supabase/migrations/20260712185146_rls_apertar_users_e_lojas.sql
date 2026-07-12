-- Fornecedor e cadastro nao precisam da base inteira de clientes.
--
-- Fornecedor precisa do NOME de quem comprou dele e da LOJA de entrega dos
-- pedidos dele — nao dos 193 usuarios e 212 lojas.
-- Cadastro nao lida com cliente nenhum.
-- Vendedor precisa da lista de clientes (e em nome deles que ele compra).

drop policy if exists users_select_self_or_staff on public.users;
create policy users_select_self_or_staff on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or public.app_role() in ('admin', 'vendedor')
    or (
      public.app_role() = 'fornecedor'
      and exists (
        select 1 from public.pedidos p
        where p.comprador_user_id = users.id
          and p.fornecedor_id = public.meu_fornecedor_id()
      )
    )
  );

drop policy if exists lojas_select on public.lojas;
create policy lojas_select on public.lojas
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.app_role() in ('admin', 'vendedor')
    or (
      public.app_role() = 'fornecedor'
      and exists (
        select 1 from public.pedidos p
        where p.loja_id = lojas.id
          and p.fornecedor_id = public.meu_fornecedor_id()
      )
    )
  );

-- Para as policies acima nao varrerem pedidos a cada linha.
create index if not exists idx_pedidos_fornecedor_comprador on public.pedidos (fornecedor_id, comprador_user_id);
create index if not exists idx_pedidos_fornecedor_loja on public.pedidos (fornecedor_id, loja_id);
