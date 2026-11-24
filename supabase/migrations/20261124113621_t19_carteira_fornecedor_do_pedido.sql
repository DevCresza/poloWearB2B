-- T19: carteira.fornecedor_id preenchido nos titulos provisorios.
--
-- Achado de 24/11: 7.580 titulos (80% da carteira) estavam com fornecedor_id
-- nulo -- todos os provisorios (parcela_numero nulo, 1 por pedido, criados no
-- checkout). As parcelas reais ja tinham. Como carteira_select recorta o
-- fornecedor por essa coluna, ele nao via os provisorios dos proprios pedidos.
--
-- Decisao do dono (opcao a): a coluna fica correta (derivada do pedido, com
-- trigger) e o que o fornecedor VE na tela nao muda: a Carteira dele, os cards
-- (carteira_resumo) e o painel (kpis_dashboard) continuam contando so os
-- titulos com parcela, como ja acontecia. Conferido para os 31 usuarios
-- fornecedores, antes e depois, numa transacao desfeita: lista, parcela X/Y,
-- carteira_resumo, kpis_dashboard (com e sem filtro) e os totais do admin --
-- 0 diferencas; nenhum fornecedor_id nulo depois (numeros no PR).
--
-- APLICADO EM 24/11/2026 11:36 UTC via apply_migration e, 18 s depois,
-- ADIADO por 20261124113639_t19_carteira_fornecedor_adiado_ate_front.sql: o
-- front em producao ainda nao filtrava as parcelas na lista do fornecedor.
-- Ficam no ar a funcao do trigger (trigger desligado), o backup e as versoes
-- novas de carteira_resumo/kpis_dashboard (com a coluna nula dao o mesmo
-- resultado de antes). O preenchimento definitivo e o
-- supabase/scripts/t19_carteira_pos_merge.sql, depois do merge do PR.
--
-- Rollback:
--   --   drop function if exists public.carteira_fornecedor_do_pedido();
--   update public.carteira c set fornecedor_id = null
--     from backups._t19_carteira_fornecedor_nulo b where b.id = c.id;   -- com session_replication_role = replica
--   carteira_resumo / kpis_dashboard: versao de 20261123233919_kpis_paginas_pesadas.sql
--   (a linha `and (c.parcela_numero is not null or ...)` sai).

set local lock_timeout = '3s';

-- 1) Backup das linhas que vao mudar (so o id e o valor antigo da coluna).
create table if not exists backups._t19_carteira_fornecedor_nulo as
  select c.id, c.pedido_id, c.fornecedor_id
    from public.carteira c
   where c.fornecedor_id is null;
revoke all on backups._t19_carteira_fornecedor_nulo from public, anon, authenticated;

-- 2) Trigger: fornecedor_id vem sempre do pedido. Nome com "a_" para rodar
--    antes de trg_carteira_guard_colunas (triggers BEFORE vao em ordem
--    alfabetica): o guard ja ve o valor final.
create or replace function public.carteira_fornecedor_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.pedido_id is not null then
    new.fornecedor_id := coalesce(
      (select p.fornecedor_id from public.pedidos p where p.id = new.pedido_id),
      new.fornecedor_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.carteira_fornecedor_do_pedido() from public, anon, authenticated;

create trigger trg_carteira_a_fornecedor_do_pedido
  before insert or update of pedido_id, fornecedor_id on public.carteira
  for each row execute function public.carteira_fornecedor_do_pedido();

-- 3) Backfill sem disparar os triggers da carteira: o notify-pedido mandaria
--    e-mail/WhatsApp por linha, e os totais do cliente nao dependem desta
--    coluna.
set local session_replication_role = replica;
update public.carteira c
   set fornecedor_id = p.fornecedor_id
  from public.pedidos p
 where p.id = c.pedido_id
   and c.fornecedor_id is null
   and p.fornecedor_id is not null;
set local session_replication_role = origin;

