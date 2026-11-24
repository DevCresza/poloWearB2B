-- T19 (M15, M16 e "Higiene de funcoes" do diagnostico de 23/11): RLS mais rapida.
--
-- 1) M15: as policies chamavam auth.uid(), app_role(), is_admin(),
--    ve_todos_pedidos(), meu_fornecedor_id() UMA VEZ POR LINHA. app_role() e
--    meu_fornecedor_id() fazem um SELECT em users cada uma, entao ler 1000
--    pedidos custava milhares de buscas em users. Com `(select f())` o
--    Postgres avalia a funcao uma vez por consulta (InitPlan) e reaproveita o
--    valor. As funcoes sao STABLE e so dependem do usuario logado, entao o
--    resultado e o mesmo: muda o custo, nao a regra.
--
-- 2) M15: as policies `_write` em ALL somavam com as `_select` em todo SELECT
--    (advisor multiple_permissive_policies). Viraram tres: INSERT, UPDATE e
--    DELETE, com a mesma expressao. Em todas elas a expressao do `_write` ja
--    estava contida na do `_select`, entao o SELECT nao perde nem ganha linha.
--
-- 3) M15: pedido_notifications_sent tinha duas policies de SELECT que liam
--    users.role e users.tipo_negocio direto. Viraram uma so, com app_role()
--    (role e a fonte de verdade; tipo_negocio e igual ao role em todos os
--    usuarios, conferido em 23/11).
--
-- 4) M16: sai o indice duplicado de franqueados (idx_franqueados_codigo
--    repete a unique franqueados_codigo_franquia_key).
--
-- 5) Higiene: search_path fixo nas 5 funcoes do advisor
--    function_search_path_mutable, e funcoes de trigger sem EXECUTE para
--    public/anon/authenticated (trigger dispara sem checar EXECUTE; ninguem
--    precisa chama-las por /rpc). As funcoes usadas nas policies (app_role,
--    is_admin, is_staff, ve_todos_pedidos, meu_fornecedor_id,
--    pode_gerir_catalogo) MANTEM o EXECUTE de authenticated.
--
-- Testado em producao dentro de transacao desfeita, simulando admin,
-- vendedor, cadastro, fornecedor, multimarca e franqueado (set role
-- authenticated + request.jwt.claims): para cada tabela, as linhas visiveis
-- (contagem + hash dos ids) e o resultado de INSERT, UPDATE e DELETE numa
-- amostra de linhas sao identicos antes e depois. Numeros no PR.
-- (M19, movimentacoes_estoque, ja foi em 20261124113754.)
--
-- PENDENTE: tem DROP POLICY (pede Accept do dono) e trava tabelas por
-- instantes -- aplicar depois das 20h. Renomear o arquivo para a versao que o
-- apply_migration gravar.
--
-- Rollback: ver o bloco comentado no fim do arquivo.

set local lock_timeout = '3s';

-- ================================================ M15: so (select ...) -- --
-- pedidos (pedidos_select ja aplicada: 20261124113000)
alter policy pedidos_update on public.pedidos
  using (
    comprador_user_id = (select auth.uid())
    or (select public.ve_todos_pedidos())
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id()))
  );
-- pedidos_insert: ja e (select is_admin()) desde a fase 2 do T8/T9; nao mexer.
alter policy pedidos_delete on public.pedidos
  using ((select public.is_admin()));

-- carteira (carteira_select ja aplicada: 20261124113000)
alter policy carteira_update on public.carteira
  using (
    cliente_user_id = (select auth.uid())
    or (select public.is_admin())
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id()))
  );
-- carteira_insert: ja reescrita na fase 2 do T8/T9; nao mexer.
alter policy carteira_delete on public.carteira
  using ((select public.is_admin()));

-- users (users_select_self_or_staff ja aplicada: 20261124113000)
alter policy users_update_self_or_admin on public.users
  using (id = (select auth.uid()) or (select public.app_role()) = 'admin')
  with check (id = (select auth.uid()) or (select public.app_role()) = 'admin');
