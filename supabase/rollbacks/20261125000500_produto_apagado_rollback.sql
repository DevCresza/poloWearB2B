-- Rollback de supabase/migrations/20261125000500_produto_apagado_mantem_mes_e_exclusao_bloqueada.sql
--
-- Volta pedidos_calc_resumo e produtos_propagar_meses_pedidos à chamada de 3
-- argumentos (item de produto apagado volta a cair na data do pedido), tira
-- os triggers que recusam excluir produto/cápsula com pedido e remove as
-- funções novas. A tabela interno.pedidos_mes_produto_apagado fica (é só
-- leitura e não atrapalha); remover à parte se o dono quiser.
--
-- Contém DROP: o MCP pede a confirmação manual do dono. Uma chamada só.
-- Depois de aplicar, o front volta a mostrar "Excluir" só se a RPC existir:
-- sem ela, a tela esconde o Excluir (fica só o Arquivar) até reverter o front.

begin;
set local lock_timeout = '3s';

create or replace function public.pedidos_calc_resumo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pecas integer := 0;
  v_meses text[] := '{}';
begin
  if new.itens is not null and jsonb_typeof(new.itens) = 'array' then
    select coalesce(sum(public.pecas_item(e)), 0)::integer,
           coalesce(array_agg(distinct (e->>'mes_entrega'))
                    filter (where (e->>'mes_entrega') is not null), '{}')
      into v_pecas, v_meses
    from jsonb_array_elements(new.itens) e;
  end if;
  new.qtd_pecas := v_pecas;
  new.meses_entrega := v_meses;
  new.meses_entrega_efetivos := public.calc_meses_entrega_efetivos(
    new.itens, new.data_prevista_entrega, new.created_date);
  return new;
end;
$$;

create or replace function public.produtos_propagar_meses_pedidos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.data_prevista_entrega is not distinct from old.data_prevista_entrega then
    return new;
  end if;
  update public.pedidos p
     set meses_entrega_efetivos = public.calc_meses_entrega_efetivos(
           p.itens, p.data_prevista_entrega, p.created_date)
   where p.nf_data_upload is null
     and p.itens @> jsonb_build_array(jsonb_build_object('produto_id', new.id::text));
  return new;
end;
$$;

drop trigger if exists trg_produtos_bloqueia_excluir_com_pedido on public.produtos;
drop trigger if exists trg_capsulas_bloqueia_excluir_com_pedido on public.capsulas;
drop function if exists public.produtos_bloqueia_excluir_com_pedido();
drop function if exists public.capsulas_bloqueia_excluir_com_pedido();
drop function if exists public.produtos_com_pedidos(uuid[]);
drop function if exists public.capsulas_com_pedidos(uuid[]);
drop function if exists public.calc_meses_entrega_efetivos(jsonb, date, timestamp, uuid);

commit;