-- 4) Cards e painel: o recorte de fornecedor continua so com parcelas.
--    Antes da coluna ser preenchida, "c.fornecedor_id = X" so pegava parcela e
--    o fornecedor (pela RLS) so enxergava parcela. A linha nova reproduz isso.
create or replace function public.carteira_resumo(
  p_hoje date,
  p_cliente_user_id uuid default null,
  p_loja_id uuid default null,
  p_fornecedor_id uuid default null,
  p_somente_cobraveis boolean default false)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
           'total_titulos',  count(*),
           'total_aberto',   coalesce(sum(c.valor) filter (where c.status = 'pendente'), 0),
           'total_vencido',  coalesce(sum(c.valor) filter (where c.status = 'pendente' and c.data_vencimento < p_hoje), 0),
           'proximos',       count(*) filter (where c.status = 'pendente' and c.data_vencimento >= p_hoje and c.data_vencimento <= p_hoje + 7),
           'total_pago',     coalesce(sum(c.valor) filter (where c.status = 'pago'), 0))
    from public.carteira c
    left join public.pedidos p on p.id = c.pedido_id
   where (p_cliente_user_id is null or c.cliente_user_id = p_cliente_user_id)
     and (p_loja_id is null or c.loja_id = p_loja_id)
     and (p_fornecedor_id is null or c.fornecedor_id = p_fornecedor_id)
     -- T19: provisorio (sem parcela) nao entra no recorte de fornecedor.
     and (c.parcela_numero is not null
          or (p_fornecedor_id is null and (select public.app_role()) is distinct from 'fornecedor'))
     and (not p_somente_cobraveis
          or (coalesce(c.parcela_numero, 0) <> 0
              and (p.status is null or p.status not in ('novo_pedido', 'cancelado'))))
$function$;

create or replace function public.kpis_dashboard(
  p_corte_vencimento date,
  p_fornecedor_id uuid default null,
  p_comprador_user_id uuid default null,
  p_loja_id uuid default null,
  p_produtos_fornecedor_id uuid default null)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with ped as (
    select p.status, count(*) as qtd,
           coalesce(sum(p.valor_total), 0) as valor_total,
           coalesce(sum(p.valor_faturado), 0) as valor_faturado,
           coalesce(sum(p.valor_quebra), 0) as valor_quebra
      from public.pedidos p
     where (p_fornecedor_id is null or p.fornecedor_id = p_fornecedor_id)
       and (p_comprador_user_id is null or p.comprador_user_id = p_comprador_user_id)
       and (p_loja_id is null or p.loja_id = p_loja_id)
     group by p.status
  ),
  cart as (
    select coalesce(sum(c.valor), 0) as em_aberto,
           coalesce(sum(c.valor) filter (where c.data_vencimento >= p_corte_vencimento), 0) as a_vencer,
           coalesce(sum(c.valor) filter (where c.data_vencimento < p_corte_vencimento), 0) as vencido,
           coalesce(sum(c.valor) filter (where c.data_vencimento is null), 0) as sem_vencimento,
           count(*) filter (where c.data_vencimento is null) as qtd_sem_vencimento
      from public.carteira c
     where c.status = 'pendente'
       and (p_fornecedor_id is null or c.fornecedor_id = p_fornecedor_id)
       -- T19: provisorio (sem parcela) nao entra no recorte de fornecedor.
       and (c.parcela_numero is not null
            or (p_fornecedor_id is null and (select public.app_role()) is distinct from 'fornecedor'))
       and (p_comprador_user_id is null or c.cliente_user_id = p_comprador_user_id)
       and (p_loja_id is null or c.loja_id = p_loja_id)
  ),
  prod as (
    select count(*) filter (where pr.ativo) as ativos,
           count(*) filter (where pr.controla_estoque
                              and coalesce(pr.estoque_atual_grades, 0) <= coalesce(pr.estoque_minimo_grades, 0)) as estoque_baixo
      from public.produtos pr
     where (p_produtos_fornecedor_id is null or pr.fornecedor_id = p_produtos_fornecedor_id)
  )
  select jsonb_build_object(
           'por_status', coalesce((select jsonb_agg(to_jsonb(ped)) from ped), '[]'::jsonb),
           'carteira',   (select to_jsonb(cart) from cart),
           'produtos',   (select to_jsonb(prod) from prod))
$function$;
