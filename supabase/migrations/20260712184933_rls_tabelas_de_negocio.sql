-- =====================================================================
-- RLS nas tabelas de negocio.
-- Antes: tudo aberto. Os proprios testes do repo registravam isso
-- ("Cliente pode ver pedidos de outros (sem RLS)" — scripts/testes/test-cliente.js).
-- =====================================================================

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public
  as $$ select public.app_role() in ('admin','vendedor','cadastro') $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select public.app_role() = 'admin' $$;

-- Quem cuida de catalogo: admin, cadastro e o fornecedor (dos itens dele).
create or replace function public.pode_gerir_catalogo() returns boolean
  language sql stable security definer set search_path = public
  as $$ select public.app_role() in ('admin','cadastro','fornecedor') $$;

-- Quem enxerga pedidos de todo mundo. Cadastro NAO entra.
create or replace function public.ve_todos_pedidos() returns boolean
  language sql stable security definer set search_path = public
  as $$ select public.app_role() in ('admin','vendedor') $$;

create or replace function public.meu_fornecedor_id() returns uuid
  language sql stable security definer set search_path = public
  as $$ select fornecedor_id from public.users where id = auth.uid() $$;

grant execute on function public.is_staff(), public.is_admin(),
  public.pode_gerir_catalogo(), public.ve_todos_pedidos(), public.meu_fornecedor_id()
  to authenticated, service_role;

-- ---------------------------------------------------------------- PRODUTOS
-- Leitura liberada (o catalogo precisa). Escrita so de quem cuida do catalogo.
-- O estoque do checkout do cliente vai pela RPC aplicar_baixa_estoque().
alter table public.produtos enable row level security;

drop policy if exists produtos_select on public.produtos;
create policy produtos_select on public.produtos
  for select to authenticated using (true);

drop policy if exists produtos_insert on public.produtos;
create policy produtos_insert on public.produtos
  for insert to authenticated
  with check (public.app_role() in ('admin','cadastro')
              or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id()));

drop policy if exists produtos_update on public.produtos;
create policy produtos_update on public.produtos
  for update to authenticated
  using (public.app_role() in ('admin','cadastro')
         or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id()));

drop policy if exists produtos_delete on public.produtos;
create policy produtos_delete on public.produtos
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- CAPSULAS
alter table public.capsulas enable row level security;

drop policy if exists capsulas_select on public.capsulas;
create policy capsulas_select on public.capsulas
  for select to authenticated using (true);

drop policy if exists capsulas_write on public.capsulas;
create policy capsulas_write on public.capsulas
  for all to authenticated
  using (public.app_role() in ('admin','cadastro')
         or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id()))
  with check (public.app_role() in ('admin','cadastro')
              or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id()));

-- ------------------------------------------------------------ FORNECEDORES
alter table public.fornecedores enable row level security;

drop policy if exists fornecedores_select on public.fornecedores;
create policy fornecedores_select on public.fornecedores
  for select to authenticated using (true);

drop policy if exists fornecedores_write on public.fornecedores;
create policy fornecedores_write on public.fornecedores
  for all to authenticated
  using (public.is_admin() or (public.app_role() = 'fornecedor' and id = public.meu_fornecedor_id()))
  with check (public.is_admin() or (public.app_role() = 'fornecedor' and id = public.meu_fornecedor_id()));

-- ----------------------------------------------------------------- PEDIDOS
alter table public.pedidos enable row level security;

drop policy if exists pedidos_select on public.pedidos;
create policy pedidos_select on public.pedidos
  for select to authenticated
  using (
    comprador_user_id = auth.uid()
    or public.ve_todos_pedidos()
    or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id())
  );

-- Cliente cria o proprio pedido; vendedor/admin criam em nome do cliente.
drop policy if exists pedidos_insert on public.pedidos;
create policy pedidos_insert on public.pedidos
  for insert to authenticated
  with check (comprador_user_id = auth.uid() or public.ve_todos_pedidos());

drop policy if exists pedidos_update on public.pedidos;
create policy pedidos_update on public.pedidos
  for update to authenticated
  using (
    comprador_user_id = auth.uid()        -- comprovante, confirmacao, cancelamento
    or public.ve_todos_pedidos()
    or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id())
  );

drop policy if exists pedidos_delete on public.pedidos;
create policy pedidos_delete on public.pedidos
  for delete to authenticated using (public.is_admin());

-- O cliente pode mexer no PROPRIO pedido (comprovante, cancelar), mas nao
-- reescrever o que ele custa nem o que tem dentro.
create or replace function public.pedidos_guard_colunas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if public.ve_todos_pedidos()
     or (public.app_role() = 'fornecedor' and new.fornecedor_id = public.meu_fornecedor_id()) then
    return new;
  end if;

  if new.comprador_user_id is distinct from old.comprador_user_id
     or new.fornecedor_id   is distinct from old.fornecedor_id
     or new.itens           is distinct from old.itens
     or new.valor_total     is distinct from old.valor_total
     or new.valor_final     is distinct from old.valor_final then
    raise exception 'Somente a equipe pode alterar itens, valores ou o dono do pedido';
  end if;
  return new;
end $$;

drop trigger if exists trg_pedidos_guard_colunas on public.pedidos;
create trigger trg_pedidos_guard_colunas
  before update on public.pedidos
  for each row execute function public.pedidos_guard_colunas();

