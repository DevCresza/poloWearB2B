-- =====================================================================
-- Sobras apontadas pelo linter do Supabase.
-- =====================================================================

-- 1) delete_user_complete: SECURITY DEFINER e executavel por ANON.
--    Ou seja: qualquer um na internet apagava qualquer usuario.
--    A funcao E usada pelo admin (UserManagement/GestaoClientes) — entao
--    blindamos por dentro em vez de revogar.
create or replace function public.delete_user_complete(target_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Apenas administradores podem excluir usuarios';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Voce nao pode excluir a si mesmo';
  end if;

  select email into v_email from public.users where id = target_user_id;
  if v_email is null then
    return json_build_object('success', false, 'error', 'Usuario nao encontrado');
  end if;

  delete from public.users where id = target_user_id;
  delete from auth.users where id = target_user_id;

  return json_build_object('success', true, 'email', v_email);
end;
$$;

revoke execute on function public.delete_user_complete(uuid) from public, anon;
grant  execute on function public.delete_user_complete(uuid) to authenticated, service_role;

-- 2) Funcoes de TRIGGER nao devem ser chamaveis como RPC.
revoke execute on function public.users_guard_privilegios()  from public, anon, authenticated;
revoke execute on function public.pedidos_guard_colunas()    from public, anon, authenticated;
revoke execute on function public.carteira_guard_colunas()   from public, anon, authenticated;

-- 3) Helpers de papel e a RPC de estoque: so para quem esta logado.
revoke execute on function public.aplicar_baixa_estoque(jsonb) from public, anon;
revoke execute on function public.app_role()            from public, anon;
revoke execute on function public.is_admin()            from public, anon;
revoke execute on function public.is_staff()            from public, anon;
revoke execute on function public.pode_gerir_catalogo() from public, anon;
revoke execute on function public.ve_todos_pedidos()    from public, anon;
revoke execute on function public.meu_fornecedor_id()   from public, anon;

-- 4) Views SECURITY DEFINER furam a RLS (rodam como o dono, nao como quem
--    consulta). Nenhuma e usada pelo app — fecha o acesso pela API.
revoke all on public.vw_pedidos_completos      from anon, authenticated;
revoke all on public.vw_produtos_estoque_baixo from anon, authenticated;
revoke all on public.vw_vendas_por_fornecedor  from anon, authenticated;
revoke all on public.vw_franqueados_ativos     from anon, authenticated;

-- 5) Tabelas sem RLS / sem policy.
alter table public.health_checks enable row level security;
drop policy if exists health_checks_admin on public.health_checks;
create policy health_checks_admin on public.health_checks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- carrinho_itens esta vazia e o app nao a usa (o carrinho vive no localStorage).
drop policy if exists carrinho_itens_own on public.carrinho_itens;
drop policy if exists carrinho_itens_admin on public.carrinho_itens;
create policy carrinho_itens_admin on public.carrinho_itens
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
