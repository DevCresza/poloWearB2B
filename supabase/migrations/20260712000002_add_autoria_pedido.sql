-- Autoria do pedido: quem de fato criou, e em que papel.
-- emitido_por_admin_user_id continua existindo (EmissaoLote), mas nao distingue
-- "emissao em lote do admin" de "pedido tirado pelo vendedor" — que e a query da comissao.
alter table public.pedidos
  add column if not exists criado_por_user_id uuid references public.users(id),
  add column if not exists criado_por_papel varchar(20);

alter table public.pedidos drop constraint if exists pedidos_criado_por_papel_check;
alter table public.pedidos add constraint pedidos_criado_por_papel_check
  check (criado_por_papel is null or criado_por_papel in ('cliente','vendedor','admin'));

-- Pedidos antigos ficam NULL (interpretar como 'cliente' na leitura). Sem backfill:
-- mentiria sobre os pedidos antigos emitidos em lote.
create index if not exists idx_pedidos_criado_por_user on public.pedidos (criado_por_user_id);
