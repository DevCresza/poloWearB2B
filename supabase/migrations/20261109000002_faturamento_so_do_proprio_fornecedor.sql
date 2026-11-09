-- Fornecedor so escreve no faturamento do PROPRIO pedido.
--
-- A policy anterior era:
--
--   using/with check (is_admin() or app_role() = 'fornecedor')
--
-- Ou seja: bastava ser fornecedor. Qualquer um deles podia alterar ou apagar
-- o faturamento de qualquer outro -- numero de NF, valor, boleto, arquivos.
--
-- Na pratica era dificil de explorar, porque faturamentos_select ja recorta a
-- LEITURA pelo proprio fornecedor e sem conseguir listar nao da para saber o
-- id alheio. Mas id de outra pessoa vazar nao e hipotese remota (ele aparece
-- em log, em export, em URL), e a diferenca entre "nao consegue ver" e "nao
-- consegue escrever" e justamente o que uma policy de escrita existe para
-- garantir. A condicao agora e a mesma da leitura.
--
-- Verificado antes de aplicar: os 932 faturamentos existentes tem pedido com
-- fornecedor_id preenchido, entao nenhum fornecedor perde acesso ao que ja e
-- dele. Testado com rollback: o fornecedor atualiza o proprio (1 linha) e nao
-- atualiza o do vizinho (0 linhas).

drop policy if exists faturamentos_write on public.faturamentos;

create policy faturamentos_write on public.faturamentos
  for all to authenticated
  using (
    public.is_admin()
    or (public.app_role() = 'fornecedor' and exists (
          select 1 from public.pedidos p
           where p.id = faturamentos.pedido_id
             and p.fornecedor_id = public.meu_fornecedor_id()))
  )
  with check (
    public.is_admin()
    or (public.app_role() = 'fornecedor' and exists (
          select 1 from public.pedidos p
           where p.id = faturamentos.pedido_id
             and p.fornecedor_id = public.meu_fornecedor_id()))
  );
