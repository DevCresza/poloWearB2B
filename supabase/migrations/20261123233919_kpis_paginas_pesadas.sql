-- T10 (A4 do diagnostico de 23/11): paginas que baixavam a base inteira.
--
-- DashboardAdmin, PortalDashboard e GestaoMetas baixavam pedidos.* inteiro
-- (78 MB de JSON, com o itens jsonb) so para somar e contar no navegador.
-- A CarteiraFinanceira baixava a carteira inteira e fazia um Pedido.get e um
-- User.get por titulo. Aqui a conta vai para o banco e volta so o numero.
--
-- Regras destas funcoes:
--   * SECURITY INVOKER: rodam com a RLS de quem chama. Admin ve tudo, o
--     fornecedor so o dele, o cliente so o dele -- exatamente as linhas que
--     o list() antigo devolvia. Nenhuma linha a mais.
--   * search_path fixo.
--   * Mesma conta do JS antigo, inclusive nas bordas (|| tratando 0 e '' como
--     falso, null <= null verdadeiro, etc.). Os numeros da tela nao mudam;
--     cada ponto estranho preservado esta comentado onde aparece.
--
-- Rollback:
--   drop function if exists public.carteira_resumo(date, uuid, uuid, uuid, boolean);
--   drop view if exists public.carteira_com_pedido;
--   drop function if exists public.metas_realizado(integer, integer);
--   drop function if exists public.kpis_dashboard_admin(date, timestamp without time zone);
--   drop function if exists public.kpis_dashboard(date, uuid, uuid, uuid, uuid);
--   drop function if exists public.jsonb_num(jsonb);