alter policy users_insert_self_or_admin on public.users
  with check (id = (select auth.uid()) or (select public.app_role()) = 'admin');
alter policy users_delete_admin on public.users
  using ((select public.app_role()) = 'admin');

-- lojas
alter policy lojas_select on public.lojas
  using (
    user_id = (select auth.uid())
    or (select public.app_role()) = any (array['admin', 'vendedor'])
    or ((select public.app_role()) = 'fornecedor' and exists (
          select 1 from public.pedidos p
           where p.loja_id = lojas.id
             and p.fornecedor_id = (select public.meu_fornecedor_id())))
  );
alter policy lojas_update on public.lojas
  using (user_id = (select auth.uid()) or (select public.is_admin()));
alter policy lojas_insert on public.lojas
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
alter policy lojas_delete on public.lojas
  using ((select public.is_admin()));

-- faturamentos (select; o _write e separado mais abaixo)
alter policy faturamentos_select on public.faturamentos
  using (
    (select public.ve_todos_pedidos())
    or exists (
      select 1 from public.pedidos p
       where p.id = faturamentos.pedido_id
         and (p.comprador_user_id = (select auth.uid())
              or ((select public.app_role()) = 'fornecedor' and p.fornecedor_id = (select public.meu_fornecedor_id()))))
  );

-- pedido_historico
alter policy pedido_historico_select on public.pedido_historico
  using (
    (select public.ve_todos_pedidos())
    or exists (
      select 1 from public.pedidos p
       where p.id = pedido_historico.pedido_id
         and (p.comprador_user_id = (select auth.uid())
              or ((select public.app_role()) = 'fornecedor' and p.fornecedor_id = (select public.meu_fornecedor_id()))))
  );

-- metas (select; o _write e separado mais abaixo)
alter policy metas_select on public.metas
  using (
    (select public.is_admin())
    or user_id = (select auth.uid())
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id()))
  );

-- produtos
alter policy produtos_insert on public.produtos
  with check (
    (select public.app_role()) = any (array['admin', 'cadastro'])
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id()))
  );
alter policy produtos_update on public.produtos
  using (
    (select public.app_role()) = any (array['admin', 'cadastro'])
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id()))
  );
alter policy produtos_delete on public.produtos
  using ((select public.is_admin()));

-- notificacoes (o INSERT "Service can insert notifications" nao muda)
alter policy "Users can view own notifications" on public.notificacoes
  using ((select auth.uid()) = usuario_id);
alter policy "Users can update own notifications" on public.notificacoes
  using ((select auth.uid()) = usuario_id);
alter policy "Users can delete own notifications" on public.notificacoes
  using ((select auth.uid()) = usuario_id);

-- tabelas so de admin (uma policy ALL, sem soma com outra)
alter policy app_settings_admin   on public.app_settings       using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy carrinho_itens_admin on public.carrinho_itens     using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy contacts_admin       on public.contacts           using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy franqueados_admin    on public.franqueados        using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy health_checks_admin  on public.health_checks      using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy pending_users_admin  on public.pending_users      using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy whatsapp_admin       on public.whatsapp_templates using ((select public.is_admin())) with check ((select public.is_admin()));

-- pedido_notifications_sent: duas policies de SELECT viram uma, com app_role().
alter policy "Admin le todas notificacoes" on public.pedido_notifications_sent
  using (
    (select public.app_role()) = 'admin'
    or ((select public.app_role()) = 'fornecedor' and exists (
          select 1 from public.pedidos p
           where p.id = pedido_notifications_sent.pedido_id
             and p.fornecedor_id = (select public.meu_fornecedor_id())))
  );
alter policy "Admin le todas notificacoes" on public.pedido_notifications_sent
  rename to pedido_notifications_sent_select;
drop policy "Fornecedor le notificacoes dos pedidos dele" on public.pedido_notifications_sent;

-- ============================ M15: `_write` em ALL vira INSERT/UPDATE/DELETE --
-- banners, recursos, metas: so admin escreve.
drop policy banners_write on public.banners;
create policy banners_insert on public.banners for insert to authenticated with check ((select public.is_admin()));
create policy banners_update on public.banners for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy banners_delete on public.banners for delete to authenticated using ((select public.is_admin()));

