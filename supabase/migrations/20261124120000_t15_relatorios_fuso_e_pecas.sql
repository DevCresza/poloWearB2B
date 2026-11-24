-- T15 (M4 e M5 do diagnostico de 23/11): relatorios certos.
--
-- 1) M4 -- pecas por tamanho. Regra unica, em SQL (public.pecas_item) e no JS
--    (src/utils/itemPedido.js -> pecasDoItem):
--      grade SEM tamanho_selecionado e total_pecas_grade > 0
--          -> quantidade x total_pecas_grade
--      qualquer outro caso (por tamanho, unitario/avulso) -> quantidade
--    Aplicada em pedidos_calc_resumo (qtd_pecas), metas_realizado e
--    get_produtos_mais_vendidos (que multiplicava ate item UNITARIO pela grade).
--
-- 2) M5 -- fuso. created_date, nf_data_upload, data_aprovacao e users.created_at
--    sao `timestamp` SEM fuso, gravados em UTC. Dia e mes passam a ser os de
--    Brasilia (public.data_br). Excecao: valor exatamente a meia-noite e uma
--    DATA digitada (o front grava a emissao da NF como 'YYYY-MM-DDT00:00:00')
--    e nao se converte. "Hoje" passa a ser public.hoje_br().
--    Aplicada em calc_meses_entrega_efetivos, recalcular_totais_cliente,
--    kpis_dashboard_admin (mes da NF e evolucao diaria), metas_realizado
--    (limites do mes) e na view carteira_com_pedido (emissao/faturamento).
--
-- 3) Os 4 comportamentos mantidos de proposito no PR #11, agora corrigidos:
--    a) titulo que vence HOJE nao e vencido: vencido = data_vencimento < hoje
--       (kpis_dashboard; o front passa hojeBR() em p_corte_vencimento);
--    b) "clientes novos" (30 dias) por users.created_at (kpis_dashboard_admin);
--    c) evolucao diaria por intervalo [dia, dia+1), sem perder o 23:59:59;
--    d) titulo sem data nao e vencido nem "a vencer": vai em sem_vencimento.
--
-- Assinaturas nao mudam (create or replace): os grants ficam como estao e o
-- front antigo continua funcionando (ele ja manda p_hoje/p_corte = hoje local).
--
-- Dados: nenhum backfill necessario. Conferido em 24/11 antes de aplicar:
--   * 0 itens de pedido com tamanho_selecionado preenchido -> qtd_pecas igual
--     em todos os 7.581 pedidos (soma 2.740.530 antes e depois);
--   * 0 pedidos com meses_entrega_efetivos diferente pela troca de fuso.
--   Se aparecerem, o recalculo e o script supabase/scripts/t15_recalcular_resumo_pedidos.sql.
--
-- Rollback: supabase/scripts/t15_rollback_funcoes.sql (as definicoes de antes,
-- tiradas do banco em 24/11), e depois
--   drop function if exists public.pecas_item(jsonb);
--   drop function if exists public.data_br(timestamp without time zone);
--   drop function if exists public.hoje_br();
--   drop function if exists public.inicio_dia_br_utc(date);

-- ------------------------------------------------------------- helpers --

-- Dia em Brasilia de um timestamp sem fuso gravado em UTC.
-- Meia-noite exata = data digitada (nao converte).
create or replace function public.data_br(p_ts timestamp without time zone)
returns date
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select case
           when p_ts is null then null
           when p_ts::time = time '00:00' then p_ts::date
           else ((p_ts at time zone 'UTC') at time zone 'America/Sao_Paulo')::date
         end
$$;

