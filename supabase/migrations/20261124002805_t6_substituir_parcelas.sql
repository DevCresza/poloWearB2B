-- T6 (diagnóstico C6): substituir as parcelas de um boleto numa transação só.
--
-- Antes, seis pontos do front "apagavam e recriavam" os títulos um a um:
--   * o fornecedor não tem DELETE em carteira (policy carteira_delete = admin),
--     então o "apagar" voltava 0 linhas sem erro e o jogo novo era criado por
--     cima do antigo: cliente devendo em dobro;
--   * com admin, a mesma rotina apagava títulos PAGOS e EM ANÁLISE (com
--     comprovante já enviado pelo cliente);
--   * os títulos por pedido nasciam sem faturamento_id, fora do índice único
--     carteira_parcela_unica_por_faturamento.
--
-- substituir_parcelas(faturamento_id, parcelas, pedido_id):
--   * escopo por NOTA (faturamento_id informado): as parcelas de BOLETO daquela
--     nota (parcela_numero < 900; os títulos 900+ são as partes à vista/cartão/
--     pix criadas ao faturar e não são tocados);
--   * escopo por PEDIDO (faturamento_id nulo, pedido_id informado): as parcelas
--     do pedido sem faturamento_id. Recusado se o pedido já tem nota fiscal --
--     aí o boleto vai pela nota, senão nascem dois jogos para a mesma dívida;
--   * títulos 'pago' e 'em_analise' são preservados; uma parcela nova com o
--     mesmo número de um preservado é ignorada (não volta a ser cobrada) e o
--     total_parcelas passa a ser a união dos números enviados e preservados.
--     Lista vazia = ficam só os preservados;
--   * os demais títulos do escopo (pendente, atrasado, cancelado) são apagados
--     e o jogo novo é criado com pedido, cliente, loja e fornecedor tirados do
--     PEDIDO (nunca do chamador) e com o faturamento_id da nota;
--   * a soma dos títulos do escopo depois da troca não pode passar do valor da
--     nota (ou do pedido) + R$ 0,05. Na nota, o frete FOB "incluso no boleto"
--     entra no teto quando o pedido tem uma nota só;
--   * só admin ou o fornecedor dono do pedido chamam. SECURITY DEFINER porque o
--     fornecedor não tem DELETE em carteira; o papel é validado aqui dentro.
--
-- parcelas: [{ "parcela_numero": 1, "valor": 100.00, "data_vencimento": "2026-12-20",
--              "boleto_url": "https://...", "metodo_pagamento": "boleto",
--              "descricao": "Parcela 1/2 - NF #123" }, ...]
--
-- Rollback:
--   drop function if exists public.substituir_parcelas(uuid, jsonb, uuid);

