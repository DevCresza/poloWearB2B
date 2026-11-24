-- Conciliação de 24/11/2026 (T15, achado do PR #27): 7 pedidos com
-- meses_entrega_efetivos desatualizado. Aprovado pelo dono.
--
-- Causa: nos 7, o fornecedor preencheu a data prevista do PRÓPRIO pedido no
-- aceite (data_prevista_entrega de null para 15/11 ou 01/12, em 10 e 11/11).
-- Os itens sem mes_entrega cujo produto não tem data prevista caem nessa data
-- (regra de calc_meses_entrega_efetivos), mas o trigger trg_pedidos_calc_resumo
-- só dispara em UPDATE OF itens, então a coluna ficou com o valor antigo (o mês
-- de criação do pedido, ou sem o mês novo). Não foi a data do produto.
--
-- Correção: meses_entrega_efetivos = calc_meses_entrega_efetivos(itens,
-- data_prevista_entrega, created_date), a mesma regra da propagação
-- (produtos_propagar_meses_pedidos). Os 7 estão em em_producao, sem NF.
--
--   pedido    antes                  depois
--   80E8BFD2  {2026-07,2026-10}      {2026-07,2026-10,2026-12}
--   6212B9D7  {2026-07,2026-10}      {2026-07,2026-10,2026-12}
--   631E03CE  {2026-07}              {2026-11}
--   BF222E17  {2026-09}              {2026-09,2026-11}
--   07073D85  {2026-09}              {2026-09,2026-11}
--   867E9708  {2026-07,2026-10}      {2026-07,2026-10,2026-11}
--   A5729910  {2026-07,2026-10}      {2026-07,2026-10,2026-11}
--
-- Só a coluna meses_entrega_efetivos muda. Os triggers de pedidos ficam
-- desligados DENTRO da transação com session_replication_role = replica (sem
-- travar a tabela, ao contrário de "alter table ... disable trigger"): sem
-- webhook notify-pedido (e-mail), sem linha em pedido_historico, e updated_at
-- não muda.
--
-- KPIs: kpis_dashboard_admin só soma em por_mes os status faturado em diante;
-- os 7 estão em produção, então o KPI não muda. O que muda é o filtro "mês de
-- entrega" de PedidosAdmin / PedidosFornecedor / MeusPedidos e as exportações
-- (exportUtils), que leem a coluna.
--
-- Backup: backups._t15_meses_20261124_pedidos (as 7 linhas inteiras antes).
-- Rollback: supabase/conciliacao/20261124_t15_meses_entrega_7_pedidos_rollback.sql
--
-- Aplicado em produção em 24/11/2026 (~09:55 de Brasília), depois do teste
-- em transação desfeita (script + rollback). Rodar de novo falha na primeira
-- conferência (0 divergentes e o backup já existe), sem efeito.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- KPI do admin antes (data e hora fixas, para comparar).
create temp table t15_kpi_antes as
select public.kpis_dashboard_admin(date '2026-11-24', timestamp '2026-11-24 12:00') as k;

-- 1) Backup dos 7, conferindo que são exatamente os divergentes de hoje.
create table backups._t15_meses_20261124_pedidos as
select p.*
  from public.pedidos p
 where p.id in ('148e9027-6326-4f01-975e-095680e8bfd2',
                'b584496a-3616-467f-bb17-a2546212b9d7',
                'fab7df88-5cb2-4583-b6b3-119c631e03ce',
                '5d71c9ec-b7f9-4cda-95ae-6809bf222e17',
                '1c0aa929-c091-40ff-99db-128a07073d85',
                '9b98b6cc-364b-474c-acf9-8b23867e9708',
                '639f79dc-7c97-4064-84b3-7210a5729910');
alter table backups._t15_meses_20261124_pedidos enable row level security;

do $$
declare n int; n_div int; n_fora int;
begin
  select count(*) into n from backups._t15_meses_20261124_pedidos;
  select count(*) into n_div from public.pedidos p
   where p.meses_entrega_efetivos is distinct from
         public.calc_meses_entrega_efetivos(p.itens, p.data_prevista_entrega, p.created_date);
  select count(*) into n_fora from public.pedidos p
   where p.meses_entrega_efetivos is distinct from
         public.calc_meses_entrega_efetivos(p.itens, p.data_prevista_entrega, p.created_date)
     and p.id not in (select id from backups._t15_meses_20261124_pedidos);
  if n <> 7 or n_div <> 7 or n_fora <> 0 then
    raise exception 'Esperado 7 pedidos divergentes e todos no backup; backup=% divergentes=% fora_do_backup=%',
      n, n_div, n_fora;
  end if;
end $$;

-- 2) Atualização, com os triggers de usuário desligados só aqui.
set local session_replication_role = replica;

update public.pedidos p
   set meses_entrega_efetivos =
         public.calc_meses_entrega_efetivos(p.itens, p.data_prevista_entrega, p.created_date)
  from backups._t15_meses_20261124_pedidos b
 where b.id = p.id
   and p.nf_data_upload is null;

set local session_replication_role = origin;

-- 3) Conferências.
do $$
declare v_ok int; v_div int; v_hist int; v_kpi boolean;
begin
  -- Os 7 batem com a regra e nada além da coluna mudou.
  select count(*) into v_ok
    from public.pedidos p join backups._t15_meses_20261124_pedidos b on b.id = p.id
   where p.meses_entrega_efetivos =
         public.calc_meses_entrega_efetivos(p.itens, p.data_prevista_entrega, p.created_date)
     and p.meses_entrega_efetivos is distinct from b.meses_entrega_efetivos
     and p.updated_at is not distinct from b.updated_at
     and (to_jsonb(p) - 'meses_entrega_efetivos') = (to_jsonb(b) - 'meses_entrega_efetivos');
  -- Nenhum pedido divergente no banco.
  select count(*) into v_div from public.pedidos p
   where p.meses_entrega_efetivos is distinct from
         public.calc_meses_entrega_efetivos(p.itens, p.data_prevista_entrega, p.created_date);
  -- Sem histórico novo.
  select count(*) into v_hist from public.pedido_historico h
    join backups._t15_meses_20261124_pedidos b on b.id = h.pedido_id
   where h.quando > now() - interval '5 minutes';
  -- KPI do admin igual.
  select (select k from t15_kpi_antes)
         = public.kpis_dashboard_admin(date '2026-11-24', timestamp '2026-11-24 12:00')
    into v_kpi;
  if v_ok <> 7 or v_div <> 0 or v_hist <> 0 or not v_kpi then
    raise exception 'Conferência falhou: ok=% (7) divergentes=% (0) historico=% (0) kpi_igual=%',
      v_ok, v_div, v_hist, v_kpi;
  end if;
end $$;

commit;
