-- T6, parte 2: o boleto da NOTA substitui o boleto antecipado do PEDIDO.
--
-- Caso real (relatório de conciliação de 23/11): 24 pedidos receberam boleto
-- "pelo pedido" antes de faturar (títulos sem faturamento_id). Ao faturar e
-- mandar o boleto pela nota, a versão anterior desta função só trocava os
-- títulos DA NOTA; os antecipados ficavam e o cliente voltava a dever em dobro,
-- sem que o fornecedor pudesse removê-los (o boleto por pedido é recusado
-- depois que existe nota).
--
-- Regra nova (aprovada pelo dono em 23/11), só no escopo por nota:
--   * pedido com UMA nota: os títulos antecipados do pedido (sem
--     faturamento_id) entram no escopo. Os pendentes são substituídos pelo
--     boleto da nota; os pagos e os em análise são preservados e passam a
--     ficar vinculados à nota (faturamento_id), contando no teto da nota.
--     Se um antecipado preservado e uma parcela preservada da nota tiverem o
--     mesmo número, a troca é recusada (caso para o admin resolver);
--   * pedido com mais de uma nota: não há como saber a qual nota o antecipado
--     pertence. Nada muda nele, e a função devolve "antecipadas_mantidas" para
--     a tela avisar.
-- O resto é igual a 20261124002805_t6_substituir_parcelas.sql.
--
-- Rollback: reaplicar o create or replace de
--   supabase/migrations/20261124002805_t6_substituir_parcelas.sql

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
  v_unica_nota boolean := false;
  v_adotar     uuid[];
  v_adotadas   int := 0;
  v_antecip    int := 0;
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

  if p_faturamento_id is not null then
    v_unica_nota := (select count(*) from public.faturamentos f where f.pedido_id = v_pedido_id) = 1;
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
  -- Com uma nota só, o boleto antecipado do pedido (sem faturamento_id) entra
  -- no escopo da nota.
  select coalesce(array_agg(c.id) filter (where coalesce(c.status, 'pendente') not in ('pago', 'em_analise')), '{}'),
         coalesce(array_agg(c.id) filter (where c.status in ('pago', 'em_analise')), '{}'),
         coalesce(array_agg(c.parcela_numero order by c.parcela_numero)
                    filter (where c.status in ('pago', 'em_analise')), '{}'),
         coalesce(array_agg(c.id) filter (where c.status in ('pago', 'em_analise')
                                            and c.faturamento_id is null
                                            and p_faturamento_id is not null), '{}')
    into v_trocar, v_manter, v_preserv, v_adotar
    from (
      select c.id, c.status, c.parcela_numero, c.faturamento_id
        from public.carteira c
       where c.parcela_numero is not null
         and case
               when p_faturamento_id is not null then
                 (c.faturamento_id = p_faturamento_id
                  and c.parcela_numero < 900
                  and (c.metodo_pagamento is null or c.metodo_pagamento in ('boleto', 'boleto_faturado')))
                 or (v_unica_nota
                     and c.pedido_id = v_pedido_id
                     and c.faturamento_id is null)
               else
                 c.pedido_id = v_pedido_id and c.faturamento_id is null
             end
         for update
    ) c;

  -- Antecipado preservado com o mesmo número de uma parcela preservada da nota:
  -- vincular os dois à nota quebraria o índice único. Fica para o admin.
  if cardinality(v_preserv) <> (select count(distinct x) from unnest(v_preserv) x) then
    raise exception 'O boleto antecipado do pedido e o da nota têm parcelas pagas ou em análise com o mesmo número; peça ao admin para conciliar'
      using errcode = '22023';
  end if;

  -- Total do jogo novo = números enviados + números preservados.
  select count(*) into v_total from (
    select (e->>'parcela_numero')::int from jsonb_array_elements(p_parcelas) e
    union
    select unnest(v_preserv)
  ) n;

  -- Sai o que ainda não foi pago nem tem comprovante em análise.
  delete from public.carteira where id = any(v_trocar);
  get diagnostics v_removidas = row_count;

  -- Antecipados pagos/em análise passam a pertencer à nota.
  if cardinality(v_adotar) > 0 then
    update public.carteira
       set faturamento_id = p_faturamento_id, updated_at = now()
     where id = any(v_adotar);
    get diagnostics v_adotadas = row_count;
  end if;

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

  -- Pedido com mais de uma nota: antecipados ficaram de fora; a tela avisa.
  if p_faturamento_id is not null and not v_unica_nota then
    select count(*) into v_antecip
      from public.carteira c
     where c.pedido_id = v_pedido_id
       and c.faturamento_id is null
       and c.parcela_numero is not null
       and c.status in ('pendente', 'atrasado');
  end if;

  return jsonb_build_object(
    'removidas',   v_removidas,
    'adotadas',    v_adotadas,
    'antecipadas_mantidas', v_antecip,
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
  'T6: troca as parcelas de boleto de uma nota (ou de um pedido sem nota) numa transação, preservando pagas e em análise. Com uma nota só, o boleto da nota substitui o boleto antecipado do pedido. Admin ou fornecedor dono.';
