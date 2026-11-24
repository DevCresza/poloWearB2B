-- T8 + T9 (fase 1): pedido criado no servidor e estoque com trava.
--
-- Esta fase so ACRESCENTA: nada do que o app em producao usa hoje muda de
-- comportamento. O front novo passa a chamar:
--   * criar_pedido(...)         -- checkout do cliente e do vendedor (Carrinho)
--   * emitir_pedido_lote(...)   -- emissao em lote do admin (EmissaoLote)
-- A fase 2 (supabase/pendentes/t8_t9_fase2_*.sql) liga o estorno automatico
-- e revoga o INSERT direto e a aplicar_baixa_estoque(itens). Ela so pode ir ao
-- ar DEPOIS do deploy do front, senao o estorno roda duas vezes (trigger + o
-- devolverEstoque do front antigo).
--
-- Regras (as mesmas do front; ver src/utils/itemPedido.js, pedidoMinimo.js,
-- capsulaItens.js):
--   * preco por perfil do COMPRADOR: multimarca usa *_multimarca, os demais o
--     preco de franqueado; sem preco do perfil = 0 = item recusado.
--   * grade: quantidade em grades, preco da grade. Por tamanho: quantidade em
--     pecas, preco da grade / pecas da grade (ou preco da peca, se avulso).
--   * pedido minimo por tipo de cliente; fallback pedido_minimo_valor.
--   * boleto faturado: nunca para multimarca; para franqueado na lista
--     clientes_boleto_faturado so PIX e cartao; sempre cruzado com
--     metodos_pagamento_aceitos do fornecedor.
--   * estoque so e controlado em pronta entrega com controla_estoque; sem
--     saldo e sem permite_venda_sem_estoque o pedido e recusado. Com
--     permite_venda_sem_estoque o saldo para em zero (o banco tem CHECK
--     estoque_atual_grades >= 0) e a falta fica registrada na movimentacao.
--
-- Rollback:
--   drop function if exists public.criar_pedido(jsonb, uuid, text, text, text, uuid);
--   drop function if exists public.emitir_pedido_lote(uuid, integer, text, uuid, text, text, text);
--   drop function if exists public.pedidos_estoque_automatico();
--   drop function if exists public._ajustar_estoque(uuid, jsonb, text, boolean);
--   drop function if exists public._linhas_estoque(jsonb, integer);
--   drop function if exists public._montar_itens_pedido(jsonb, boolean, boolean, boolean);
--   drop function if exists public._item_pedido(public.produtos, boolean, integer, text, jsonb, uuid, text);
--   drop function if exists public._preco_item_pedido(public.produtos, boolean, boolean);
--   drop function if exists public._jsonb_array(jsonb);
--   drop index if exists public.pedidos_idempotency_key_uniq;
--   alter table public.pedidos drop column if exists idempotency_key;

alter table public.pedidos add column if not exists idempotency_key text;

-- Em producao foi criado com CONCURRENTLY (execute_sql, fora de transacao).
create unique index if not exists pedidos_idempotency_key_uniq
  on public.pedidos (idempotency_key) where idempotency_key is not null;

