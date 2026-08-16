-- Sequencia de 20260722000001_recalcular_total_vencido.sql.
--
-- Aquela migration derivou users.total_vencido da carteira, mas deixou
-- users.total_em_aberto de fora. O campo continuou sendo escrito pelo cliente
-- (CarteiraFinanceira.jsx e PedidoDetailsModal.jsx) e so quando o proprio
-- cliente abria a tela -- se ele nunca logasse, congelava. Pior: dois desses
-- pontos somavam os placeholders da carteira (linhas sem parcela_numero, que o
-- Carrinho cria no checkout antes de existir boleto) e um deles filtrava por
-- loja selecionada, gravando o total de UMA loja no campo do usuario.
-- Resultado: 16 de 182 clientes divergiam -- R$ 54.714,83 gravado contra
-- R$ 159.684,75 reais.
--
-- Agora os dois campos sao derivados pela mesma regra, num unico lugar.
-- "Em aberto" = parcela real (parcela_numero not null, ou seja, ja tem boleto)
-- ainda nao quitada. "Vencido" = o subconjunto dela que passou do vencimento.

create or replace function public.recalcular_totais_cliente(p_user_id uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  with derivado as (
    select u.id,
           coalesce(sum(c.valor) filter (
             where c.status in ('pendente', 'em_analise')
           ), 0) as aberto,
           coalesce(sum(c.valor) filter (
             where c.status = 'pendente'
               and c.data_vencimento < current_date
           ), 0) as vencido
      from public.users u
      left join public.carteira c
             on c.cliente_user_id = u.id
            and c.parcela_numero is not null  -- ignora placeholder sem boleto
     where (p_user_id is null or u.id = p_user_id)
     group by u.id
  )
  update public.users u
     set total_em_aberto = d.aberto,
         total_vencido   = d.vencido
    from derivado d
   where u.id = d.id
     and (coalesce(u.total_em_aberto, 0) is distinct from d.aberto
       or coalesce(u.total_vencido, 0)   is distinct from d.vencido);
$$;

-- Atualiza na hora em que um titulo muda (ex: admin clica "Registrar como pago").
create or replace function public.carteira_sync_totais()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalcular_totais_cliente(coalesce(new.cliente_user_id, old.cliente_user_id));
  -- Uma parcela pode ser reatribuida de cliente; nesse caso os dois lados mudam.
  if tg_op = 'UPDATE'
     and new.cliente_user_id is distinct from old.cliente_user_id then
    perform public.recalcular_totais_cliente(old.cliente_user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_carteira_sync_total_vencido on public.carteira;
drop trigger if exists trg_carteira_sync_totais on public.carteira;
create trigger trg_carteira_sync_totais
  after insert or update or delete on public.carteira
  for each row execute function public.carteira_sync_totais();

drop function if exists public.carteira_sync_total_vencido();
drop function if exists public.recalcular_total_vencido(uuid);

-- Um titulo tambem vence pela passagem do tempo, sem nenhuma alteracao de linha
-- (o trigger acima nao pega esse caso). Dai o recalculo diario.
select cron.unschedule('recalcular-total-vencido')
 where exists (select 1 from cron.job where jobname = 'recalcular-total-vencido');

select cron.unschedule('recalcular-totais-carteira')
 where exists (select 1 from cron.job where jobname = 'recalcular-totais-carteira');

select cron.schedule('recalcular-totais-carteira', '10 6 * * *',
                     $$select public.recalcular_totais_cliente();$$);

-- Corrige o acumulado historico.
select public.recalcular_totais_cliente();
