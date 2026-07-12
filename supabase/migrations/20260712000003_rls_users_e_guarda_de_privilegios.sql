-- =====================================================================
-- Blindagem da tabela users.
-- Antes: RLS desligada + signup publico aceitando role do cliente =>
-- qualquer usuario logado se promovia a admin. Papel era decorativo.
-- =====================================================================

-- Papel do usuario logado. SECURITY DEFINER: le users ignorando RLS,
-- senao as policies abaixo recursionariam sobre a propria tabela.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from public.users where id = auth.uid() $$;

revoke execute on function public.app_role() from public;
grant execute on function public.app_role() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Guarda de colunas privilegiadas.
-- RLS decide QUAIS LINHAS; este trigger decide QUAIS COLUNAS.
-- ---------------------------------------------------------------------
create or replace function public.users_guard_privilegios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- Edge Functions com service_role: confiaveis (autenticam o chamador nelas).
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  caller_role := public.app_role();

  if tg_op = 'INSERT' then
    -- Auto-cadastro publico (CadastroCompra) so pode gerar cliente multimarca.
    -- Sem isto, signup({role:'admin'}) cria um admin.
    if caller_role is distinct from 'admin' then
      if coalesce(new.role, '') <> 'multimarca'
         or coalesce(new.tipo_negocio, '') <> 'multimarca' then
        raise exception 'Auto-cadastro so pode criar conta multimarca';
      end if;
      new.permissoes     := '{}'::jsonb;
      new.limite_credito := null;
      new.fornecedor_id  := null;
      new.bloqueado      := false;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if caller_role is distinct from 'admin' then
      if new.role           is distinct from old.role
         or new.tipo_negocio   is distinct from old.tipo_negocio
         or new.permissoes     is distinct from old.permissoes
         or new.limite_credito is distinct from old.limite_credito
         or new.fornecedor_id  is distinct from old.fornecedor_id
         or new.ativo          is distinct from old.ativo then
        raise exception 'Somente admin pode alterar papel, permissoes, credito ou status';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_guard_privilegios on public.users;
create trigger trg_users_guard_privilegios
  before insert or update on public.users
  for each row execute function public.users_guard_privilegios();

-- ---------------------------------------------------------------------
-- RLS
-- NOTA: bloqueado/motivo_bloqueio/total_vencido continuam gravaveis pelo
-- proprio usuario — AlertaBloqueio.jsx:57 e Carrinho.jsx:93 fazem o
-- auto-bloqueio (e auto-desbloqueio) por titulo vencido a partir do client.
-- O portao real de inadimplencia e a checagem fresca da carteira no checkout.
-- Mover esse auto-bloqueio para o servidor e um follow-up.
-- ---------------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists users_select_self_or_staff on public.users;
create policy users_select_self_or_staff on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or public.app_role() in ('admin', 'vendedor', 'cadastro', 'fornecedor')
  );

-- Auto-cadastro insere a propria linha (email confirm esta desligado,
-- entao o signUp ja devolve sessao e auth.uid() existe).
drop policy if exists users_insert_self_or_admin on public.users;
create policy users_insert_self_or_admin on public.users
  for insert to authenticated
  with check (id = auth.uid() or public.app_role() = 'admin');

-- Colunas privilegiadas continuam protegidas pelo trigger acima.
drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin on public.users
  for update to authenticated
  using (id = auth.uid() or public.app_role() = 'admin')
  with check (id = auth.uid() or public.app_role() = 'admin');

drop policy if exists users_delete_admin on public.users;
create policy users_delete_admin on public.users
  for delete to authenticated
  using (public.app_role() = 'admin');