-- ---------------------------------------------------------------- CARTEIRA
alter table public.carteira enable row level security;

drop policy if exists carteira_select on public.carteira;
create policy carteira_select on public.carteira
  for select to authenticated
  using (
    cliente_user_id = auth.uid()
    or public.is_admin()
    or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id())
  );

-- O checkout do cliente cria o titulo do proprio pedido.
drop policy if exists carteira_insert on public.carteira;
create policy carteira_insert on public.carteira
  for insert to authenticated
  with check (
    cliente_user_id = auth.uid()
    or public.is_admin()
    or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id())
    or public.ve_todos_pedidos()
  );

drop policy if exists carteira_update on public.carteira;
create policy carteira_update on public.carteira
  for update to authenticated
  using (
    cliente_user_id = auth.uid()          -- envio de comprovante
    or public.is_admin()
    or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id())
  );

drop policy if exists carteira_delete on public.carteira;
create policy carteira_delete on public.carteira
  for delete to authenticated using (public.is_admin());

-- Cliente nao "se da por pago", nao muda valor e nao aprova o proprio comprovante.
create or replace function public.carteira_guard_colunas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if public.is_admin()
     or (public.app_role() = 'fornecedor' and new.fornecedor_id = public.meu_fornecedor_id()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.status, '') not in ('pendente', '') then
      raise exception 'Titulo so pode ser criado como pendente';
    end if;
    new.data_pagamento        := null;
    new.comprovante_aprovado  := null;
    new.comprovante_analisado := null;
    return new;
  end if;

  if new.valor                is distinct from old.valor
     or new.status               is distinct from old.status and coalesce(new.status,'') not in ('em_analise')
     or new.data_pagamento       is distinct from old.data_pagamento
     or new.comprovante_aprovado is distinct from old.comprovante_aprovado
     or new.cliente_user_id      is distinct from old.cliente_user_id then
    raise exception 'Somente a equipe pode dar baixa, alterar valor ou aprovar comprovante';
  end if;
  return new;
end $$;

drop trigger if exists trg_carteira_guard_colunas on public.carteira;
create trigger trg_carteira_guard_colunas
  before insert or update on public.carteira
  for each row execute function public.carteira_guard_colunas();

-- ------------------------------------------------------------------- LOJAS
alter table public.lojas enable row level security;

drop policy if exists lojas_insert on public.lojas;
create policy lojas_insert on public.lojas
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists lojas_update on public.lojas;
create policy lojas_update on public.lojas
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists lojas_delete on public.lojas;
create policy lojas_delete on public.lojas
  for delete to authenticated using (public.is_admin());

-- ------------------------------------------------- MOVIMENTACOES DE ESTOQUE
alter table public.movimentacoes_estoque enable row level security;

drop policy if exists movimentacoes_all on public.movimentacoes_estoque;
create policy movimentacoes_all on public.movimentacoes_estoque
  for all to authenticated
  using (public.pode_gerir_catalogo() or public.is_admin())
  with check (public.pode_gerir_catalogo() or public.is_admin());

-- ------------------------------------------------------------- FATURAMENTOS
alter table public.faturamentos enable row level security;

drop policy if exists faturamentos_select on public.faturamentos;
create policy faturamentos_select on public.faturamentos
  for select to authenticated
  using (
    public.ve_todos_pedidos()
    or exists (
      select 1 from public.pedidos p
      where p.id = faturamentos.pedido_id
        and (p.comprador_user_id = auth.uid()
             or (public.app_role() = 'fornecedor' and p.fornecedor_id = public.meu_fornecedor_id()))
    )
  );

drop policy if exists faturamentos_write on public.faturamentos;
create policy faturamentos_write on public.faturamentos
  for all to authenticated
  using (public.is_admin() or public.app_role() = 'fornecedor')
  with check (public.is_admin() or public.app_role() = 'fornecedor');

-- ----------------------------------------------------- CRM / METAS / ADMIN
alter table public.contacts enable row level security;
drop policy if exists contacts_admin on public.contacts;
create policy contacts_admin on public.contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.metas enable row level security;
drop policy if exists metas_select on public.metas;
create policy metas_select on public.metas
  for select to authenticated
  using (public.is_admin()
         or user_id = auth.uid()
         or (public.app_role() = 'fornecedor' and fornecedor_id = public.meu_fornecedor_id()));
drop policy if exists metas_write on public.metas;
create policy metas_write on public.metas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.whatsapp_templates enable row level security;
drop policy if exists whatsapp_admin on public.whatsapp_templates;
create policy whatsapp_admin on public.whatsapp_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.pending_users enable row level security;
drop policy if exists pending_users_admin on public.pending_users;
create policy pending_users_admin on public.pending_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.franqueados enable row level security;
drop policy if exists franqueados_admin on public.franqueados;
create policy franqueados_admin on public.franqueados
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------- CONTEUDO (leitura ampla)
alter table public.banners enable row level security;
drop policy if exists banners_select on public.banners;
create policy banners_select on public.banners
  for select to authenticated using (true);
drop policy if exists banners_write on public.banners;
create policy banners_write on public.banners
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.recursos enable row level security;
drop policy if exists recursos_select on public.recursos;
create policy recursos_select on public.recursos
  for select to authenticated using (true);
drop policy if exists recursos_write on public.recursos;
create policy recursos_write on public.recursos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.carrinho_itens enable row level security;