-- jsonb que pode vir como array ou como string com JSON dentro.
create or replace function public._jsonb_array(j jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if j is null then return '[]'::jsonb; end if;
  if jsonb_typeof(j) = 'array' then return j; end if;
  if jsonb_typeof(j) = 'string' then
    begin
      j := (j #>> '{}')::jsonb;
    exception when others then
      return '[]'::jsonb;
    end;
    if jsonb_typeof(j) = 'array' then return j; end if;
  end if;
  return '[]'::jsonb;
end;
$$;

-- Preco de UMA unidade do item, no perfil do comprador.
-- p_por_peca: item vendido por tamanho (quantidade em pecas).
create or replace function public._preco_item_pedido(p public.produtos, p_multimarca boolean, p_por_peca boolean)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_por_peca and coalesce(p.tipo_venda, '') = 'grade' and coalesce(p.total_pecas_grade, 0) > 0 then
      (case when p_multimarca then coalesce(p.preco_grade_multimarca, 0)
            else coalesce(p.preco_grade_completa, 0) end) / p.total_pecas_grade
    when not p_por_peca and coalesce(p.tipo_venda, '') = 'grade' then
      case when p_multimarca then coalesce(p.preco_grade_multimarca, 0)
           else coalesce(p.preco_grade_completa, 0) end
    else
      case when p_multimarca then coalesce(p.preco_peca_multimarca, 0)
           else coalesce(p.preco_por_peca, 0) end
  end
$$;

-- Um item do pedido no mesmo formato que o front sempre gravou.
create or replace function public._item_pedido(
  p public.produtos, p_multimarca boolean, p_qtd integer, p_tamanho text,
  p_cor jsonb, p_capsula uuid, p_mes text)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_preco  numeric;
  v_fotos  jsonb := public._jsonb_array(p.fotos);
  v_foto   text;
begin
  v_preco := public._preco_item_pedido(p, p_multimarca, p_tamanho is not null);
  if v_preco is null or v_preco <= 0 then
    raise exception 'O produto "%" está sem preço para o seu perfil de cliente', p.nome
      using errcode = '22023';
  end if;
  v_foto := case jsonb_typeof(v_fotos -> 0)
              when 'string' then v_fotos ->> 0
              when 'object' then v_fotos -> 0 ->> 'url'
            end;
  return jsonb_strip_nulls(jsonb_build_object(
    'produto_id',            p.id,
    'nome',                  p.nome,
    'marca',                 coalesce(p.marca, ''),
    'referencia',            coalesce(nullif(p.referencia_polo, ''), p.referencia_fornecedor, ''),
    'referencia_fornecedor', coalesce(p.referencia_fornecedor, ''),
    'referencia_linx',       coalesce(p.referencia_polo, ''),
    'tipo_venda',            coalesce(p.tipo_venda, 'avulso'),
    'quantidade',            p_qtd,
    'total_pecas_grade',     coalesce(p.total_pecas_grade, 0),
    'preco',                 round(v_preco, 4),
    'total',                 round(v_preco * p_qtd, 2),
    'foto',                  v_foto,
    'grade_selecionada',     case when p_capsula is null then p.grade_configuracao end,
    'cor_selecionada',       p_cor,
    'tamanho_selecionado',   p_tamanho,
    'origem_capsula',        p_capsula,
    'mes_entrega',           p_mes
  ));
end;
$$;

-- Monta os itens do pedido a partir do carrinho, so com dados do servidor.
-- Carrinho (o que o front manda):
--   {tipo:'produto', produto_id, quantidade, tamanho?, cor_id?, cor_nome?}
--   {tipo:'capsula', capsula_id, quantidade, mes_entrega?, produtos_quantidades?}
-- Preco, nome e foto que vierem do cliente sao ignorados.
-- Devolve {itens, fornecedor_id, total}.
create or replace function public._montar_itens_pedido(
  p_carrinho jsonb, p_multimarca boolean, p_checar_visibilidade boolean,
  p_capsula_padrao boolean)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_linha     jsonb;
  v_itens     jsonb := '[]'::jsonb;
  v_forns     uuid[] := '{}';
  v_prod      public.produtos%rowtype;
  v_cap       public.capsulas%rowtype;
  v_qtd       integer;
  v_capqtd    integer;
  v_tam       text;
  v_var       jsonb;
  v_cor       jsonb;
  v_cfg_cli   jsonb;
  v_cfg_adm   jsonb;
  v_cfg       jsonb;
  v_pid       uuid;
  v_mes       text;
  v_meses     jsonb;
  v_sub       jsonb;
  v_min       numeric;
  v_n         numeric;
  v_total     numeric := 0;
  v_cap_forn  uuid;
begin
  if jsonb_typeof(p_carrinho) is distinct from 'array' or jsonb_array_length(p_carrinho) = 0 then
    raise exception 'Carrinho vazio' using errcode = '22023';
  end if;
  if jsonb_array_length(p_carrinho) > 300 then
    raise exception 'Carrinho grande demais (máximo de 300 linhas)' using errcode = '22023';
  end if;

  for v_linha in select * from jsonb_array_elements(p_carrinho) loop
    begin
      v_n := (v_linha ->> 'quantidade')::numeric;
    exception when others then
      raise exception 'Quantidade inválida no carrinho' using errcode = '22023';
    end;
    if v_n is null or v_n <= 0 or v_n <> trunc(v_n) or v_n > 100000 then
      raise exception 'Quantidade inválida no carrinho: %', v_linha ->> 'quantidade' using errcode = '22023';
    end if;
    v_qtd := v_n::integer;

    -- ---------------------------------------------------------- capsula
    if v_linha ->> 'tipo' = 'capsula' then
      begin
        select * into v_cap from public.capsulas where id = (v_linha ->> 'capsula_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'Cápsula inválida no carrinho' using errcode = '22023';
      end;
      if not found or not coalesce(v_cap.ativa, false) or coalesce(v_cap.arquivada, false) then
        raise exception 'A cápsula "%" não está mais disponível', coalesce(v_cap.nome, v_linha ->> 'capsula_id')
          using errcode = '22023';
      end if;
      if p_checar_visibilidade and not (case when p_multimarca then coalesce(v_cap.disponivel_multimarca, false)
                                             else coalesce(v_cap.disponivel_franqueado, true) end) then
        raise exception 'A cápsula "%" não está disponível para o seu perfil', v_cap.nome using errcode = '22023';
      end if;
      v_capqtd := v_qtd;

      v_meses := public._jsonb_array(v_cap.meses_disponiveis);
      v_mes := nullif(btrim(coalesce(v_linha ->> 'mes_entrega', '')), '');
      if v_mes is null and jsonb_array_length(v_meses) = 1 then
        v_mes := v_meses ->> 0;
      end if;
      if jsonb_array_length(v_meses) > 1 then
        if v_mes is null then
          raise exception 'Escolha o mês de entrega da cápsula "%"', v_cap.nome using errcode = '22023';
        end if;
        if not (v_meses ? v_mes) then
          raise exception 'Mês de entrega inválido para a cápsula "%"', v_cap.nome using errcode = '22023';
        end if;
      end if;

      v_cfg_adm := case when jsonb_typeof(v_cap.produtos_quantidades) = 'object'
                        then v_cap.produtos_quantidades else '{}'::jsonb end;
      v_cfg_cli := case when not p_capsula_padrao and jsonb_typeof(v_linha -> 'produtos_quantidades') = 'object'
                        then v_linha -> 'produtos_quantidades' else v_cfg_adm end;
      v_cap_forn := v_cap.fornecedor_id;

      for v_pid in
        select x::uuid from jsonb_array_elements_text(public._jsonb_array(v_cap.produto_ids)) x
      loop
        select * into v_prod from public.produtos where id = v_pid;
        -- Produto excluido ou arquivado sai da capsula; o resto continua.
        continue when not found or coalesce(v_prod.arquivado, false);
        -- Sem configuracao do admin, o produto nao entra (igual ao catalogo).
        continue when v_cfg_adm -> v_pid::text is null
                   or jsonb_typeof(v_cfg_adm -> v_pid::text) = 'null';
        v_cfg := coalesce(v_cfg_cli -> v_pid::text, v_cfg_adm -> v_pid::text);
        -- O cliente so ajusta quantidades: a forma (cor, tamanho ou numero) e a do admin.
        if jsonb_typeof(v_cfg) is distinct from jsonb_typeof(v_cfg_adm -> v_pid::text)
           or (jsonb_typeof(v_cfg) = 'object'
               and (jsonb_typeof(v_cfg -> 'variantes') is distinct from jsonb_typeof(v_cfg_adm -> v_pid::text -> 'variantes')
                    or jsonb_typeof(v_cfg -> 'tamanhos') is distinct from jsonb_typeof(v_cfg_adm -> v_pid::text -> 'tamanhos'))) then
          raise exception 'Configuração da cápsula "%" alterada para "%"', v_cap.nome, v_prod.nome
            using errcode = '22023';
        end if;

        if jsonb_typeof(v_cfg) = 'object' and jsonb_typeof(v_cfg -> 'variantes') = 'array' then
          -- Percorre as cores DO ADMIN (minimo = quantidade configurada): cor que
          -- o cliente omitiu fica no minimo, cor que o cliente inventou e ignorada.
          for v_sub in select * from jsonb_array_elements(v_cfg_adm -> v_pid::text -> 'variantes') loop
            v_min := coalesce((v_sub ->> 'quantidade')::numeric, 0);
            v_n := null;
            select (c ->> 'quantidade')::numeric into v_n
              from jsonb_array_elements(v_cfg -> 'variantes') c
             where c ->> 'cor_id' = v_sub ->> 'cor_id' limit 1;
            v_n := coalesce(v_n, v_min);
            if v_n < v_min or v_n <> trunc(v_n) then
              raise exception 'Quantidade abaixo do mínimo da cápsula "%" em "%"', v_cap.nome, v_prod.nome
                using errcode = '22023';
            end if;
            continue when v_n <= 0;
            select v into v_var from jsonb_array_elements(public._jsonb_array(v_prod.variantes_cor)) v
             where v ->> 'id' = v_sub ->> 'cor_id' limit 1;
            v_cor := jsonb_strip_nulls(jsonb_build_object(
              'id',             v_sub ->> 'cor_id',
              'cor_nome',       coalesce(v_var ->> 'cor_nome', v_sub ->> 'cor_nome'),
              'cor_codigo_hex', coalesce(v_var ->> 'cor_codigo_hex', v_sub ->> 'cor_codigo_hex', v_sub ->> 'cor_hex', '#000000')));
            v_itens := v_itens || public._item_pedido(v_prod, p_multimarca, (v_n * v_capqtd)::integer,
                                                      null, v_cor, v_cap.id, v_mes);
          end loop;

        elsif jsonb_typeof(v_cfg) = 'object' and jsonb_typeof(v_cfg -> 'tamanhos') = 'array' then
          for v_sub in select * from jsonb_array_elements(v_cfg_adm -> v_pid::text -> 'tamanhos') loop
            v_min := coalesce((v_sub ->> 'quantidade')::numeric, 0);
            v_n := null;
            select (c ->> 'quantidade')::numeric into v_n
              from jsonb_array_elements(v_cfg -> 'tamanhos') c
             where c ->> 'tamanho' = v_sub ->> 'tamanho' limit 1;
            v_n := coalesce(v_n, v_min);
            if v_n < v_min or v_n <> trunc(v_n) then
              raise exception 'Quantidade abaixo do mínimo da cápsula "%" em "%"', v_cap.nome, v_prod.nome
                using errcode = '22023';
            end if;
            continue when v_n <= 0;
            v_tam := nullif(btrim(coalesce(v_sub ->> 'tamanho', '')), '');
            if v_tam is null then
              raise exception 'Tamanho em branco na cápsula "%"', v_cap.nome using errcode = '22023';
            end if;
            v_itens := v_itens || public._item_pedido(v_prod, p_multimarca, (v_n * v_capqtd)::integer,
                                                      v_tam, null, v_cap.id, v_mes);
          end loop;

        elsif jsonb_typeof(v_cfg) = 'number' then
          v_n := (v_cfg #>> '{}')::numeric;
          v_min := (v_cfg_adm -> v_pid::text #>> '{}')::numeric;
          if v_n < v_min or v_n <> trunc(v_n) then
            raise exception 'Quantidade abaixo do mínimo da cápsula "%" em "%"', v_cap.nome, v_prod.nome
              using errcode = '22023';
          end if;
          continue when v_n <= 0;
          v_itens := v_itens || public._item_pedido(v_prod, p_multimarca, (v_n * v_capqtd)::integer,
                                                    null, null, v_cap.id, v_mes);
        else
          raise exception 'Configuração da cápsula "%" inválida para "%"', v_cap.nome, v_prod.nome
            using errcode = '22023';
        end if;

        v_forns := v_forns || coalesce(v_cap_forn, v_prod.fornecedor_id);
      end loop;

    -- ---------------------------------------------------------- produto
    else
      begin
        select * into v_prod from public.produtos
         where id = coalesce(v_linha ->> 'produto_id', v_linha ->> 'id')::uuid;
      exception when invalid_text_representation then
        raise exception 'Produto inválido no carrinho' using errcode = '22023';
      end;
      if not found or not coalesce(v_prod.ativo, false) or coalesce(v_prod.arquivado, false) then
        raise exception 'O produto "%" não está mais disponível', coalesce(v_prod.nome, 'do carrinho')
          using errcode = '22023';
      end if;
      if p_checar_visibilidade and not (case when p_multimarca then coalesce(v_prod.disponivel_multimarca, false)
                                             else coalesce(v_prod.disponivel_franqueado, true) end) then
        raise exception 'O produto "%" não está disponível para o seu perfil', v_prod.nome using errcode = '22023';
      end if;

      v_tam := nullif(btrim(coalesce(v_linha ->> 'tamanho', v_linha ->> 'tamanho_selecionado', '')), '');
      v_cor := null;
      if v_tam is not null then
        if not coalesce(v_prod.venda_por_tamanho, false) then
          raise exception 'O produto "%" não é vendido por tamanho', v_prod.nome using errcode = '22023';
        end if;
      elsif coalesce(v_prod.tem_variantes_cor, false) then
        select v into v_var from jsonb_array_elements(public._jsonb_array(v_prod.variantes_cor)) v
         where (v_linha ->> 'cor_id' is not null and v ->> 'id' = v_linha ->> 'cor_id')
            or (v_linha ->> 'cor_id' is null and v ->> 'cor_nome' = v_linha ->> 'cor_nome')
         limit 1;
        if v_var is null then
          raise exception 'Escolha uma cor válida para "%"', v_prod.nome using errcode = '22023';
        end if;
        v_cor := jsonb_strip_nulls(jsonb_build_object(
          'id', v_var ->> 'id', 'cor_nome', v_var ->> 'cor_nome',
          'cor_codigo_hex', coalesce(v_var ->> 'cor_codigo_hex', v_var ->> 'cor_hex')));
      elsif coalesce(v_prod.venda_por_tamanho, false) then
        raise exception 'Escolha o tamanho de "%"', v_prod.nome using errcode = '22023';
      end if;

      v_itens := v_itens || public._item_pedido(v_prod, p_multimarca, v_qtd, v_tam, v_cor, null, null);
      v_forns := v_forns || v_prod.fornecedor_id;
    end if;
  end loop;

  if jsonb_array_length(v_itens) = 0 then
    raise exception 'O pedido ficou sem itens (todas as quantidades em zero)' using errcode = '22023';
  end if;
  if (select count(distinct f) from unnest(v_forns) f) > 1
     or exists (select 1 from unnest(v_forns) f where f is null) then
    raise exception 'Cada pedido deve ter produtos de um único fornecedor' using errcode = '22023';
  end if;

  select coalesce(sum((e ->> 'total')::numeric), 0) into v_total from jsonb_array_elements(v_itens) e;
  return jsonb_build_object('itens', v_itens, 'fornecedor_id', v_forns[1], 'total', v_total);
end;
$$;

-- Linhas de estoque de uma lista de itens de pedido. p_sinal: -1 baixa, +1 devolve.
create or replace function public._linhas_estoque(p_itens jsonb, p_sinal integer)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'produto_id', e ->> 'produto_id',
           'tamanho',    nullif(e ->> 'tamanho_selecionado', ''),
           'cor_id',     e #>> '{cor_selecionada,id}',
           'cor_nome',   e #>> '{cor_selecionada,cor_nome}',
           'delta',      p_sinal * round((e ->> 'quantidade')::numeric)
         )), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end) e
   where coalesce(e ->> 'tipo', '') <> 'capsula'
     and (e ->> 'produto_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and coalesce(e ->> 'quantidade', '') ~ '^[0-9]+(\.[0-9]+)?$'
     and (e ->> 'quantidade')::numeric > 0
$$;

-- Aplica linhas de estoque com trava (select ... for update), sem greatest(0).
-- Interno: nao tem EXECUTE para ninguem alem do dono.
-- p_validar: recusa saida acima do saldo quando o produto nao permite venda sem estoque.
create or replace function public._ajustar_estoque(
  p_pedido_id uuid, p_linhas jsonb, p_motivo text, p_validar boolean)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids     uuid[];
  v_pid     uuid;
  v_prod    public.produtos%rowtype;
  v_l       record;
  v_mapa    jsonb;
  v_vars    jsonb;
  v_idx     integer;
  v_antes   numeric;
  v_depois  numeric;
  v_mudou   boolean;
  v_movs    integer := 0;
  v_desc    text;
  v_falta   numeric;
begin
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) = 0 then
    return 0;
  end if;

  select array_agg(distinct (l ->> 'produto_id')::uuid order by (l ->> 'produto_id')::uuid) into v_ids
    from jsonb_array_elements(p_linhas) l;

  -- Trava em ordem de id: dois checkouts com os mesmos produtos nao se cruzam.
  perform 1 from public.produtos where id = any(v_ids) order by id for update;

  foreach v_pid in array v_ids loop
    select * into v_prod from public.produtos where id = v_pid;
    continue when not found;
    continue when not coalesce(v_prod.controla_estoque, false);
    continue when coalesce(v_prod.disponibilidade, '') <> 'pronta_entrega';

    v_mapa  := case when jsonb_typeof(v_prod.estoque_por_tamanho) = 'object'
                    then v_prod.estoque_por_tamanho else '{}'::jsonb end;
    v_vars  := public._jsonb_array(v_prod.variantes_cor);
    v_mudou := false;

    -- Mesma chave somada; entradas antes das saidas (revisao de itens).
    for v_l in
      select l ->> 'tamanho' tam, l ->> 'cor_id' cor_id, l ->> 'cor_nome' cor_nome,
             sum((l ->> 'delta')::numeric) delta
        from jsonb_array_elements(p_linhas) l
       where (l ->> 'produto_id')::uuid = v_prod.id
       group by 1, 2, 3
      having sum((l ->> 'delta')::numeric) <> 0
       order by 4 desc
    loop
      if coalesce(v_prod.venda_por_tamanho, false) and v_l.tam is not null then
        v_antes  := coalesce((v_mapa ->> v_l.tam)::numeric, 0);
        v_depois := v_antes + v_l.delta;
        v_desc   := 'tamanho ' || v_l.tam;
      elsif coalesce(v_prod.tem_variantes_cor, false) and (v_l.cor_id is not null or v_l.cor_nome is not null) then
        select i - 1 into v_idx
          from jsonb_array_elements(v_vars) with ordinality as t(v, i)
         where (v_l.cor_id is not null and v ->> 'id' = v_l.cor_id)
            or (v_l.cor_id is null and v ->> 'cor_nome' = v_l.cor_nome)
         order by (v ->> 'id' is not distinct from v_l.cor_id) desc
         limit 1;
        if v_idx is null then
          if p_validar and v_l.delta < 0 then
            raise exception 'Cor "%" não encontrada em "%"', coalesce(v_l.cor_nome, v_l.cor_id), v_prod.nome
              using errcode = '22023';
          end if;
          continue;
        end if;
        v_antes  := coalesce((v_vars -> v_idx ->> 'estoque_grades')::numeric, 0);
        v_depois := v_antes + v_l.delta;
        v_desc   := 'cor ' || coalesce(v_vars -> v_idx ->> 'cor_nome', v_l.cor_nome, v_l.cor_id);
      elsif coalesce(v_prod.venda_por_tamanho, false) or coalesce(v_prod.tem_variantes_cor, false) then
        -- Produto com estoque por tamanho/cor, mas o item nao diz qual: sem como baixar.
        if p_validar and v_l.delta < 0 then
          raise exception 'Escolha o tamanho ou a cor de "%"', v_prod.nome using errcode = '22023';
        end if;
        continue;
      else
        v_antes  := coalesce(v_prod.estoque_atual_grades, 0);
        v_depois := v_antes + v_l.delta;
        v_desc   := null;
      end if;

      if p_validar and v_l.delta < 0 and v_depois < 0
         and not coalesce(v_prod.permite_venda_sem_estoque, false) then
        raise exception 'Estoque insuficiente de "%"%: disponível %, pedido %',
          v_prod.nome, coalesce(' (' || v_desc || ')', ''), greatest(v_antes, 0), -v_l.delta
          using errcode = 'P0001', hint = 'estoque_insuficiente';
      end if;
      -- Produto que permite venda sem estoque: o saldo para em zero (o banco
      -- tem CHECK estoque_atual_grades >= 0) e a falta fica registrada.
      v_falta := 0;
      if v_depois < 0 then
        v_falta  := -v_depois;
        v_depois := 0;
      end if;

      if coalesce(v_prod.venda_por_tamanho, false) and v_l.tam is not null then
        v_mapa := jsonb_set(v_mapa, array[v_l.tam], to_jsonb(v_depois));
        v_prod.estoque_atual_grades := (select coalesce(sum(value::numeric), 0) from jsonb_each_text(v_mapa));
      elsif v_desc is not null then
        v_vars := jsonb_set(v_vars, array[v_idx::text, 'estoque_grades'], to_jsonb(v_depois));
        v_prod.estoque_atual_grades := (select coalesce(sum(coalesce((v ->> 'estoque_grades')::numeric, 0)), 0)
                                          from jsonb_array_elements(v_vars) v);
      else
        v_prod.estoque_atual_grades := v_depois;
      end if;
      v_mudou := true;

      insert into public.movimentacoes_estoque (
        produto_id, tipo, quantidade_grades, quantidade_anterior, quantidade_atual,
        motivo, observacoes, pedido_id, user_id
      ) values (
        v_prod.id, case when v_l.delta < 0 then 'saida' else 'entrada' end,
        abs(v_l.delta)::integer, v_antes::integer, v_depois::integer,
        left(p_motivo, 200),
        nullif(concat_ws(' · ', v_desc,
                         case when v_falta > 0 then 'vendido sem estoque: faltaram ' || v_falta end), ''),
        p_pedido_id, auth.uid()
      );
      v_movs := v_movs + 1;
    end loop;

    if v_mudou then
      update public.produtos
         set estoque_por_tamanho  = case when coalesce(venda_por_tamanho, false) then v_mapa else estoque_por_tamanho end,
             variantes_cor        = case when coalesce(tem_variantes_cor, false) and jsonb_typeof(variantes_cor) = 'array'
                                         then v_vars else variantes_cor end,
             estoque_atual_grades = v_prod.estoque_atual_grades
       where id = v_prod.id;
    end if;
  end loop;

  return v_movs;
end;
$$;

-- Estoque do pedido acompanha o pedido (ligado como trigger na fase 2):
--   * cancelou com estoque_baixado -> devolve UMA vez e marca estoque_baixado=false;
--   * itens revisados (pedido nao cancelado, com baixa) -> aplica a diferenca.
-- E BEFORE UPDATE e roda depois do trg_pedidos_guard_colunas (ordem alfabetica):
-- o guard ve o estoque_baixado ainda igual, e e este trigger que o zera. Um
-- AFTER UPDATE teria de fazer outro UPDATE em pedidos, que o guard recusa para
-- o cliente.
create or replace function public.pedidos_estoque_automatico()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(old.estoque_baixado, false) then
    return new;
  end if;
  if new.status = 'cancelado' and old.status is distinct from 'cancelado' then
    perform public._ajustar_estoque(new.id, public._linhas_estoque(old.itens, 1),
                                    'Estorno: pedido cancelado', false);
    new.estoque_baixado := false;
  elsif new.status is distinct from 'cancelado'
        and new.itens is distinct from old.itens then
    perform public._ajustar_estoque(new.id,
                                    public._linhas_estoque(old.itens, 1) || public._linhas_estoque(new.itens, -1),
                                    'Revisão de itens do pedido', true);
  end if;
  return new;
end;
$$;

-- Checkout: o pedido inteiro numa transacao, com preco do servidor.
create or replace function public.criar_pedido(
  p_carrinho          jsonb,
  p_loja_id           uuid,
  p_metodo_pagamento  text,
  p_idempotency_key   text,
  p_observacoes       text default null,
  p_comprador_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_papel      text := public.app_role();
  v_comp       public.users%rowtype;
  v_loja       public.lojas%rowtype;
  v_forn       public.fornecedores%rowtype;
  v_existente  public.pedidos%rowtype;
  v_multi      boolean;
  v_montado    jsonb;
  v_itens      jsonb;
  v_total      numeric;
  v_minimo     numeric;
  v_metodos    text[];
  v_aceitos    text[];
  v_pedido_id  uuid := gen_random_uuid();
  v_end        jsonb;
  v_obs        text := left(nullif(btrim(coalesce(p_observacoes, '')), ''), 2000);
  v_chave      text := btrim(coalesce(p_idempotency_key, ''));
begin
  if v_uid is null then
    raise exception 'Login necessário' using errcode = '42501';
  end if;
  if length(v_chave) < 16 or length(v_chave) > 200 then
    raise exception 'Chave de envio inválida' using errcode = '22023';
  end if;

  -- Clique duplo: a segunda chamada espera a primeira e devolve o mesmo pedido.
  perform pg_advisory_xact_lock(hashtextextended('criar_pedido:' || v_chave, 0));
  select * into v_existente from public.pedidos where idempotency_key = v_chave;
  if found then
    if v_existente.comprador_user_id = v_uid or v_existente.criado_por_user_id = v_uid then
      return jsonb_build_object('pedido_id', v_existente.id, 'valor_total', v_existente.valor_total,
                                'repetido', true);
    end if;
    raise exception 'Chave de envio já usada' using errcode = '22023';
  end if;

  -- Comprador: o proprio cliente, ou o cliente em nome de quem o vendedor compra.
  if p_comprador_user_id is null or p_comprador_user_id = v_uid then
    if coalesce(v_papel, '') not in ('multimarca', 'franqueado') then
      raise exception 'Somente cliente multimarca ou franqueado compra pelo carrinho' using errcode = '42501';
    end if;
    select * into v_comp from public.users where id = v_uid;
  else
    if coalesce(v_papel, '') not in ('vendedor', 'admin') then
      raise exception 'Sem permissão para comprar em nome de outro cliente' using errcode = '42501';
    end if;
    select * into v_comp from public.users where id = p_comprador_user_id;
    if not found or coalesce(v_comp.role, '') not in ('multimarca', 'franqueado') then
      raise exception 'Pedido em nome de outro só para cliente multimarca ou franqueado' using errcode = '22023';
    end if;
    if p_loja_id is null then
      raise exception 'Escolha a loja de entrega do cliente' using errcode = '22023';
    end if;
  end if;
  if coalesce(v_comp.bloqueado, false) then
    raise exception 'Conta bloqueada%: regularize os pagamentos para fazer novos pedidos',
      coalesce(' (' || nullif(v_comp.motivo_bloqueio, '') || ')', '') using errcode = '42501';
  end if;
  v_multi := v_comp.role = 'multimarca';

  if p_loja_id is not null then
    select * into v_loja from public.lojas where id = p_loja_id;
    if not found or v_loja.user_id is distinct from v_comp.id then
      raise exception 'Loja do pedido não pertence ao comprador' using errcode = '42501';
    end if;
    if coalesce(v_loja.bloqueada, false) then
      raise exception 'A loja "%" está bloqueada%', coalesce(v_loja.nome_fantasia, v_loja.nome),
        coalesce(': ' || nullif(v_loja.motivo_bloqueio, ''), '') using errcode = '42501';
    end if;
    if v_loja.ativa is false then
      raise exception 'A loja "%" está inativa', coalesce(v_loja.nome_fantasia, v_loja.nome) using errcode = '22023';
    end if;
    v_end := jsonb_build_object(
      'endereco', v_loja.endereco_completo, 'cep', v_loja.cep, 'cidade', v_loja.cidade,
      'estado', v_loja.estado, 'destinatario', coalesce(v_loja.nome_fantasia, v_loja.nome),
      'telefone', coalesce(v_loja.telefone, v_comp.telefone, v_comp.whatsapp));
  else
    v_end := jsonb_build_object(
      'endereco', v_comp.endereco_completo, 'cep', v_comp.cep, 'cidade', v_comp.cidade,
      'estado', v_comp.estado, 'destinatario', v_comp.full_name,
      'telefone', coalesce(v_comp.telefone, v_comp.whatsapp));
  end if;
  if coalesce(v_end ->> 'endereco', '') = '' or coalesce(v_end ->> 'cep', '') = ''
     or coalesce(v_end ->> 'cidade', '') = '' or coalesce(v_end ->> 'estado', '') = '' then
    raise exception 'Endereço de entrega incompleto' using errcode = '22023';
  end if;

  -- Itens e precos do servidor.
  v_montado := public._montar_itens_pedido(p_carrinho, v_multi, true, false);
  v_itens   := v_montado -> 'itens';
  v_total   := round((v_montado ->> 'total')::numeric, 2);

  select * into v_forn from public.fornecedores where id = (v_montado ->> 'fornecedor_id')::uuid;
  if not found then
    raise exception 'Fornecedor do pedido não encontrado' using errcode = '22023';
  end if;
  if v_forn.ativo_fornecedor is false then
    raise exception 'O fornecedor "%" não está recebendo pedidos', coalesce(v_forn.nome_marca, v_forn.nome_fantasia)
      using errcode = '22023';
  end if;

  if v_total <= 0 then
    raise exception 'Valor do pedido inválido' using errcode = '22023';
  end if;

  -- Pedido minimo por tipo de cliente (src/utils/pedidoMinimo.js).
  v_minimo := case when coalesce(case when v_multi then v_forn.pedido_minimo_multimarca
                                      else v_forn.pedido_minimo_franqueado end, 0) > 0
                   then case when v_multi then v_forn.pedido_minimo_multimarca
                             else v_forn.pedido_minimo_franqueado end
                   else coalesce(v_forn.pedido_minimo_valor, 0) end;
  if v_minimo > 0 and v_total < v_minimo then
    raise exception 'O pedido para % não atingiu o mínimo de R$ % (valor atual R$ %)',
      coalesce(v_forn.nome_marca, v_forn.nome_fantasia, 'o fornecedor'),
      replace(to_char(v_minimo, 'FM999999990.00'), '.', ','), replace(to_char(v_total, 'FM999999990.00'), '.', ',')
      using errcode = '22023', hint = 'pedido_minimo';
  end if;

  -- Metodos de pagamento (mesma regra do Carrinho).
  if v_multi then
    v_metodos := array['pix', 'cartao_credito', 'transferencia'];
  elsif jsonb_typeof(v_forn.clientes_boleto_faturado) = 'array'
        and v_forn.clientes_boleto_faturado ? v_comp.id::text then
    v_metodos := array['pix', 'cartao_credito'];
  else
    v_metodos := array['pix', 'cartao_credito', 'boleto_faturado', 'transferencia'];
  end if;
  if jsonb_typeof(v_forn.metodos_pagamento_aceitos) = 'array' then
    select coalesce(array_agg(x), '{}') into v_aceitos
      from jsonb_array_elements_text(v_forn.metodos_pagamento_aceitos) x;
  else
    v_aceitos := array['pix', 'cartao_credito', 'boleto_faturado', 'transferencia'];
  end if;
  if p_metodo_pagamento is null or not (p_metodo_pagamento = any(v_metodos))
     or not (p_metodo_pagamento = any(v_aceitos)) then
    raise exception 'Forma de pagamento não disponível para este pedido' using errcode = '22023';
  end if;

  insert into public.pedidos (
    id, comprador_user_id, fornecedor_id, loja_id, itens, valor_total, valor_final,
    status, status_pagamento, metodo_pagamento, endereco_entrega, observacoes,
    observacoes_comprador, estoque_baixado, criado_por_user_id, criado_por_papel,
    idempotency_key
  ) values (
    v_pedido_id, v_comp.id, v_forn.id, p_loja_id, v_itens, v_total, v_total,
    'novo_pedido', 'pendente', p_metodo_pagamento, v_end, coalesce(v_obs, ''),
    coalesce(v_obs, ''), true, v_uid,
    case when v_comp.id = v_uid then 'cliente' when v_papel = 'admin' then 'admin' else 'vendedor' end,
    v_chave
  );

  -- Baixa de estoque com trava (mesma transacao: se faltar saldo, o pedido
  -- acima tambem e desfeito). Vem depois do INSERT por causa da FK
  -- movimentacoes_estoque.pedido_id.
  perform public._ajustar_estoque(v_pedido_id, public._linhas_estoque(v_itens, -1), 'Pedido', true);

  -- Titulo provisorio (o fornecedor substitui pelas parcelas no faturamento).
  insert into public.carteira (
    pedido_id, cliente_user_id, loja_id, tipo, descricao, valor, data_vencimento,
    status, categoria
  ) values (
    v_pedido_id, v_comp.id, p_loja_id, 'a_pagar',
    'Pedido #' || upper(right(v_pedido_id::text, 8)) || ' - ' || coalesce(v_forn.nome_fantasia, v_forn.nome_marca, ''),
    v_total, ((now() at time zone 'America/Sao_Paulo')::date + 30), 'pendente', 'Pedido'
  );

  return jsonb_build_object('pedido_id', v_pedido_id, 'valor_total', v_total, 'repetido', false);
end;
$$;

-- Emissao em lote (admin): a mesma montagem de itens, sem baixa de estoque
-- (regra atual da EmissaoLote: "admin emitindo em nome do cliente — nao dar
-- baixa automatica") e sem pedido minimo.
create or replace function public.emitir_pedido_lote(
  p_capsula_id        uuid,
  p_quantidade        integer,
  p_mes_entrega       text,
  p_loja_id           uuid,
  p_metodo_pagamento  text,
  p_observacoes       text,
  p_idempotency_key   text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_loja       public.lojas%rowtype;
  v_comp       public.users%rowtype;
  v_cap        public.capsulas%rowtype;
  v_existente  public.pedidos%rowtype;
  v_montado    jsonb;
  v_total      numeric;
  v_pedido_id  uuid := gen_random_uuid();
  v_chave      text := btrim(coalesce(p_idempotency_key, ''));
  v_obs        text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Somente a administração emite pedidos em lote' using errcode = '42501';
  end if;
  if length(v_chave) < 16 or length(v_chave) > 200 then
    raise exception 'Chave de envio inválida' using errcode = '22023';
  end if;
  if p_metodo_pagamento is null
     or p_metodo_pagamento not in ('pix', 'cartao_credito', 'boleto_faturado', 'transferencia', 'boleto', 'a_vista') then
    raise exception 'Forma de pagamento inválida' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('criar_pedido:' || v_chave, 0));
  select * into v_existente from public.pedidos where idempotency_key = v_chave;
  if found then
    return jsonb_build_object('pedido_id', v_existente.id, 'valor_total', v_existente.valor_total,
                              'repetido', true);
  end if;

  select * into v_loja from public.lojas where id = p_loja_id;
  if not found then
    raise exception 'Loja não encontrada' using errcode = '22023';
  end if;
  if coalesce(v_loja.endereco_completo, '') = '' or coalesce(v_loja.cep, '') = ''
     or coalesce(v_loja.cidade, '') = '' or coalesce(v_loja.estado, '') = '' then
    raise exception 'Loja sem endereço completo' using errcode = '22023';
  end if;
  select * into v_comp from public.users where id = v_loja.user_id;
  if not found then
    raise exception 'Dono da loja não encontrado' using errcode = '22023';
  end if;
  select * into v_cap from public.capsulas where id = p_capsula_id;

  v_montado := public._montar_itens_pedido(
    jsonb_build_array(jsonb_build_object('tipo', 'capsula', 'capsula_id', p_capsula_id,
                                         'quantidade', p_quantidade, 'mes_entrega', p_mes_entrega)),
    v_comp.role = 'multimarca', false, true);
  v_total := round((v_montado ->> 'total')::numeric, 2);
  if v_total <= 0 then
    raise exception 'Total zerado' using errcode = '22023';
  end if;

  v_obs := coalesce(left(nullif(btrim(coalesce(p_observacoes, '')), ''), 2000),
                    'Emissão em lote pela administração — ' || coalesce(v_cap.nome, ''));

  insert into public.pedidos (
    id, comprador_user_id, fornecedor_id, loja_id, itens, valor_total, valor_final,
    status, status_pagamento, metodo_pagamento, endereco_entrega, observacoes,
    observacoes_comprador, estoque_baixado, emitido_por_admin_user_id,
    criado_por_user_id, criado_por_papel, idempotency_key
  ) values (
    v_pedido_id, v_comp.id, coalesce(v_cap.fornecedor_id, (v_montado ->> 'fornecedor_id')::uuid),
    v_loja.id, v_montado -> 'itens', v_total, v_total,
    'novo_pedido', 'pendente', p_metodo_pagamento,
    jsonb_build_object('endereco', v_loja.endereco_completo, 'cep', v_loja.cep, 'cidade', v_loja.cidade,
                       'estado', v_loja.estado, 'destinatario', coalesce(v_loja.nome_fantasia, v_loja.nome),
                       'telefone', coalesce(v_loja.telefone, v_comp.telefone, v_comp.whatsapp)),
    v_obs, coalesce(nullif(btrim(coalesce(p_observacoes, '')), ''), ''),
    false, v_uid, v_uid, 'admin', v_chave
  );

  insert into public.carteira (
    pedido_id, cliente_user_id, loja_id, tipo, descricao, valor, data_vencimento,
    status, categoria
  ) values (
    v_pedido_id, v_comp.id, v_loja.id, 'a_pagar',
    'Pedido #' || upper(right(v_pedido_id::text, 8)) || ' - ' || coalesce(v_cap.nome, ''),
    v_total, ((now() at time zone 'America/Sao_Paulo')::date + 30), 'pendente', 'Pedido'
  );

  return jsonb_build_object('pedido_id', v_pedido_id, 'valor_total', v_total, 'repetido', false);
end;
$$;

-- Permissoes: so as duas portas de entrada sao chamaveis.
revoke all on function public._jsonb_array(jsonb) from public, anon, authenticated;
revoke all on function public._preco_item_pedido(public.produtos, boolean, boolean) from public, anon, authenticated;
revoke all on function public._item_pedido(public.produtos, boolean, integer, text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public._montar_itens_pedido(jsonb, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public._linhas_estoque(jsonb, integer) from public, anon, authenticated;
revoke all on function public._ajustar_estoque(uuid, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.pedidos_estoque_automatico() from public, anon, authenticated;
revoke all on function public.criar_pedido(jsonb, uuid, text, text, text, uuid) from public, anon;
revoke all on function public.emitir_pedido_lote(uuid, integer, text, uuid, text, text, text) from public, anon;
grant execute on function public.criar_pedido(jsonb, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.emitir_pedido_lote(uuid, integer, text, uuid, text, text, text) to authenticated;