drop policy recursos_write on public.recursos;
create policy recursos_insert on public.recursos for insert to authenticated with check ((select public.is_admin()));
create policy recursos_update on public.recursos for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy recursos_delete on public.recursos for delete to authenticated using ((select public.is_admin()));

drop policy metas_write on public.metas;
create policy metas_insert on public.metas for insert to authenticated with check ((select public.is_admin()));
create policy metas_update on public.metas for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy metas_delete on public.metas for delete to authenticated using ((select public.is_admin()));

-- capsulas: admin, cadastro e o fornecedor dono.
drop policy capsulas_write on public.capsulas;
create policy capsulas_insert on public.capsulas for insert to authenticated
  with check ((select public.app_role()) = any (array['admin', 'cadastro'])
              or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id())));
create policy capsulas_update on public.capsulas for update to authenticated
  using ((select public.app_role()) = any (array['admin', 'cadastro'])
         or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id())))
  with check ((select public.app_role()) = any (array['admin', 'cadastro'])
              or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id())));
create policy capsulas_delete on public.capsulas for delete to authenticated
  using ((select public.app_role()) = any (array['admin', 'cadastro'])
         or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id())));

-- fornecedores: admin e o proprio fornecedor.
drop policy fornecedores_write on public.fornecedores;
create policy fornecedores_insert on public.fornecedores for insert to authenticated
  with check ((select public.is_admin())
              or ((select public.app_role()) = 'fornecedor' and id = (select public.meu_fornecedor_id())));
create policy fornecedores_update on public.fornecedores for update to authenticated
  using ((select public.is_admin())
         or ((select public.app_role()) = 'fornecedor' and id = (select public.meu_fornecedor_id())))
  with check ((select public.is_admin())
              or ((select public.app_role()) = 'fornecedor' and id = (select public.meu_fornecedor_id())));
create policy fornecedores_delete on public.fornecedores for delete to authenticated
  using ((select public.is_admin())
         or ((select public.app_role()) = 'fornecedor' and id = (select public.meu_fornecedor_id())));

-- faturamentos: admin e o fornecedor do pedido.
drop policy faturamentos_write on public.faturamentos;
create policy faturamentos_insert on public.faturamentos for insert to authenticated
  with check ((select public.is_admin())
              or ((select public.app_role()) = 'fornecedor' and exists (
                    select 1 from public.pedidos p
                     where p.id = faturamentos.pedido_id
                       and p.fornecedor_id = (select public.meu_fornecedor_id()))));
create policy faturamentos_update on public.faturamentos for update to authenticated
  using ((select public.is_admin())
         or ((select public.app_role()) = 'fornecedor' and exists (
               select 1 from public.pedidos p
                where p.id = faturamentos.pedido_id
                  and p.fornecedor_id = (select public.meu_fornecedor_id()))))
  with check ((select public.is_admin())
              or ((select public.app_role()) = 'fornecedor' and exists (
                    select 1 from public.pedidos p
                     where p.id = faturamentos.pedido_id
                       and p.fornecedor_id = (select public.meu_fornecedor_id()))));
create policy faturamentos_delete on public.faturamentos for delete to authenticated
  using ((select public.is_admin())
         or ((select public.app_role()) = 'fornecedor' and exists (
               select 1 from public.pedidos p
                where p.id = faturamentos.pedido_id
                  and p.fornecedor_id = (select public.meu_fornecedor_id()))));

-- ====================================================================== M16 --
drop index if exists public.idx_franqueados_codigo;

-- ========================================================= Higiene de funcoes --
alter function public.update_updated_at_column()       set search_path = public, pg_temp;
alter function public.update_notificacoes_updated_at() set search_path = public, pg_temp;
alter function public.perform_health_check()           set search_path = public, pg_temp;
alter function public.valida_boleto_prazos(jsonb)      set search_path = public, pg_temp;
alter function public.pedidos_calc_resumo()            set search_path = public, pg_temp;

