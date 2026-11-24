-- Rollback da migration 20261124021645_t15_relatorios_fuso_e_pecas.
--
-- Volta as funcoes e a view para as definicoes de antes da T15 (tiradas do
-- banco de producao em 24/11; as de kpis_* / metas_realizado / view sao as da
-- migration 20261123233919_kpis_paginas_pesadas, iguais as do banco).
-- Tudo create or replace: grants preservados. Os helpers (data_br, hoje_br,
-- inicio_dia_br_utc, pecas_item) ficam; para tira-los, depois deste script:
--   drop function if exists public.pecas_item(jsonb);
--   drop function if exists public.data_br(timestamp without time zone);
--   drop function if exists public.hoje_br();
--   drop function if exists public.inicio_dia_br_utc(date);
--
-- Rodar numa transacao so:
--   begin; set local lock_timeout = '3s'; \i este arquivo; commit;
-- O front novo continua funcionando com as funcoes antigas (so perde
-- clientes_novos, que volta a 0, e sem_vencimento).


CREATE OR REPLACE FUNCTION public.pedidos_calc_resumo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
  new.meses_entrega_efetivos := public.calc_meses_entrega_efetivos(
    new.itens, new.data_prevista_entrega, new.created_date);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calc_meses_entrega_efetivos(p_itens jsonb, p_data_prevista date, p_created timestamp without time zone)
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(distinct m order by m), '{}')
    from (
      select coalesce(
               nullif(left(e->>'mes_entrega', 7), ''),
               to_char(pr.data_prevista_entrega, 'YYYY-MM'),
               to_char(coalesce(p_data_prevista, p_created::date), 'YYYY-MM')
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

CREATE OR REPLACE FUNCTION public.recalcular_totais_cliente(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform set_config('app.recalc_totais', '1', true);

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

CREATE OR REPLACE FUNCTION public.get_produtos_mais_vendidos()
 RETURNS TABLE(produto_id uuid, total_vendido bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH itens_expandidos AS (
    SELECT
      it->>'produto_id'          AS pid,
      it->>'tipo'                AS tipo,
      COALESCE((it->>'quantidade')::numeric, 0)        AS quantidade,
      COALESCE((it->>'total_pecas_grade')::numeric, 0) AS total_pecas_grade,
      it->'produtos_quantidades' AS produtos_quantidades
    FROM pedidos p
    CROSS JOIN LATERAL jsonb_array_elements(p.itens) AS it
    WHERE p.status <> 'cancelado'
      AND p.itens IS NOT NULL
      AND jsonb_typeof(p.itens) = 'array'
  ),
  vendas_produtos AS (
    SELECT
      pid::uuid AS produto_id,
      SUM(quantidade * GREATEST(total_pecas_grade, 1)) AS total
    FROM itens_expandidos
    WHERE tipo IS DISTINCT FROM 'capsula'
      AND pid IS NOT NULL
      AND pid !~ '^capsula-'
      AND pid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    GROUP BY pid
  ),
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

create or replace function public.kpis_dashboard(
  p_corte_vencimento   date,
  p_fornecedor_id      uuid default null,
  p_comprador_user_id  uuid default null,
  p_loja_id            uuid default null,
  p_produtos_fornecedor_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
  with ped as (
    select p.status,
           count(*)                                   as qtd,
           coalesce(sum(p.valor_total), 0)            as valor_total,
           coalesce(sum(p.valor_faturado), 0)         as valor_faturado,
           coalesce(sum(p.valor_quebra), 0)           as valor_quebra
      from public.pedidos p
     where (p_fornecedor_id     is null or p.fornecedor_id     = p_fornecedor_id)
       and (p_comprador_user_id is null or p.comprador_user_id = p_comprador_user_id)
       and (p_loja_id           is null or p.loja_id           = p_loja_id)
     group by p.status
  ),
  cart as (
    select coalesce(sum(c.valor), 0) as em_aberto,
           coalesce(sum(c.valor) filter (where c.data_vencimento > p_corte_vencimento), 0) as a_vencer,
           -- data nula: new Date(null) e 1970, entao o JS contava como vencido.
           coalesce(sum(c.valor) filter (where c.data_vencimento is null
                                            or c.data_vencimento <= p_corte_vencimento), 0) as vencido
      from public.carteira c
     where c.status = 'pendente'
       and (p_fornecedor_id     is null or c.fornecedor_id   = p_fornecedor_id)
       and (p_comprador_user_id is null or c.cliente_user_id = p_comprador_user_id)
       and (p_loja_id           is null or c.loja_id         = p_loja_id)
  ),
  prod as (
    select count(*) filter (where pr.ativo) as ativos,
           -- JS: null <= null e verdadeiro (os dois viram 0).
           count(*) filter (where pr.controla_estoque
                              and coalesce(pr.estoque_atual_grades, 0) <= coalesce(pr.estoque_minimo_grades, 0)) as estoque_baixo
      from public.produtos pr
     where (p_produtos_fornecedor_id is null or pr.fornecedor_id = p_produtos_fornecedor_id)
  )
  select jsonb_build_object(
           'por_status', coalesce((select jsonb_agg(to_jsonb(ped)) from ped), '[]'::jsonb),
           'carteira',   (select to_jsonb(cart) from cart),
           'produtos',   (select to_jsonb(prod) from prod)
         )
$$;

create or replace function public.kpis_dashboard_admin(
  p_hoje   date,
  p_agora  timestamp without time zone
)
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
  with ped as materialized (
    select p.id, p.status, p.fornecedor_id, p.comprador_user_id,
           p.created_date, p.data_aprovacao, p.nf_data_upload,
           p.valor_total, p.valor_final, p.valor_faturado,
           -- getMesesFaturamentoPedido: com NF vale o mes da nota; sem NF, a
           -- coluna resolvida no banco (migration 20261109000004).
           case when p.nf_data_upload is not null
                then array[to_char(p.nf_data_upload, 'YYYY-MM')]
                else p.meses_entrega_efetivos end as meses
      from public.pedidos p
  ),
  -- F5: faturado/parcial/transporte/pagamento/finalizado (cards do mes).
  -- F4: o mesmo sem parcialmente_faturado (graficos). Duas listas no JS
  -- antigo, mantidas.
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
  f4 as (
    select * from ped where status in ('finalizado','faturado','em_transporte','pendente_pagamento')
  ),
  por_fornecedor as (
    select coalesce(nullif(f.nome_marca, ''), nullif(f.razao_social, ''), f.nome_fantasia) as nome,
           coalesce(sum(f4.valor_faturado), 0) as valor,
           count(*) as pedidos
      from public.fornecedores f
      join f4 on f4.fornecedor_id = f.id
     group by f.id
    having coalesce(sum(f4.valor_faturado), 0) > 0
  ),
  clientes as (
    select u.* from public.users u
     where u.tipo_negocio in ('multimarca', 'franqueado') or u.categoria_cliente = 'franqueado'
  ),
  top_clientes as (
    select coalesce(nullif(u.empresa, ''), nullif(u.razao_social, ''), nullif(u.nome_marca, ''), u.full_name) as nome,
           coalesce(sum(f4.valor_faturado), 0) as valor,
           count(*) as pedidos
      from clientes u
      join f4 on f4.comprador_user_id = u.id
     group by u.id, u.empresa, u.razao_social, u.nome_marca, u.full_name
    having coalesce(sum(f4.valor_faturado), 0) > 0
     order by 2 desc
     limit 10
  ),
  mais_vendidos as (
    select e->>'nome' as nome,
           sum(public.jsonb_num(e->'quantidade')) as quantidade,
           sum(public.jsonb_num(e->'preco') * public.jsonb_num(e->'quantidade')) as valor
      from public.pedidos p
      cross join lateral jsonb_array_elements(case when jsonb_typeof(p.itens) = 'array' then p.itens else '[]'::jsonb end) e
     where p.status in ('finalizado','faturado','em_transporte','pendente_pagamento')
     group by e->>'nome'
     order by 3 desc
     limit 10
  ),
  evolucao as (
    select ped.created_date::date as dia,
           count(*) as pedidos,
           coalesce(sum(coalesce(nullif(ped.valor_final, 0), nullif(ped.valor_total, 0), 0)), 0) as valor
      from ped
     where ped.status is distinct from 'cancelado'
       and ped.created_date >= (p_hoje - 29)
       and ped.created_date <  (p_hoje + 1)
       -- O JS fechava o dia em 23:59:59.000: o ultimo segundo ficava de fora.
       and ped.created_date - ped.created_date::date < interval '23:59:59.001'
     group by 1
  ),
  atrasados as (
    select ped.id, ped.status, ped.created_date, ped.comprador_user_id, ped.fornecedor_id
      from ped
     where (ped.status = 'aprovado'    and ped.data_aprovacao is not null and ped.data_aprovacao <= p_agora - interval '8 days')
        or (ped.status = 'em_producao' and ped.created_date   <= p_agora - interval '16 days')
        or (ped.status = 'faturado'    and ped.nf_data_upload is not null and ped.nf_data_upload <= p_agora - interval '6 days')
  ),
  atrasados_top as (
    select a.id, a.status, a.created_date,
           coalesce(nullif(u.empresa, ''), nullif(u.razao_social, ''), nullif(u.nome_marca, ''), nullif(u.full_name, ''), 'Desconhecido') as cliente_nome,
           coalesce(nullif(f.nome_marca, ''), 'Desconhecido') as fornecedor_nome
      from atrasados a
      left join public.users u on u.id = a.comprador_user_id
      left join public.fornecedores f on f.id = a.fornecedor_id
     order by a.created_date desc
     limit 10
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
    'clientes_bloqueados', (select count(*) from clientes where bloqueado is true)
  )
$$;

create or replace function public.metas_realizado(p_ano integer, p_mes integer)
returns table (meta_id uuid, valor_realizado numeric, pecas_realizadas numeric)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with m as (
    select mt.id, mt.fornecedor_id, mt.user_id,
           make_timestamp(mt.ano, mt.mes, 1, 0, 0, 0) as inicio
      from public.metas mt
     where mt.ano = p_ano and mt.mes = p_mes
  ),
  ped as (
    select m.id as meta_id, p.id as pedido_id, p.itens,
           coalesce(nullif(p.valor_final, 0), nullif(p.valor_total, 0), 0) as valor
      from m
      join public.pedidos p
        on p.status in ('finalizado', 'faturado', 'em_transporte', 'em_producao', 'pendente_pagamento')
       and p.created_date >= m.inicio
       and p.created_date <  m.inicio + interval '1 month'
       and case when m.fornecedor_id is not null then p.fornecedor_id = m.fornecedor_id
                when m.user_id       is not null then p.comprador_user_id = m.user_id
                else true end
  ),
  pecas as (
    select ped.meta_id,
           sum(
             case
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
             end
           ) as pecas
      from ped
      cross join lateral jsonb_array_elements(case when jsonb_typeof(ped.itens) = 'array' then ped.itens else '[]'::jsonb end) e
     group by ped.meta_id
  )
  select m.id,
         coalesce((select sum(ped.valor) from ped where ped.meta_id = m.id), 0),
         coalesce((select pecas.pecas from pecas where pecas.meta_id = m.id), 0)
    from m
$$;

create or replace view public.carteira_com_pedido
with (security_invoker = true)
as
select c.id,
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
       p.id             as pedido_encontrado_id,
       p.status         as pedido_status,
       p.created_date   as pedido_created_date,
       p.nf_data_upload as pedido_nf_data_upload,
       p.fornecedor_id  as pedido_fornecedor_id,
       coalesce(nullif(u.empresa, ''), nullif(u.razao_social, ''), nullif(u.nome_marca, ''), nullif(u.full_name, ''),
                case when u.id is not null then 'Cliente' end) as cliente_nome,
       c.pedido_id::text                    as pedido_id_texto,
       upper(right(c.pedido_id::text, 8))   as numero_pedido,
       p.created_date::date                 as pedido_emissao,
       p.nf_data_upload::date               as pedido_faturamento,
       -- O cliente so ve parcela de verdade (parcela_numero) de pedido ja aceito.
       (coalesce(c.parcela_numero, 0) <> 0
          and (p.status is null or p.status not in ('novo_pedido', 'cancelado'))) as cobravel_cliente,
       count(*) over w_ped                  as parcela_total,
       row_number() over w_ord              as parcela_ordem,
       count(*) filter (where coalesce(c.parcela_numero, 0) <> 0) over w_ped as parcela_total_cobraveis,
       count(*) filter (where coalesce(c.parcela_numero, 0) <> 0) over w_ord as parcela_ordem_cobraveis
  from public.carteira c
  left join public.pedidos p on p.id = c.pedido_id
  left join public.users   u on u.id = c.cliente_user_id
window w_ped as (partition by c.pedido_id),
       w_ord as (partition by c.pedido_id order by c.data_vencimento asc nulls first, c.id
                 rows between unbounded preceding and current row);
