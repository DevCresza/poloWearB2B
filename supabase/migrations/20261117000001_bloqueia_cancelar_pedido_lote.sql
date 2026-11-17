-- Pedido emitido em lote pela administracao (coluna emitido_por_admin_user_id
-- preenchida, so a emissao em lote faz isso) so pode ser CANCELADO pela
-- administracao. Fornecedor e cliente perdem o botao na tela, mas a trava de
-- verdade e esta: bloqueia a mudanca de status para 'cancelado' por quem nao e
-- admin (nem service_role das Edge Functions).

create or replace function public.pedidos_bloqueia_cancelar_lote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelado'
     and old.status is distinct from 'cancelado'
     and old.emitido_por_admin_user_id is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and public.app_role() is distinct from 'admin' then
    raise exception 'Pedido emitido em lote pela administracao: somente a administracao pode cancelar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_bloqueia_cancelar_lote on public.pedidos;
create trigger trg_pedidos_bloqueia_cancelar_lote
  before update of status on public.pedidos
  for each row execute function public.pedidos_bloqueia_cancelar_lote();
