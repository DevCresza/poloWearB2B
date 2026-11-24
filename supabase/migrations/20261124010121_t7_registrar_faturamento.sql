-- T7 (diagnóstico A7, M6 e M7): faturamento numa transação só.
--
-- A7. O FaturarPedidoModal gravava em quatro passos soltos: Faturamento.create,
--     os títulos à vista/cartão/pix, Pedido.update dos valores e Pedido.update
--     dos itens (este com o erro só no console). valor_faturado era somado a
--     partir do pedido EM MEMÓRIA: dois faturamentos próximos perdiam um ao
--     outro ("lost update"), e uma falha no meio deixava nota sem baixa de item,
--     ou item baixado sem nota.
--
--     registrar_faturamento(pedido, itens, nf, pagamentos, parcelas_boleto)
--     faz tudo de uma vez, com a linha do pedido presa (for update):
--       * confere o saldo de cada item no BANCO (quantidade - faturada - quebra);
--       * o preço vem do item gravado no pedido, nunca do chamador;
--       * cria o faturamento, os títulos 900+ das partes que não são boleto e,
--         se vierem, as parcelas do boleto (por substituir_parcelas, T6);
--       * soma valor_faturado / valor_quebra na linha travada e atualiza status;
--       * a mesma NF (normalizada) com o mesmo valor no mesmo pedido é recusada
--         com 23505 -- o reenvio por duplo clique ou rede lenta não entra duas
--         vezes, e o índice único abaixo segura até uma corrida;
--       * quebra pura (sem nota) também passa por aqui: baixa o item como quebra
--         e reduz valor_final, sem faturamento nem título.
--     Só admin ou o fornecedor dono do pedido. SECURITY DEFINER porque grava em
--     três tabelas numa transação e chama substituir_parcelas; o papel é
--     validado aqui dentro.
--
-- M6. O faturamento parcial sobrescrevia nf_numero / nf_data_upload / nf_url do
--     pedido com a ÚLTIMA nota, e o mês de faturamento dos relatórios saía de
--     nf_data_upload. Agora:
--       * os campos nf_* do pedido só são preenchidos quando ainda estão vazios
--         (a primeira nota); a lista completa de notas é a tabela faturamentos;
--       * pedidos.meses_faturamento (YYYY-MM de cada faturamentos.data_emissao)
--         é mantido por trigger em faturamentos e exposto em pedidos_resumo. O
--         front lê o mês daqui e só cai em nf_data_upload para pedido antigo sem
--         faturamento registrado;
--       * cada item faturado ganha item.mes_faturamento (mês da primeira nota que
--         o faturou), para os relatórios por item.
--     Backfill de meses_faturamento: com os triggers de usuário de pedidos
--     desligados DENTRO desta transação, para não disparar o webhook
--     notify-pedido, não gravar histórico nem mexer em updated_at de 957
--     pedidos por causa de uma coluna derivada.
--
-- M7. uniq_faturamento_nota_valor comparava o texto da NF e o valor sem
--     arredondar: "274856" e "274.856" passavam como notas diferentes. Coluna
--     gerada numero_nf_norm (só dígitos, sem zeros à esquerda) e índice único
--     (pedido_id, numero_nf_norm, round(valor_total, 2)). Conferido antes: 0
--     violações nos 1.089 faturamentos. A mesma NF em PEDIDOS diferentes
--     continua permitida (NF de lote: decisão do dono pendente). A mesma NF com
--     valores diferentes no mesmo pedido também (duas remessas parciais na
--     mesma nota, caso #02F23258). O índice antigo fica (é coberto pelo novo).
--
-- Rollback (rodar como dono, em uma transação):
--   revoke execute on function public.registrar_faturamento(uuid, jsonb, jsonb, jsonb, jsonb) from authenticated;
--   -- e então remover: a função registrar_faturamento(uuid, jsonb, jsonb, jsonb, jsonb),
--   -- o trigger trg_faturamentos_meses em faturamentos e a função faturamentos_sync_meses(),
--   -- o índice uniq_faturamento_nf_norm_valor, a coluna faturamentos.numero_nf_norm,
--   -- e recriar pedidos_resumo sem meses_faturamento antes de remover a coluna
--   -- pedidos.meses_faturamento. (Os comandos de remoção ficam fora deste
--   -- arquivo de propósito: o MCP pede confirmação manual para cada um.)

-- ---------------------------------------------------------------- M7
alter table public.faturamentos
  add column if not exists numero_nf_norm text
  generated always as (
    nullif(ltrim(regexp_replace(coalesce(numero_nf, ''), '[^0-9]', '', 'g'), '0'), '')
  ) stored;

comment on column public.faturamentos.numero_nf_norm is
  'Número da NF só com dígitos e sem zeros à esquerda ("000.274.856" = "274856"). Usado na trava de duplicata.';

create unique index if not exists uniq_faturamento_nf_norm_valor
  on public.faturamentos (pedido_id, numero_nf_norm, round(valor_total, 2))
  where numero_nf_norm is not null;

-- ---------------------------------------------------------------- M6
alter table public.pedidos
  add column if not exists meses_faturamento text[] not null default '{}';

comment on column public.pedidos.meses_faturamento is
  'Meses YYYY-MM das notas (faturamentos.data_emissao) do pedido. Mantido por trigger em faturamentos. Vazio = sem faturamento registrado.';

create or replace function public.calc_meses_faturamento(p_pedido_id uuid)
returns text[]
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct to_char(f.data_emissao, 'YYYY-MM') order by to_char(f.data_emissao, 'YYYY-MM')), '{}')
    from public.faturamentos f
   where f.pedido_id = p_pedido_id
     and f.data_emissao is not null;
