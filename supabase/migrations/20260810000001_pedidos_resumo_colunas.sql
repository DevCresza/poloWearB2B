-- As listas de pedido (PedidosAdmin) so precisam de duas coisas vindas do itens
-- (jsonb pesado, ~1.5KB/pedido): total de pecas e os meses de entrega. Ler o
-- itens de milhares de pedidos custava ~4.6s e estourava o statement_timeout.
-- Aqui esses dois valores viram COLUNAS pre-calculadas por trigger, para a
-- listagem ler so escalares (~56ms) sem tocar no itens.

alter table public.pedidos
  add column if not exists qtd_pecas integer not null default 0,
  add column if not exists meses_entrega text[] not null default '{}';

-- Deriva as duas colunas a partir do itens (mesma regra da tela:
-- grade conta total_pecas_grade, avulso conta 1; mes vem de item.mes_entrega).
create or replace function public.pedidos_calc_resumo()
returns trigger
language plpgsql
as $$
declare
  v_pecas integer := 0;
  v_meses text[] := '{}';
begin
  if new.itens is not null and jsonb_typeof(new.itens) = 'array' then
    select coalesce(sum(
             (coalesce((e->>'quantidade')::numeric, 0))
             * case when (e->>'tipo_venda') = 'grade'
                         and coalesce((e->>'total_pecas_grade')::numeric,0) > 0
                    then (e->>'total_pecas_grade')::numeric else 1 end
           ), 0)::integer,
           coalesce(array_agg(distinct (e->>'mes_entrega'))
                    filter (where (e->>'mes_entrega') is not null), '{}')
      into v_pecas, v_meses
    from jsonb_array_elements(new.itens) e;
  end if;
  new.qtd_pecas := v_pecas;
  new.meses_entrega := v_meses;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_calc_resumo on public.pedidos;
create trigger trg_pedidos_calc_resumo
  before insert or update of itens on public.pedidos
  for each row execute function public.pedidos_calc_resumo();

-- Backfill do historico (dispara o trigger reescrevendo itens = itens).
update public.pedidos set itens = itens;