-- Funcoes de trigger: ninguem precisa chama-las direto.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end;
$$;

-- ================================================================ Rollback --
-- Rodar como uma migracao so (tem DROP: pede Accept).
--
-- drop policy banners_insert on public.banners; drop policy banners_update on public.banners; drop policy banners_delete on public.banners;
-- create policy banners_write on public.banners for all to authenticated using (is_admin()) with check (is_admin());
-- drop policy recursos_insert on public.recursos; drop policy recursos_update on public.recursos; drop policy recursos_delete on public.recursos;
-- create policy recursos_write on public.recursos for all to authenticated using (is_admin()) with check (is_admin());
-- drop policy metas_insert on public.metas; drop policy metas_update on public.metas; drop policy metas_delete on public.metas;
-- create policy metas_write on public.metas for all to authenticated using (is_admin()) with check (is_admin());
-- drop policy capsulas_insert on public.capsulas; drop policy capsulas_update on public.capsulas; drop policy capsulas_delete on public.capsulas;
-- create policy capsulas_write on public.capsulas for all to authenticated
--   using ((app_role() = any (array['admin','cadastro'])) or ((app_role() = 'fornecedor') and (fornecedor_id = meu_fornecedor_id())))
--   with check ((app_role() = any (array['admin','cadastro'])) or ((app_role() = 'fornecedor') and (fornecedor_id = meu_fornecedor_id())));
-- drop policy fornecedores_insert on public.fornecedores; drop policy fornecedores_update on public.fornecedores; drop policy fornecedores_delete on public.fornecedores;
-- create policy fornecedores_write on public.fornecedores for all to authenticated
--   using (is_admin() or ((app_role() = 'fornecedor') and (id = meu_fornecedor_id())))
--   with check (is_admin() or ((app_role() = 'fornecedor') and (id = meu_fornecedor_id())));
-- drop policy faturamentos_insert on public.faturamentos; drop policy faturamentos_update on public.faturamentos; drop policy faturamentos_delete on public.faturamentos;
-- create policy faturamentos_write on public.faturamentos for all to authenticated
--   using (is_admin() or ((app_role() = 'fornecedor') and exists (select 1 from pedidos p where p.id = faturamentos.pedido_id and p.fornecedor_id = meu_fornecedor_id())))
--   with check (is_admin() or ((app_role() = 'fornecedor') and exists (select 1 from pedidos p where p.id = faturamentos.pedido_id and p.fornecedor_id = meu_fornecedor_id())));
-- alter policy pedido_notifications_sent_select on public.pedido_notifications_sent rename to "Admin le todas notificacoes";
-- alter policy "Admin le todas notificacoes" on public.pedido_notifications_sent
--   using (exists (select 1 from users where users.id = auth.uid() and users.role::text = 'admin'));
-- create policy "Fornecedor le notificacoes dos pedidos dele" on public.pedido_notifications_sent for select to authenticated
--   using (exists (select 1 from users u join pedidos p on p.fornecedor_id = u.fornecedor_id
--                   where u.id = auth.uid() and u.tipo_negocio::text = 'fornecedor' and p.id = pedido_notifications_sent.pedido_id));
-- create index if not exists idx_franqueados_codigo on public.franqueados (codigo_franquia);
-- alter function public.update_updated_at_column() reset search_path;   (idem nas outras 4)
-- grant execute on function <cada funcao de trigger de public> to public, anon, authenticated;
-- Demais policies: alter policy ... com a mesma expressao sem o `(select ...)`, ex.:
--   alter policy pedidos_update on public.pedidos using ((comprador_user_id = auth.uid()) or ve_todos_pedidos() or ((app_role() = 'fornecedor') and (fornecedor_id = meu_fornecedor_id())));
--   alter policy carteira_update on public.carteira using ((cliente_user_id = auth.uid()) or is_admin() or ((app_role() = 'fornecedor') and (fornecedor_id = meu_fornecedor_id())));
--   (o estado anterior completo de pg_policies esta no PR)