$$;

create or replace function public.faturamentos_sync_meses()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
  v_id  uuid;
  v_m   text[];
begin
  -- Nota apagada não passa por aqui: o portal não apaga faturamento (só o
  -- dono, no SQL); nesse caso, rodar calc_meses_faturamento no pedido.
  v_ids := array_remove(array[
    new.pedido_id,
    case when tg_op = 'UPDATE' then old.pedido_id end
  ], null);
  foreach v_id in array coalesce((select array_agg(distinct x) from unnest(v_ids) x), '{}') loop
    v_m := public.calc_meses_faturamento(v_id);
    -- Só grava quando muda: registrar_faturamento já grava o valor certo antes
    -- de inserir a nota, e um update à toa dispararia o webhook do pedido.
    update public.pedidos
       set meses_faturamento = v_m
     where id = v_id
       and meses_faturamento is distinct from v_m;
  end loop;
  return null;
end;
$$;

revoke all on function public.faturamentos_sync_meses() from public, anon, authenticated;

create or replace trigger trg_faturamentos_meses
  after insert or update of data_emissao, pedido_id on public.faturamentos
  for each row execute function public.faturamentos_sync_meses();

-- Backfill sem efeitos colaterais (ver o cabeçalho).
set local lock_timeout = '5s';
alter table public.pedidos disable trigger user;
update public.pedidos p
   set meses_faturamento = m.meses
  from (select f.pedido_id, public.calc_meses_faturamento(f.pedido_id) meses
          from public.faturamentos f group by f.pedido_id) m
 where p.id = m.pedido_id
   and p.meses_faturamento is distinct from m.meses;
alter table public.pedidos enable trigger user;

-- A lista (pedidos_resumo) precisa do mês para o filtro "mês de faturamento".
create or replace view public.pedidos_resumo with (security_invoker = on) as
 select id, comprador_user_id, fornecedor_id, status, status_pagamento, valor_total,
    desconto, valor_frete, valor_final, endereco_entrega, data_prevista_entrega,
    data_entrega_real, transportadora, codigo_rastreio, nota_fiscal, observacoes,
    observacoes_internas, created_date, updated_at, franqueado_id, mes_referencia,
    metodo_pagamento, metodo_pagamento_original, data_pagamento, data_aprovacao,
    data_envio_real, nf_url, nf_numero, nf_data_upload, boleto_url, boleto_data_upload,
    cliente_confirmou_boleto, cliente_confirmou_nf, cliente_confirmou_recebimento,
    observacoes_comprador, observacoes_fornecedor, urgente, motivo_recusa,
    comprovante_pagamento_url, comprovante_pagamento_data, qtd_parcelas, parcelas_info,
    link_rastreio, valor_frete_fob, data_confirmacao_nf, data_confirmacao_boleto,
    data_confirmacao_recebimento, loja_id, tipo_frete, frete_incluso_boleto,
    frete_modo_cobranca, impresso, data_impressao, valor_faturado, valor_quebra,
    observacao_recebimento, estoque_baixado, pix_info, itens_revisados_em,
    cartao_link_pagamento, emitido_por_admin_user_id, criado_por_user_id,
    criado_por_papel, qtd_pecas, meses_entrega, meses_entrega_efetivos,
    meses_faturamento
   from public.pedidos p;

