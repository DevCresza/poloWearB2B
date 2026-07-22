-- users.total_vencido era mantido pelo bloqueio automatico por atraso, que foi
-- desligado (bloqueio virou decisao manual do admin). Sem ninguem atualizando,
-- o campo congelou e passou a marcar como "Cliente Inadimplente" quem ja tinha
-- pago -- PedidosFornecedor.jsx e PortalDashboard.jsx leem esse campo --,
-- levando fornecedores a cancelar pedidos indevidamente.
--
-- Aqui o campo passa a ser DERIVADO da carteira, nunca escrito na mao.

create or replace function public.recalcular_total_vencido(p_user_id uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users u
     set total_vencido = coalesce((
           select sum(c.valor)
             from public.carteira c
            where c.cliente_user_id = u.id
              and c.status = 'pendente'
              and c.parcela_numero is not null   -- ignora placeholder sem parcela real
              and c.data_vencimento < current_date
         ), 0)
   where (p_user_id is null or u.id = p_user_id)
     and coalesce(u.total_vencido, 0) is distinct from coalesce((
           select sum(c.valor)
             from public.carteira c
            where c.cliente_user_id = u.id
              and c.status = 'pendente'
              and c.parcela_numero is not null
              and c.data_vencimento < current_date
         ), 0);
$$;

-- Atualiza na hora em que um titulo muda (ex: admin clica "Registrar como pago").
create or replace function public.carteira_sync_total_vencido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalcular_total_vencido(coalesce(new.cliente_user_id, old.cliente_user_id));
  return null;
end;
$$;

drop trigger if exists trg_carteira_sync_total_vencido on public.carteira;
create trigger trg_carteira_sync_total_vencido
  after insert or update or delete on public.carteira
  for each row execute function public.carteira_sync_total_vencido();

-- Um titulo tambem vence pela passagem do tempo, sem nenhuma alteracao de linha
-- (o trigger acima nao pega esse caso). Dai o recalculo diario.
select cron.schedule('recalcular-total-vencido', '10 6 * * *',
                     $$select public.recalcular_total_vencido();$$);

-- Corrige o acumulado historico.
select public.recalcular_total_vencido();
