-- T19 / M15, parte ja aplicada: tres policies de SELECT com as funcoes
-- avaliadas uma vez por consulta (`(select f())`), mesma regra de antes.
--
-- APLICADO EM 24/11/2026 entre 11:28 e 11:35 UTC, por engano: era uma
-- sondagem de tempo que deveria terminar em erro proposital (rollback) e foi
-- efetivada. O coordenador conferiu e decidiu manter -- e exatamente o estado
-- final planejado. Conferido logo depois, por papel: linhas visiveis em
-- pedidos/carteira/users iguais as esperadas (fornecedor so as dele,
-- franqueado e multimarca so as proprias, admin tudo, cadastro so o proprio
-- usuario) e nenhum erro novo nos logs. Este arquivo existe para o
-- repositorio bater com o banco.
--
-- Rollback (expressao antiga, sem o select):
--   alter policy pedidos_select on public.pedidos using ((comprador_user_id = auth.uid()) or ve_todos_pedidos() or ((app_role() = 'fornecedor') and (fornecedor_id = meu_fornecedor_id())));
--   alter policy carteira_select on public.carteira using ((cliente_user_id = auth.uid()) or is_admin() or ((app_role() = 'fornecedor') and (fornecedor_id = meu_fornecedor_id())));
--   alter policy users_select_self_or_staff on public.users using ((id = auth.uid()) or (app_role() = any (array['admin','vendedor'])) or ((app_role() = 'fornecedor') and exists (select 1 from pedidos p where p.comprador_user_id = users.id and p.fornecedor_id = meu_fornecedor_id())));

alter policy pedidos_select on public.pedidos
  using (comprador_user_id = (select auth.uid()) or (select public.ve_todos_pedidos())
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id())));

alter policy carteira_select on public.carteira
  using (cliente_user_id = (select auth.uid()) or (select public.is_admin())
    or ((select public.app_role()) = 'fornecedor' and fornecedor_id = (select public.meu_fornecedor_id())));

alter policy users_select_self_or_staff on public.users
  using (id = (select auth.uid()) or (select public.app_role()) = any (array['admin', 'vendedor'])
    or ((select public.app_role()) = 'fornecedor' and exists (
          select 1 from public.pedidos p
           where p.comprador_user_id = users.id
             and p.fornecedor_id = (select public.meu_fornecedor_id()))));