-- ---------------------------------------------------------------- A7
-- p_itens:      [{ "indice": 0, "qtd_faturar": 4, "qtd_quebra": 0 }, ...]
--               indice = posição do item em pedidos.itens.
-- p_nf:         { "numero": "274.856", "data_emissao": "2026-11-20",
--                 "nf_url": "https://...", "nf_arquivos": [...],
--                 "transportadora": "..." }        (nulo na quebra pura)
-- p_pagamentos: [{ "metodo": "boleto_faturado", "valor": 150.00 },
--                { "metodo": "pix", "valor": 50.00 }]  soma = valor da nota
-- p_parcelas_boleto (opcional): mesmo formato de substituir_parcelas; quando
--               vem, a soma tem que fechar com a parte em boleto.
create or replace function public.registrar_faturamento(
  p_pedido_id uuid,
  p_itens jsonb,
  p_nf jsonb default null,
  p_pagamentos jsonb default '[]'::jsonb,
  p_parcelas_boleto jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_metodos constant text[] := array['boleto_faturado', 'boleto', 'cartao_credito', 'pix', 'a_vista', 'transferencia'];
  v_role        text := public.app_role();
  v_ped         public.pedidos%rowtype;
  v_itens       jsonb;
  v_item        jsonb;
  v_sel         jsonb;
  v_idx         int;
  v_n           int;
  v_qf          numeric;
  v_qq          numeric;
  v_qtd         numeric;
  v_fat_ant     numeric;
  v_que_ant     numeric;
  v_preco       numeric;
  v_saldo       numeric;
  v_vistos      int[] := '{}';
  v_fat_itens   jsonb := '[]'::jsonb;
  v_valor_fat   numeric := 0;
  v_valor_que   numeric := 0;
  v_tem_fat     boolean := false;
  v_numero      text;
  v_numero_norm text;
  v_emissao     date;
  v_mes         text;
  v_url         text;
  v_arquivos    jsonb;
  v_transp      text;
  v_pags        jsonb := '[]'::jsonb;
  v_pag         jsonb;
  v_metodo      text;
  v_valor       numeric;
  v_soma_pag    numeric := 0;
  v_valor_bol   numeric := 0;
  v_i_titulo    int := 0;
  v_qtd_titulos int;
  v_todos       boolean;
  v_status      text;
  v_meses       text[];
  v_fat_id      uuid;
  v_parc        jsonb;
  v_rotulo      text;
begin
  if auth.uid() is null then
    raise exception 'Login necessário' using errcode = '42501';
  end if;

  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;

  if not (v_role = 'admin'
          or (v_role = 'fornecedor'
              and v_ped.fornecedor_id is not null
              and v_ped.fornecedor_id = public.meu_fornecedor_id())) then
    raise exception 'Sem permissão para faturar este pedido' using errcode = '42501';
  end if;

  if coalesce(v_ped.status, '') not in ('aprovado', 'em_producao', 'parcialmente_faturado', 'faturado') then
    raise exception 'Pedido com status "%" não pode ser faturado', v_ped.status using errcode = '22023';
  end if;

  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Selecione pelo menos um item para faturar ou marcar como quebra' using errcode = '22023';
  end if;

  v_itens := case when jsonb_typeof(v_ped.itens) = 'array' then v_ped.itens else '[]'::jsonb end;
  v_n := jsonb_array_length(v_itens);

  -- 1) Itens: saldo conferido na linha travada; o preço é o do pedido.
  for v_sel in select * from jsonb_array_elements(p_itens) loop
    begin
      v_idx := (v_sel->>'indice')::int;
      v_qf  := coalesce((v_sel->>'qtd_faturar')::numeric, 0);
      v_qq  := coalesce((v_sel->>'qtd_quebra')::numeric, 0);
    exception when others then
      raise exception 'Item com índice ou quantidade inválidos' using errcode = '22023';
    end;
    if v_idx is null or v_idx < 0 or v_idx >= v_n then
      raise exception 'Item % não existe neste pedido', v_idx using errcode = '22023';
    end if;
    if v_idx = any(v_vistos) then
      raise exception 'Item % repetido na lista', v_idx using errcode = '22023';
    end if;
    v_vistos := v_vistos || v_idx;
    if v_qf < 0 or v_qq < 0 or v_qf <> trunc(v_qf) or v_qq <> trunc(v_qq) or v_qf + v_qq = 0 then
      raise exception 'Informe uma quantidade inteira maior que zero para o item %', v_idx + 1 using errcode = '22023';
    end if;

    v_item    := v_itens->v_idx;
    v_qtd     := coalesce((v_item->>'quantidade')::numeric, 0);
    v_fat_ant := coalesce((v_item->>'qtd_faturada')::numeric, 0);
    v_que_ant := coalesce((v_item->>'qtd_quebra')::numeric, 0);
    v_preco   := coalesce((v_item->>'preco')::numeric, 0);
    v_saldo   := v_qtd - v_fat_ant - v_que_ant;
    if v_qf + v_qq > v_saldo then
      raise exception 'Quantidade excede o saldo de "%": saldo %, pedido %',
        coalesce(v_item->>'nome', 'item ' || (v_idx + 1)), v_saldo, v_qf + v_qq
        using errcode = '22023';
    end if;

    v_valor_fat := v_valor_fat + v_qf * v_preco;
    v_valor_que := v_valor_que + v_qq * v_preco;

    if v_qf > 0 then
      v_tem_fat := true;
      v_fat_itens := v_fat_itens || jsonb_build_array(jsonb_build_object(
        'produto_id',     coalesce(v_item->'produto_id', v_item->'id'),
        'nome',           v_item->'nome',
        'cor',            coalesce(v_item #>> '{cor_selecionada,cor_nome}', ''),
        'referencia',     coalesce(v_item->>'referencia', ''),
        'qtd_faturada',   v_qf,
        'preco_unitario', v_preco,
        'total',          round(v_qf * v_preco, 2)
      ));
    end if;

    -- status_item segue a regra que o modal usava.
    v_item := v_item
      || jsonb_build_object('qtd_faturada', v_fat_ant + v_qf)
      || case when v_qq > 0 or v_que_ant > 0 then jsonb_build_object('qtd_quebra', v_que_ant + v_qq) else '{}'::jsonb end
      || jsonb_build_object('status_item',
           case
             when v_fat_ant + v_qf + v_que_ant + v_qq >= v_qtd then
               case when v_qf = 0 then 'quebra' else 'faturado' end
             when v_fat_ant + v_qf > 0 or v_que_ant + v_qq > 0 then 'parcial'
             else 'pendente'
           end);
    if v_fat_ant = 0 and v_qf = 0 and not (v_itens->v_idx ? 'qtd_faturada') then
      v_item := v_item - 'qtd_faturada';
    end if;
    v_itens := jsonb_set(v_itens, array[v_idx::text], v_item);
  end loop;

  v_valor_fat := round(v_valor_fat, 2);
  v_valor_que := round(v_valor_que, 2);

  -- 2) Nota e divisão do pagamento (só quando há item faturado).
  if v_tem_fat then
    if p_nf is null or jsonb_typeof(p_nf) <> 'object' then
      raise exception 'Informe a nota fiscal' using errcode = '22023';
    end if;
    v_numero := nullif(btrim(coalesce(p_nf->>'numero', '')), '');
    v_numero_norm := nullif(ltrim(regexp_replace(coalesce(v_numero, ''), '[^0-9]', '', 'g'), '0'), '');
    if v_numero is null or v_numero_norm is null then
      raise exception 'Informe o número da nota fiscal' using errcode = '22023';
    end if;
    begin
      v_emissao := (p_nf->>'data_emissao')::date;
    exception when others then
      raise exception 'Data de emissão inválida' using errcode = '22023';
    end;
    if v_emissao is null then
      raise exception 'Informe a data de emissão da nota' using errcode = '22023';
    end if;
    v_mes := to_char(v_emissao, 'YYYY-MM');
    v_url := nullif(btrim(coalesce(p_nf->>'nf_url', '')), '');
    if v_url is null or v_url !~* '^https://' then
      raise exception 'Envie o arquivo da nota fiscal' using errcode = '22023';
    end if;
    v_arquivos := case when jsonb_typeof(p_nf->'nf_arquivos') = 'array' then p_nf->'nf_arquivos' else '[]'::jsonb end;
    v_transp := nullif(btrim(coalesce(p_nf->>'transportadora', '')), '');

    if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 then
      raise exception 'Informe ao menos uma forma de pagamento' using errcode = '22023';
    end if;
    for v_pag in select * from jsonb_array_elements(p_pagamentos) loop
      v_metodo := v_pag->>'metodo';
      begin
        v_valor := round((v_pag->>'valor')::numeric, 2);
      exception when others then
        raise exception 'Valor de pagamento inválido' using errcode = '22023';
      end;
      if v_metodo is null or not (v_metodo = any(c_metodos)) then
        raise exception 'Forma de pagamento inválida: %', coalesce(v_metodo, '(vazia)') using errcode = '22023';
      end if;
      if v_valor is null or v_valor <= 0 then
        raise exception 'Valor de pagamento precisa ser maior que zero' using errcode = '22023';
      end if;
      if exists (select 1 from jsonb_array_elements(v_pags) e where e->>'metodo' = v_metodo) then
        raise exception 'A mesma forma aparece duas vezes. Some os valores numa linha só.' using errcode = '22023';
      end if;
      v_pags := v_pags || jsonb_build_array(jsonb_build_object('metodo', v_metodo, 'valor', v_valor));
      v_soma_pag := v_soma_pag + v_valor;
      if v_metodo in ('boleto', 'boleto_faturado') then
        v_valor_bol := v_valor_bol + v_valor;
      end if;
    end loop;
    if v_soma_pag <> v_valor_fat then
      raise exception 'A divisão do pagamento (R$ %) não fecha com o valor da nota (R$ %)', v_soma_pag, v_valor_fat
        using errcode = '22023';
    end if;
    if p_parcelas_boleto is not null and jsonb_typeof(p_parcelas_boleto) = 'array'
       and jsonb_array_length(p_parcelas_boleto) > 0 then
      if v_valor_bol = 0 then
        raise exception 'Parcelas de boleto enviadas, mas a divisão não tem boleto' using errcode = '22023';
      end if;
      if abs((select coalesce(sum(round((e->>'valor')::numeric, 2)), 0)
                from jsonb_array_elements(p_parcelas_boleto) e) - v_valor_bol) > 0.01 then
        raise exception 'As parcelas do boleto não fecham com a parte em boleto (R$ %)', v_valor_bol
          using errcode = '22023';
      end if;
    end if;

    -- Idempotência: mesma nota, mesmo valor, mesmo pedido = reenvio.
    if exists (select 1 from public.faturamentos f
                where f.pedido_id = p_pedido_id
                  and f.numero_nf_norm = v_numero_norm
                  and round(f.valor_total, 2) = v_valor_fat) then
      raise exception 'A NF % com este valor já foi lançada neste pedido', v_numero
        using errcode = '23505';
    end if;

    -- Mês de faturamento por item: o da primeira nota que o faturou.
    for v_sel in select * from jsonb_array_elements(p_itens) loop
      v_idx := (v_sel->>'indice')::int;
      if coalesce((v_sel->>'qtd_faturar')::numeric, 0) > 0
         and coalesce(v_itens->v_idx->>'mes_faturamento', '') = '' then
        v_itens := jsonb_set(v_itens, array[v_idx::text, 'mes_faturamento'], to_jsonb(v_mes));
      end if;
    end loop;
  end if;

  -- 3) Pedido: somas na linha travada.
  select bool_and(
           coalesce((e->>'qtd_faturada')::numeric, 0) + coalesce((e->>'qtd_quebra')::numeric, 0)
           >= coalesce((e->>'quantidade')::numeric, 0))
    into v_todos
    from jsonb_array_elements(v_itens) e;
  v_status := case when coalesce(v_todos, false) then 'faturado' else 'parcialmente_faturado' end;

  v_meses := public.calc_meses_faturamento(p_pedido_id);
  if v_tem_fat and not (v_mes = any(v_meses)) then
    select array_agg(m order by m) into v_meses from unnest(v_meses || v_mes) m;
  end if;

  update public.pedidos p
     set itens             = v_itens,
         status            = v_status,
         valor_faturado    = coalesce(p.valor_faturado, 0) + v_valor_fat,
         valor_quebra      = coalesce(p.valor_quebra, 0) + v_valor_que,
         valor_final       = coalesce(p.valor_total, 0) - (coalesce(p.valor_quebra, 0) + v_valor_que),
         meses_faturamento = v_meses,
         metodo_pagamento  = case when v_tem_fat then v_pags->0->>'metodo' else p.metodo_pagamento end,
         transportadora    = coalesce(p.transportadora, case when v_tem_fat then v_transp end),
         -- M6: os campos de NF do pedido guardam a PRIMEIRA nota; as demais
         -- ficam só em faturamentos.
         nf_url            = case when v_tem_fat and p.nf_url is null then v_url else p.nf_url end,
         nf_numero         = case when v_tem_fat and p.nf_url is null then v_numero else p.nf_numero end,
         nf_data_upload    = case when v_tem_fat and p.nf_url is null then v_emissao::timestamp else p.nf_data_upload end
   where p.id = p_pedido_id;

  -- 4) Nota e títulos.
  if v_tem_fat then
    insert into public.faturamentos (
      pedido_id, numero_nf, data_emissao, nf_url, nf_arquivos, itens, valor_total,
      status, transportadora, pagamentos, metodo_pagamento
    ) values (
      p_pedido_id, v_numero, v_emissao, v_url, v_arquivos, v_fat_itens, v_valor_fat,
      'faturado', v_transp, v_pags, v_pags->0->>'metodo'
    ) returning id into v_fat_id;

    -- Partes que não são boleto viram título agora (não terão boleto para
    -- anexar depois). Sem vencimento de propósito: entram no em-aberto, nunca
    -- no vencido. Numeração 900+ para não colidir com as parcelas do boleto.
    select count(*) into v_qtd_titulos
      from jsonb_array_elements(v_pags) e
     where e->>'metodo' not in ('boleto', 'boleto_faturado');
    for v_pag in select * from jsonb_array_elements(v_pags) loop
      v_metodo := v_pag->>'metodo';
      continue when v_metodo in ('boleto', 'boleto_faturado');
      v_rotulo := case v_metodo
                    when 'cartao_credito' then 'Cartão de Crédito'
                    when 'pix'            then 'PIX'
                    when 'a_vista'        then 'À Vista'
                    when 'transferencia'  then 'Transferência'
                    else v_metodo end;
      insert into public.carteira (
        pedido_id, faturamento_id, tipo, status, valor, data_vencimento,
        parcela_numero, total_parcelas, metodo_pagamento, descricao,
        loja_id, cliente_user_id, fornecedor_id
      ) values (
        p_pedido_id, v_fat_id, 'a_receber', 'pendente', (v_pag->>'valor')::numeric, null,
        900 + v_i_titulo, v_qtd_titulos, v_metodo, v_rotulo || ' - NF #' || v_numero,
        v_ped.loja_id, v_ped.comprador_user_id, v_ped.fornecedor_id
      );
      v_i_titulo := v_i_titulo + 1;
    end loop;

    if p_parcelas_boleto is not null and jsonb_typeof(p_parcelas_boleto) = 'array'
       and jsonb_array_length(p_parcelas_boleto) > 0 then
      v_parc := public.substituir_parcelas(v_fat_id, p_parcelas_boleto, p_pedido_id);
    end if;
  end if;

  return jsonb_build_object(
    'faturamento_id',    v_fat_id,
    'status',            v_status,
    'todos_resolvidos',  coalesce(v_todos, false),
    'valor_faturamento', v_valor_fat,
    'valor_quebra',      v_valor_que,
    'valor_faturado',    coalesce(v_ped.valor_faturado, 0) + v_valor_fat,
    'valor_quebra_total', coalesce(v_ped.valor_quebra, 0) + v_valor_que,
    'saldo_pendente',    coalesce(v_ped.valor_total, 0)
                           - (coalesce(v_ped.valor_faturado, 0) + v_valor_fat)
                           - (coalesce(v_ped.valor_quebra, 0) + v_valor_que),
    'titulos_criados',   v_i_titulo,
    'parcelas_boleto',   v_parc
  );
end;
$$;

revoke all on function public.registrar_faturamento(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_faturamento(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated, service_role;
revoke all on function public.calc_meses_faturamento(uuid) from public, anon;
grant execute on function public.calc_meses_faturamento(uuid) to authenticated, service_role;

comment on function public.registrar_faturamento(uuid, jsonb, jsonb, jsonb, jsonb) is
  'T7: fatura (total/parcial) ou registra quebra numa transação: saldo por item, nota, títulos 900+, parcelas de boleto opcionais e somas do pedido. Admin ou fornecedor dono.';