create or replace function public.substituir_parcelas(
  p_faturamento_id uuid,
  p_parcelas jsonb,
  p_pedido_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_role       text := public.app_role();
  v_fat        public.faturamentos%rowtype;
  v_ped        public.pedidos%rowtype;
  v_pedido_id  uuid;
  v_total      int;
  v_limite     numeric;
  v_soma       numeric;
  v_removidas  int := 0;
  v_criadas    int := 0;
  v_preserv    int[];
  v_trocar     uuid[];
  v_manter     uuid[];
  v_ignoradas  int[] := '{}';
  v_item       jsonb;
  v_num        int;
  v_valor      numeric;
  v_venc       date;
  v_url        text;
begin
  if v_uid is null then
    raise exception 'Login necessário' using errcode = '42501';
  end if;

  -- Lista vazia é válida: "fica só o que já foi pago ou está em análise"
  -- (a edição do boleto que reduz as parcelas até sobrarem só as pagas).
  if jsonb_typeof(p_parcelas) is distinct from 'array' then
    raise exception 'Parcelas devem vir em uma lista' using errcode = '22023';
  end if;
  if jsonb_array_length(p_parcelas) > 48 then
    raise exception 'No máximo 48 parcelas' using errcode = '22023';
  end if;

  -- Escopo e travas: a linha do pedido (e da nota) fica presa até o fim, então
  -- dois reenvios simultâneos do mesmo boleto rodam em fila, não em paralelo.
  if p_faturamento_id is not null then
    select * into v_fat from public.faturamentos where id = p_faturamento_id for update;
    if not found then
      raise exception 'Nota fiscal não encontrada' using errcode = 'P0002';
    end if;
    if p_pedido_id is not null and p_pedido_id is distinct from v_fat.pedido_id then
      raise exception 'A nota não é deste pedido' using errcode = '22023';
    end if;
    v_pedido_id := v_fat.pedido_id;
  elsif p_pedido_id is not null then
    v_pedido_id := p_pedido_id;
  else
    raise exception 'Informe a nota fiscal ou o pedido' using errcode = '22023';
  end if;

  select * into v_ped from public.pedidos where id = v_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;

  -- Quem pode: admin, ou o fornecedor dono do pedido.
  if not (v_role = 'admin'
          or (v_role = 'fornecedor'
              and v_ped.fornecedor_id is not null
              and v_ped.fornecedor_id = public.meu_fornecedor_id())) then
    raise exception 'Sem permissão para alterar as parcelas deste pedido' using errcode = '42501';
  end if;

  if v_ped.status = 'cancelado' then
    raise exception 'Pedido cancelado não recebe parcelas' using errcode = '22023';
  end if;

  if p_faturamento_id is null
     and exists (select 1 from public.faturamentos f where f.pedido_id = v_pedido_id) then
    raise exception 'Este pedido já tem nota fiscal: envie ou atualize o boleto pela nota fiscal'
      using errcode = '22023';
  end if;

  -- Valida a lista inteira antes de mexer em qualquer coisa.
  for v_item in select * from jsonb_array_elements(p_parcelas) loop
    begin
      v_num   := (v_item->>'parcela_numero')::int;
      v_valor := round((v_item->>'valor')::numeric, 2);
      v_venc  := (v_item->>'data_vencimento')::date;
    exception when others then
      raise exception 'Parcela com número, valor ou vencimento inválido' using errcode = '22023';
    end;
    if v_num is null or v_num < 1 or v_num >= 900 then
      raise exception 'Número de parcela inválido: %', v_num using errcode = '22023';
    end if;
    if v_valor is null or v_valor <= 0 then
      raise exception 'Valor da parcela % precisa ser maior que zero', v_num using errcode = '22023';
    end if;
    if v_venc is null then
      raise exception 'Informe o vencimento da parcela %', v_num using errcode = '22023';
    end if;
  end loop;
  if (select count(distinct (e->>'parcela_numero')::int) from jsonb_array_elements(p_parcelas) e)
     <> jsonb_array_length(p_parcelas) then
    raise exception 'Número de parcela repetido' using errcode = '22023';
  end if;

  -- Títulos do escopo, presos até o fim da transação.
  select coalesce(array_agg(c.id) filter (where coalesce(c.status, 'pendente') not in ('pago', 'em_analise')), '{}'),
         coalesce(array_agg(c.id) filter (where c.status in ('pago', 'em_analise')), '{}'),
         coalesce(array_agg(c.parcela_numero order by c.parcela_numero)
                    filter (where c.status in ('pago', 'em_analise')), '{}')
    into v_trocar, v_manter, v_preserv
    from (
      select c.id, c.status, c.parcela_numero
        from public.carteira c
       where c.parcela_numero is not null
         and case
               when p_faturamento_id is not null then
                 c.faturamento_id = p_faturamento_id
                 and c.parcela_numero < 900
                 and (c.metodo_pagamento is null or c.metodo_pagamento in ('boleto', 'boleto_faturado'))
               else
                 c.pedido_id = v_pedido_id and c.faturamento_id is null
             end
         for update
    ) c;

  -- Total do jogo novo = números enviados + números preservados.
  select count(*) into v_total from (
    select (e->>'parcela_numero')::int from jsonb_array_elements(p_parcelas) e
    union
    select unnest(v_preserv)
  ) n;

  -- Sai o que ainda não foi pago nem tem comprovante em análise.
  delete from public.carteira where id = any(v_trocar);
  get diagnostics v_removidas = row_count;

  -- Preservados: só o total de parcelas acompanha o jogo novo (exibição "2/3").
  update public.carteira
     set total_parcelas = v_total, updated_at = now()
   where id = any(v_manter)
     and total_parcelas is distinct from v_total;

  for v_item in select * from jsonb_array_elements(p_parcelas) loop
    v_num := (v_item->>'parcela_numero')::int;
    if v_num = any(v_preserv) then
      v_ignoradas := v_ignoradas || v_num;
      continue;
    end if;
    v_url := nullif(btrim(coalesce(v_item->>'boleto_url', '')), '');
    insert into public.carteira (
      pedido_id, faturamento_id, cliente_user_id, fornecedor_id, loja_id,
      tipo, status, valor, data_vencimento, parcela_numero, total_parcelas,
      metodo_pagamento, boleto_url, descricao
    ) values (
      v_pedido_id, p_faturamento_id, v_ped.comprador_user_id, v_ped.fornecedor_id, v_ped.loja_id,
      'a_receber', 'pendente', round((v_item->>'valor')::numeric, 2),
      (v_item->>'data_vencimento')::date, v_num, v_total,
      nullif(v_item->>'metodo_pagamento', ''), v_url,
      left(nullif(v_item->>'descricao', ''), 300)
    );
    v_criadas := v_criadas + 1;
  end loop;

  -- Teto: nada de títulos acima da nota (ou do pedido).
  if p_faturamento_id is not null then
    -- Frete FOB "incluso no boleto" não está no valor da nota. Com uma nota
    -- só, ele entra no boleto dela; com várias, não há como saber em qual.
    v_limite := coalesce(v_fat.valor_total, 0)
      + case when coalesce(v_ped.frete_incluso_boleto, false)
                  and coalesce(v_ped.valor_frete_fob, 0) > 0
                  and (select count(*) from public.faturamentos f where f.pedido_id = v_pedido_id) = 1
             then v_ped.valor_frete_fob else 0 end;
    select coalesce(sum(c.valor), 0) into v_soma
      from public.carteira c
     where c.faturamento_id = p_faturamento_id
       and c.parcela_numero is not null
       and c.status is distinct from 'cancelado';
  else
    v_limite := greatest(coalesce(v_ped.valor_final, 0), coalesce(v_ped.valor_total, 0));
    select coalesce(sum(c.valor), 0) into v_soma
      from public.carteira c
     where c.pedido_id = v_pedido_id
       and c.faturamento_id is null
       and c.parcela_numero is not null
       and c.status is distinct from 'cancelado';
  end if;
  if v_soma > v_limite + 0.05 then
    raise exception 'As parcelas (contando as pagas e as em análise) somariam R$ %, acima do valor %, R$ %',
      round(v_soma, 2),
      case when p_faturamento_id is not null then 'da nota' else 'do pedido' end,
      round(v_limite, 2)
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'removidas',   v_removidas,
    'criadas',     v_criadas,
    'preservadas', to_jsonb(v_preserv),
    'ignoradas',   to_jsonb(v_ignoradas),
    'soma',        v_soma,
    'limite',      v_limite
  );
end;
$$;

revoke all on function public.substituir_parcelas(uuid, jsonb, uuid) from public, anon;
grant execute on function public.substituir_parcelas(uuid, jsonb, uuid) to authenticated, service_role;

comment on function public.substituir_parcelas(uuid, jsonb, uuid) is
  'T6: troca as parcelas de boleto de uma nota (ou de um pedido sem nota) numa transação, preservando pagas e em análise. Admin ou fornecedor dono.';