-- Hoje em Brasilia.
create or replace function public.hoje_br()
returns date
language sql
stable
parallel safe
set search_path to 'public'
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Meia-noite de Brasilia do dia p_dia, como timestamp UTC sem fuso (o
-- referencial das colunas). Para filtrar created_date por intervalo e usar
-- indice: created_date >= inicio_dia_br_utc(d) and < inicio_dia_br_utc(d + 1).
create or replace function public.inicio_dia_br_utc(p_dia date)
returns timestamp without time zone
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select (p_dia::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC'
$$;

-- Pecas de um item de pedido (regra unica, igual a pecasDoItem do front).
create or replace function public.pecas_item(e jsonb)
returns numeric
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select public.jsonb_num(e->'quantidade')
         * case when e->>'tipo_venda' = 'grade'
                 and nullif(e->>'tamanho_selecionado', '') is null
                 and public.jsonb_num(e->'total_pecas_grade') > 0
                then public.jsonb_num(e->'total_pecas_grade')
                else 1 end
$$;

revoke all on function public.data_br(timestamp without time zone) from public, anon;
revoke all on function public.hoje_br() from public, anon;
revoke all on function public.inicio_dia_br_utc(date) from public, anon;
revoke all on function public.pecas_item(jsonb) from public, anon;
grant execute on function public.data_br(timestamp without time zone) to authenticated;
grant execute on function public.hoje_br() to authenticated;
grant execute on function public.inicio_dia_br_utc(date) to authenticated;
grant execute on function public.pecas_item(jsonb) to authenticated;

-- --------------------------------------------------- pedidos_calc_resumo --
-- qtd_pecas pela regra unica (antes: item por tamanho multiplicava pela grade).
-- jsonb_num em vez de ::numeric: texto nao numerico vira 0 em vez de abortar.
create or replace function public.pedidos_calc_resumo()
returns trigger
language plpgsql
as $function$
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
$function$;

-- --------------------------------------------- calc_meses_entrega_efetivos --
-- Ultimo recurso (sem mes do item, do produto ou do pedido): o mes da data do
-- pedido EM BRASILIA. Antes, o pedido das 21h-24h do ultimo dia ia para o
-- mes seguinte.
create or replace function public.calc_meses_entrega_efetivos(p_itens jsonb, p_data_prevista date, p_created timestamp without time zone)
returns text[]
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(array_agg(distinct m order by m), '{}')
    from (
      select coalesce(
               nullif(left(e->>'mes_entrega', 7), ''),
               to_char(pr.data_prevista_entrega, 'YYYY-MM'),
               to_char(coalesce(p_data_prevista, public.data_br(p_created)), 'YYYY-MM')
             ) as m
        from jsonb_array_elements(
               case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end
             ) e
        left join public.produtos pr
          on pr.id = case
                       when (e->>'produto_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                       then (e->>'produto_id')::uuid
                     end
    ) x
   where m is not null;
$function$;

-- ------------------------------------------------ recalcular_totais_cliente --
-- Vencido = pendente com vencimento ANTES de hoje em Brasilia. Antes era
-- current_date (UTC): entre 21h e 24h, o titulo que vence hoje ja contava.
-- O cron roda as 06:10 UTC (03:10 em Brasilia), quando as duas datas sao
-- iguais; a diferenca e so nos recalculos disparados pela carteira a noite.
-- Bloqueio NAO e automatico (users.bloqueado e decisao do admin); isto muda
-- so o total_vencido mostrado.
create or replace function public.recalcular_totais_cliente(p_user_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hoje date := public.hoje_br();
begin
  perform set_config('app.recalc_totais', '1', true);

  with derivado as (
    select u.id,
           coalesce(sum(c.valor) filter (
             where c.status in ('pendente', 'em_analise')
           ), 0) as aberto,
           coalesce(sum(c.valor) filter (
             where c.status = 'pendente'
               and c.data_vencimento < v_hoje
           ), 0) as vencido
      from public.users u
      left join public.carteira c
             on c.cliente_user_id = u.id
            and c.parcela_numero is not null
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

  perform set_config('app.recalc_totais', '', true);
end;
$function$;

-- ---------------------------------------------------------- kpis_dashboard --
-- p_corte_vencimento agora e HOJE (Brasilia): vencido = data < hoje.
-- Titulo sem data sai de "vencido" e vai para sem_vencimento.
-- (O front antigo ja mandava a data de hoje nesse parametro e comparava com
-- <=; com < o titulo que vence hoje deixa de contar como vencido.)
create or replace function public.kpis_dashboard(p_corte_vencimento date, p_fornecedor_id uuid default null::uuid, p_comprador_user_id uuid default null::uuid, p_loja_id uuid default null::uuid, p_produtos_fornecedor_id uuid default null::uuid)
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

-- ---------------------------------------------------- kpis_dashboard_admin --
-- p_hoje: hoje em Brasilia. p_agora: agora em UTC sem fuso (o referencial das
-- colunas; o front novo manda assim). Mudancas:
--   * mes da NF (nf_data_upload) pelo dia em Brasilia;
--   * evolucao: dia em Brasilia, intervalo [p_hoje-29, p_hoje+1) inteiro
--     (antes o 23:59:59 ficava de fora);
--   * clientes_novos: clientes com users.created_at nos ultimos 30 dias.
create or replace function public.kpis_dashboard_admin(p_hoje date, p_agora timestamp without time zone)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with ped as materialized (
    select p.id, p.status, p.fornecedor_id, p.comprador_user_id,
           p.created_date, p.data_aprovacao, p.nf_data_upload,
           p.valor_total, p.valor_final, p.valor_faturado,
           case when p.nf_data_upload is not null
                then array[to_char(public.data_br(p.nf_data_upload), 'YYYY-MM')]
                else p.meses_entrega_efetivos end as meses
      from public.pedidos p
  ),
  por_mes as (
    select m.mes,
           coalesce(sum(ped.valor_faturado) filter (where ped.status in ('finalizado','faturado','em_transporte','pendente_pagamento')), 0) as valor_f4,
           count(*) filter (where ped.status in ('finalizado','faturado','em_transporte','pendente_pagamento')) as qtd_f4,
           coalesce(sum(ped.valor_faturado) filter (where ped.status in ('faturado','parcialmente_faturado','em_transporte','pendente_pagamento','finalizado')), 0) as valor_f5,
           count(*) filter (where ped.status in ('faturado','parcialmente_faturado','em_transporte','pendente_pagamento','finalizado')) as qtd_f5
      from ped
      cross join lateral (select distinct x as mes from unnest(ped.meses) x where x is not null) m
     group by m.mes
  ),
  f4 as (select * from ped where status in ('finalizado','faturado','em_transporte','pendente_pagamento')),
  por_fornecedor as (
    select coalesce(nullif(f.nome_marca, ''), nullif(f.razao_social, ''), f.nome_fantasia) as nome,
           coalesce(sum(f4.valor_faturado), 0) as valor, count(*) as pedidos
      from public.fornecedores f join f4 on f4.fornecedor_id = f.id
     group by f.id
    having coalesce(sum(f4.valor_faturado), 0) > 0
  ),
  clientes as (
    select u.* from public.users u
     where u.tipo_negocio in ('multimarca', 'franqueado') or u.categoria_cliente = 'franqueado'
  ),
  top_clientes as (
    select coalesce(nullif(u.empresa, ''), nullif(u.razao_social, ''), nullif(u.nome_marca, ''), u.full_name) as nome,
           coalesce(sum(f4.valor_faturado), 0) as valor, count(*) as pedidos
      from clientes u join f4 on f4.comprador_user_id = u.id
     group by u.id, u.empresa, u.razao_social, u.nome_marca, u.full_name
    having coalesce(sum(f4.valor_faturado), 0) > 0
     order by 2 desc limit 10
  ),
  mais_vendidos as (
    select e->>'nome' as nome,
           sum(public.jsonb_num(e->'quantidade')) as quantidade,
           sum(public.jsonb_num(e->'preco') * public.jsonb_num(e->'quantidade')) as valor
      from public.pedidos p
      cross join lateral jsonb_array_elements(case when jsonb_typeof(p.itens) = 'array' then p.itens else '[]'::jsonb end) e
     where p.status in ('finalizado','faturado','em_transporte','pendente_pagamento')
     group by e->>'nome' order by 3 desc limit 10
  ),
  evolucao as (
    select public.data_br(ped.created_date) as dia, count(*) as pedidos,
           coalesce(sum(coalesce(nullif(ped.valor_final, 0), nullif(ped.valor_total, 0), 0)), 0) as valor
      from ped
     where ped.status is distinct from 'cancelado'
       and ped.created_date >= public.inicio_dia_br_utc(p_hoje - 29)
       and ped.created_date <  public.inicio_dia_br_utc(p_hoje + 1)
     group by 1
  ),
  atrasados as (
    select ped.id, ped.status, ped.created_date, ped.comprador_user_id, ped.fornecedor_id
      from ped
     where (ped.status = 'aprovado' and ped.data_aprovacao is not null and ped.data_aprovacao <= p_agora - interval '8 days')
        or (ped.status = 'em_producao' and ped.created_date <= p_agora - interval '16 days')
        or (ped.status = 'faturado' and ped.nf_data_upload is not null and ped.nf_data_upload <= p_agora - interval '6 days')
  ),
  atrasados_top as (
    select a.id, a.status, a.created_date,
           coalesce(nullif(u.empresa, ''), nullif(u.razao_social, ''), nullif(u.nome_marca, ''), nullif(u.full_name, ''), 'Desconhecido') as cliente_nome,
           coalesce(nullif(f.nome_marca, ''), 'Desconhecido') as fornecedor_nome
      from atrasados a
      left join public.users u on u.id = a.comprador_user_id
      left join public.fornecedores f on f.id = a.fornecedor_id
     order by a.created_date desc limit 10
  )
  select jsonb_build_object(
    'por_mes',          coalesce((select jsonb_agg(to_jsonb(por_mes)) from por_mes), '[]'::jsonb),
    'por_fornecedor',   coalesce((select jsonb_agg(to_jsonb(x) order by x.valor desc) from por_fornecedor x), '[]'::jsonb),
    'top_clientes',     coalesce((select jsonb_agg(to_jsonb(x) order by x.valor desc) from top_clientes x), '[]'::jsonb),
    'mais_vendidos',    coalesce((select jsonb_agg(to_jsonb(x) order by x.valor desc) from mais_vendidos x), '[]'::jsonb),
    'evolucao',         coalesce((select jsonb_agg(to_jsonb(evolucao)) from evolucao), '[]'::jsonb),
    'atrasados_total',  (select count(*) from atrasados),
    'atrasados',        coalesce((select jsonb_agg(to_jsonb(x) order by x.created_date desc) from atrasados_top x), '[]'::jsonb),
    'clientes_ativos',     (select count(*) from clientes where bloqueado is not true),
    'clientes_bloqueados', (select count(*) from clientes where bloqueado is true),
    'clientes_novos',      (select count(*) from clientes where created_at >= p_agora - interval '30 days'))
$function$;

-- --------------------------------------------------------- metas_realizado --
-- Mes da meta em Brasilia ([1o dia 00:00 BRT, 1o dia do mes seguinte 00:00 BRT)
-- convertidos para UTC) e pecas pela regra unica (grade por tamanho = pecas).
create or replace function public.metas_realizado(p_ano integer, p_mes integer)
returns table(meta_id uuid, valor_realizado numeric, pecas_realizadas numeric)
language sql
stable
set search_path to 'public'
as $function$
  with m as (
    select mt.id, mt.fornecedor_id, mt.user_id,
           public.inicio_dia_br_utc(make_date(mt.ano, mt.mes, 1)) as inicio,
           public.inicio_dia_br_utc((make_date(mt.ano, mt.mes, 1) + interval '1 month')::date) as fim
      from public.metas mt where mt.ano = p_ano and mt.mes = p_mes
  ),
  ped as (
    select m.id as meta_id, p.id as pedido_id, p.itens,
           coalesce(nullif(p.valor_final, 0), nullif(p.valor_total, 0), 0) as valor
      from m
      join public.pedidos p
        on p.status in ('finalizado', 'faturado', 'em_transporte', 'em_producao', 'pendente_pagamento')
       and p.created_date >= m.inicio and p.created_date < m.fim
       and case when m.fornecedor_id is not null then p.fornecedor_id = m.fornecedor_id
                when m.user_id is not null then p.comprador_user_id = m.user_id
                else true end
  ),
  pecas as (
    select ped.meta_id,
           sum(case
               when e->>'tipo_venda' = 'grade' and nullif(e->>'tamanho_selecionado', '') is not null then
                 public.jsonb_num(e->'quantidade')
               when e->>'tipo_venda' = 'grade' then
                 public.jsonb_num(e->'quantidade') *
                 coalesce(nullif(public.jsonb_num(e->'total_pecas_grade'), 0),
                          (select coalesce(sum(public.jsonb_num(v)), 0)
                             from jsonb_each(case when jsonb_typeof(e->'grade_selecionada'->'quantidades_por_tamanho') = 'object'
                                                  then e->'grade_selecionada'->'quantidades_por_tamanho' else '{}'::jsonb end) q(k, v)),
                          0)
               when e->>'tipo' = 'capsula' then
                 case when jsonb_typeof(e->'produtos_quantidades') in ('object', 'array') then
                        (select coalesce(sum(public.jsonb_num(v)), 0)
                           from jsonb_each(case when jsonb_typeof(e->'produtos_quantidades') = 'object'
                                                then e->'produtos_quantidades' else '{}'::jsonb end) q(k, v))
                        * coalesce(nullif(public.jsonb_num(e->'quantidade'), 0), 1)
                      else public.jsonb_num(e->'quantidade') end
               else public.jsonb_num(e->'quantidade')
             end) as pecas
      from ped
      cross join lateral jsonb_array_elements(case when jsonb_typeof(ped.itens) = 'array' then ped.itens else '[]'::jsonb end) e
     group by ped.meta_id
  )
  select m.id,
         coalesce((select sum(ped.valor) from ped where ped.meta_id = m.id), 0),
         coalesce((select pecas.pecas from pecas where pecas.meta_id = m.id), 0)
    from m
$function$;

-- ---------------------------------------------- get_produtos_mais_vendidos --
-- Antes: quantidade x GREATEST(total_pecas_grade, 1) para QUALQUER item, ate
-- unitario. Agora a regra unica (pecas_item).
create or replace function public.get_produtos_mais_vendidos()
returns table(produto_id uuid, total_vendido bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  WITH itens_expandidos AS (
    SELECT
      it->>'produto_id'          AS pid,
      it->>'tipo'                AS tipo,
      COALESCE((it->>'quantidade')::numeric, 0)        AS quantidade,
      public.pecas_item(it)      AS pecas,
      it->'produtos_quantidades' AS produtos_quantidades
    FROM pedidos p
    CROSS JOIN LATERAL jsonb_array_elements(p.itens) AS it
    WHERE p.status <> 'cancelado'
      AND p.itens IS NOT NULL
      AND jsonb_typeof(p.itens) = 'array'
  ),
  -- Produtos comuns (vendidos por grade, por tamanho ou unitario)
  vendas_produtos AS (
    SELECT
      pid::uuid AS produto_id,
      SUM(pecas) AS total
    FROM itens_expandidos
    WHERE tipo IS DISTINCT FROM 'capsula'
      AND pid IS NOT NULL
      AND pid !~ '^capsula-'
      AND pid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY pid
  ),
  -- Capsulas: distribui as vendas para os produtos internos
  vendas_capsulas AS (
    SELECT
      (pq.key)::uuid AS produto_id,
      SUM(
        ie.quantidade *
        CASE
          WHEN jsonb_typeof(pq.value) = 'number' THEN (pq.value #>> '{}')::numeric
          WHEN jsonb_typeof(pq.value->'variantes') = 'array' THEN COALESCE((
            SELECT SUM(COALESCE((v->>'quantidade')::numeric, 0))
            FROM jsonb_array_elements(pq.value->'variantes') v
          ), 0)
          ELSE 0
        END
      ) AS total
    FROM itens_expandidos ie
    CROSS JOIN LATERAL jsonb_each(ie.produtos_quantidades) AS pq
    WHERE ie.tipo = 'capsula'
      AND ie.produtos_quantidades IS NOT NULL
      AND jsonb_typeof(ie.produtos_quantidades) = 'object'
      AND pq.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY pq.key
  )
  SELECT
    combined.produto_id,
    SUM(combined.total)::bigint AS total_vendido
  FROM (
    SELECT produto_id, total FROM vendas_produtos
    UNION ALL
    SELECT produto_id, total FROM vendas_capsulas
  ) combined
  GROUP BY combined.produto_id
  HAVING SUM(combined.total) > 0
  ORDER BY total_vendido DESC;
$function$;

-- ----------------------------------------------------- carteira_com_pedido --
-- pedido_emissao / pedido_faturamento: dia em Brasilia (antes ::date em UTC).
-- Mesmas colunas, mesma ordem e tipos: create or replace preserva grants.
create or replace view public.carteira_com_pedido
with (security_invoker = true)
as
 SELECT c.id,
    c.pedido_id,
    c.cliente_user_id,
    c.fornecedor_id,
    c.loja_id,
    c.parcela_numero,
    c.tipo,
    c.descricao,
    c.valor,
    c.status,
    c.data_vencimento,
    c.data_pagamento,
    c.data_pagamento_informada,
    c.observacoes,
    c.comprovante_url,
    c.comprovante_analisado,
    c.comprovante_aprovado,
    c.motivo_recusa_comprovante,
    p.id AS pedido_encontrado_id,
    p.status AS pedido_status,
    p.created_date AS pedido_created_date,
    p.nf_data_upload AS pedido_nf_data_upload,
    p.fornecedor_id AS pedido_fornecedor_id,
    COALESCE(NULLIF((u.empresa)::text, ''::text), NULLIF((u.razao_social)::text, ''::text), NULLIF((u.nome_marca)::text, ''::text), NULLIF((u.full_name)::text, ''::text),
        CASE
            WHEN (u.id IS NOT NULL) THEN 'Cliente'::text
            ELSE NULL::text
        END) AS cliente_nome,
    (c.pedido_id)::text AS pedido_id_texto,
    upper("right"((c.pedido_id)::text, 8)) AS numero_pedido,
    public.data_br(p.created_date) AS pedido_emissao,
    public.data_br(p.nf_data_upload) AS pedido_faturamento,
    ((COALESCE(c.parcela_numero, 0) <> 0) AND ((p.status IS NULL) OR ((p.status)::text <> ALL ((ARRAY['novo_pedido'::character varying, 'cancelado'::character varying])::text[])))) AS cobravel_cliente,
    count(*) OVER w_ped AS parcela_total,
    row_number() OVER w_ord AS parcela_ordem,
    count(*) FILTER (WHERE (COALESCE(c.parcela_numero, 0) <> 0)) OVER w_ped AS parcela_total_cobraveis,
    count(*) FILTER (WHERE (COALESCE(c.parcela_numero, 0) <> 0)) OVER w_ord AS parcela_ordem_cobraveis
   FROM ((carteira c
     LEFT JOIN pedidos p ON ((p.id = c.pedido_id)))
     LEFT JOIN users u ON ((u.id = c.cliente_user_id)))
  WINDOW w_ped AS (PARTITION BY c.pedido_id), w_ord AS (PARTITION BY c.pedido_id ORDER BY c.data_vencimento NULLS FIRST, c.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW);