-- ------------------------------------------------------------- jsonb_num --
-- Number(x) || 0 do JS para um valor jsonb: numero vale, texto numerico vale,
-- o resto vira 0.
create or replace function public.jsonb_num(p jsonb)
returns numeric
language sql
immutable
set search_path to 'public'
as $$
  select case jsonb_typeof(p)
           when 'number' then (p #>> '{}')::numeric
           when 'string' then case when (p #>> '{}') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
                                   then trim(p #>> '{}')::numeric else 0 end
           when 'boolean' then case when (p #>> '{}')::boolean then 1 else 0 end
           else 0
         end
$$;

-- ---------------------------------------------------------- kpis_dashboard --
-- Os cards padronizados (DashboardKpiCards) de DashboardAdmin e
-- PortalDashboard, para qualquer papel. O chamador escolhe o recorte
-- (fornecedor, comprador, loja) do mesmo jeito que os filtros do list()
-- antigo; a RLS recorta o resto.
--
-- p_corte_vencimento: ultimo dia que a tela conta como VENCIDO. O JS antigo
-- fazia new Date('YYYY-MM-DD') < hoje-meia-noite-local; a string so-data e
-- lida como meia-noite UTC, que em Brasilia e 21h do dia anterior. Por isso
-- o titulo que vence HOJE aparecia como vencido. O front calcula o corte com
-- a mesma conta e passa aqui, entao o numero nao muda.
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

comment on function public.kpis_dashboard(date, uuid, uuid, uuid, uuid) is
  'KPIs dos cards do dashboard (pedidos por status, carteira pendente, produtos). SECURITY INVOKER: respeita a RLS de quem chama.';

-- ---------------------------------------------------- kpis_dashboard_admin --
-- Graficos e listas do DashboardAdmin. Devolve series por chave (mes
-- 'YYYY-MM', dia) e o front monta as janelas com o mesmo laco de antes, para
-- as datas sairem identicas (inclusive o setMonth do dia 31).
--
-- p_agora: relogio LOCAL do navegador, sem fuso. As colunas de data de
-- pedidos sao timestamp sem fuso e o JS as lia como hora local.
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

comment on function public.kpis_dashboard_admin(date, timestamp without time zone) is
  'Graficos e listas do DashboardAdmin (faturamento por mes, por fornecedor, top clientes, mais vendidos, evolucao diaria, atrasados). SECURITY INVOKER.';

-- --------------------------------------------------------- metas_realizado --
-- O realizado de TODAS as metas de um mes numa chamada. Antes a GestaoMetas
-- baixava pedidos inteiro uma vez por meta, em serie.
--
-- Mesma regra do JS: status de venda confirmada, created_date dentro do mes
-- da meta, recorte por fornecedor OU (senao) por cliente. Valor:
-- valor_final || valor_total. Pecas: grade = quantidade x pecas da grade
-- (com o fallback de grade_selecionada para pedido antigo); capsula = soma
-- de produtos_quantidades x (quantidade || 1); resto = quantidade.
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

comment on function public.metas_realizado(integer, integer) is
  'Valor e pecas realizados de todas as metas de um mes (mesma regra da GestaoMetas). SECURITY INVOKER.';

-- ----------------------------------------------------- carteira_com_pedido --
-- So as colunas que a CarteiraFinanceira mostra ou filtra, ja com o que ela
-- buscava pedido a pedido (status, emissao, NF, fornecedor) e cliente a
-- cliente (nome). security_invoker: a RLS de carteira, pedidos e users vale
-- para quem consulta, como valia no Pedido.get / User.get de antes.
--
-- Com isso a tela pagina e filtra no servidor. O que dependia da lista
-- inteira na memoria veio para ca:
--   * "Parcela X de Y": a ordem do titulo entre os do mesmo pedido, por
--     vencimento (nulo primeiro, como new Date(null) no sort do JS). Duas
--     contagens: com todos os titulos (admin e fornecedor viam todos) e so
--     com os cobraveis (o cliente nao via os provisorios sem parcela_numero).
--   * numero_pedido / pedido_id_texto / datas do pedido, para a busca e os
--     filtros de emissao e faturamento.
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

comment on view public.carteira_com_pedido is
  'Titulos da carteira com o resumo do pedido, o nome do cliente e a parcela X de Y, so com as colunas da CarteiraFinanceira. security_invoker; somente leitura.';

-- --------------------------------------------------------- carteira_resumo --
-- Os quatro cards da CarteiraFinanceira sobre TODOS os titulos do recorte
-- (nao so a pagina): em aberto, vencido, vence em 7 dias, pago. Aqui a data
-- era lida como data local (parseDataVenc), entao o vencido e < hoje mesmo.
create or replace function public.carteira_resumo(
  p_hoje               date,
  p_cliente_user_id    uuid    default null,
  p_loja_id            uuid    default null,
  p_fornecedor_id      uuid    default null,
  p_somente_cobraveis  boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path to 'public'
as $$
  select jsonb_build_object(
           'total_titulos',  count(*),
           'total_aberto',   coalesce(sum(c.valor) filter (where c.status = 'pendente'), 0),
           'total_vencido',  coalesce(sum(c.valor) filter (where c.status = 'pendente' and c.data_vencimento < p_hoje), 0),
           'proximos',       count(*) filter (where c.status = 'pendente' and c.data_vencimento >= p_hoje and c.data_vencimento <= p_hoje + 7),
           'total_pago',     coalesce(sum(c.valor) filter (where c.status = 'pago'), 0)
         )
    from public.carteira c
    left join public.pedidos p on p.id = c.pedido_id
   where (p_cliente_user_id is null or c.cliente_user_id = p_cliente_user_id)
     and (p_loja_id         is null or c.loja_id         = p_loja_id)
     and (p_fornecedor_id   is null or c.fornecedor_id   = p_fornecedor_id)
     and (not p_somente_cobraveis
          or (coalesce(c.parcela_numero, 0) <> 0
              and (p.status is null or p.status not in ('novo_pedido', 'cancelado'))))
$$;

comment on function public.carteira_resumo(date, uuid, uuid, uuid, boolean) is
  'Totais dos cards da CarteiraFinanceira sobre o recorte inteiro. SECURITY INVOKER.';

-- So leitura: escreve-se sempre em carteira.
revoke all on public.carteira_com_pedido from anon, public;
revoke insert, update, delete, truncate, references, trigger on public.carteira_com_pedido from authenticated;
grant select on public.carteira_com_pedido to authenticated;

-- Funcoes: so para logados.
revoke all on function public.kpis_dashboard(date, uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.kpis_dashboard_admin(date, timestamp without time zone) from public, anon;
revoke all on function public.metas_realizado(integer, integer) from public, anon;
revoke all on function public.jsonb_num(jsonb) from public, anon;
revoke all on function public.carteira_resumo(date, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.carteira_resumo(date, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.kpis_dashboard(date, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.kpis_dashboard_admin(date, timestamp without time zone) to authenticated;
grant execute on function public.metas_realizado(integer, integer) to authenticated;
grant execute on function public.jsonb_num(jsonb) to authenticated;
