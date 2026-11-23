-- T4 (diagnostico de 23/11/2026, achado C5): o cliente deixa de controlar o
-- pedido. Preco continua vindo do carrinho ate a T9 (criar_pedido).
--
-- INSERT (novo trg_pedidos_guard_insert), para quem nao e admin:
--   * forca status 'novo_pedido', status_pagamento 'pendente',
--     emitido_por_admin_user_id null, criado_por_user_id = auth.uid() e zera
--     pagamento, desconto, frete, faturado e NF;
--   * recusa pedido sem itens ou com valor <= 0;
--   * recusa comprador bloqueado, loja bloqueada ou loja de outro dono;
--   * vendedor so compra em nome de cliente (multimarca ou franqueado).
--   Fornecedor nao tem fluxo de criar pedido (pedidos_insert so deixa ele
--   comprar para si), entao cai na mesma regra do cliente.
--
-- UPDATE (pedidos_guard_colunas ampliado):
--   * admin: livre. Edge Functions e cron: livres.
--   * todos os outros: nao mudam comprador, loja, emitido_por_admin_user_id nem
--     a autoria (criado_por_*). Isso fecha o desvio "zera o lote e cancela".
--   * fornecedor no proprio pedido: segue livre no resto (aceitar, faturar,
--     boleto, NF, PIX, frete, pagamento).
--   * cliente e vendedor: nao mudam itens, valores, desconto, frete, faturado,
--     data de pagamento, NF, estoque_baixado nem data_aprovacao; status de
--     pagamento so pendente -> em_analise (comprovante); status so
--       novo_pedido   -> cancelado (lote continua barrado pelo outro trigger),
--       em_transporte -> pendente_pagamento (confirmando o recebimento),
--       em_transporte -> finalizado (confirmando o recebimento, tudo pago).
--
-- Rollback:
--   drop trigger trg_pedidos_guard_insert on public.pedidos;
--   drop function public.pedidos_guard_insert();
--   e recriar pedidos_guard_colunas com a definicao anterior, copiada no fim
--   deste arquivo.

create or replace function public.pedidos_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel      text;
  v_comprador  record;
  v_loja       record;
begin
  if public.chamada_de_servidor() then return new; end if;
  v_papel := public.app_role();
  if v_papel = 'admin' then return new; end if;

  -- Estado inicial: quem decide o resto e o fornecedor ou a administracao.
  new.status                    := 'novo_pedido';
  new.status_pagamento          := 'pendente';
  new.emitido_por_admin_user_id := null;
  new.criado_por_user_id        := auth.uid();
  new.criado_por_papel          := case
                                     when v_papel = 'vendedor'
                                      and new.comprador_user_id is distinct from auth.uid()
                                     then 'vendedor' else 'cliente' end;
  new.data_pagamento            := null;
  new.data_aprovacao            := null;
  new.desconto                  := 0;
  new.valor_frete               := 0;
  new.valor_faturado            := 0;
  new.valor_quebra              := 0;
  new.nf_url                    := null;
  new.nf_numero                 := null;
  new.nf_data_upload            := null;
  new.nota_fiscal               := null;

  if new.itens is null or jsonb_typeof(new.itens) <> 'array'
     or jsonb_array_length(new.itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;
  if coalesce(new.valor_total, 0) <= 0 or coalesce(new.valor_final, 0) <= 0 then
    raise exception 'Valor do pedido invalido';
  end if;

  select u.bloqueado, u.role into v_comprador
    from public.users u where u.id = new.comprador_user_id;
  if not found then
    raise exception 'Comprador do pedido nao encontrado';
  end if;
  if new.comprador_user_id is distinct from auth.uid()
     and coalesce(v_comprador.role, '') not in ('multimarca', 'franqueado') then
    raise exception 'Pedido em nome de outro so para cliente multimarca ou franqueado';
  end if;
  if coalesce(v_comprador.bloqueado, false) then
    raise exception 'Conta bloqueada: regularize os pagamentos para fazer novos pedidos';
  end if;

  if new.loja_id is not null then
    select l.user_id, l.bloqueada into v_loja
      from public.lojas l where l.id = new.loja_id;
    if not found or v_loja.user_id is distinct from new.comprador_user_id then
      raise exception 'Loja do pedido nao pertence ao comprador';
    end if;
    if coalesce(v_loja.bloqueada, false) then
      raise exception 'Loja bloqueada: regularize a situacao para fazer pedidos';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.pedidos_guard_insert() from anon, public;

drop trigger if exists trg_pedidos_guard_insert on public.pedidos;
create trigger trg_pedidos_guard_insert
  before insert on public.pedidos
  for each row execute function public.pedidos_guard_insert();


create or replace function public.pedidos_guard_colunas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel text;
begin
  if public.chamada_de_servidor() then return new; end if;
  v_papel := public.app_role();
  if v_papel = 'admin' then return new; end if;

  -- Dono, loja e autoria: so a administracao.
  if new.comprador_user_id            is distinct from old.comprador_user_id
     or new.loja_id                   is distinct from old.loja_id
     or new.emitido_por_admin_user_id is distinct from old.emitido_por_admin_user_id
     or new.criado_por_user_id        is distinct from old.criado_por_user_id
     or new.criado_por_papel          is distinct from old.criado_por_papel then
    raise exception 'Somente a administracao pode alterar o dono, a loja ou a origem do pedido';
  end if;

  -- Fornecedor no proprio pedido: opera o pedido (aceite, faturamento, boleto,
  -- NF, PIX, frete, pagamento).
  if v_papel = 'fornecedor'
     and old.fornecedor_id = public.meu_fornecedor_id()
     and new.fornecedor_id = public.meu_fornecedor_id() then
    return new;
  end if;

  -- Cliente (comprador) e vendedor.
  if new.fornecedor_id      is distinct from old.fornecedor_id
     or new.itens           is distinct from old.itens
     or new.valor_total     is distinct from old.valor_total
     or new.valor_final     is distinct from old.valor_final
     or new.desconto        is distinct from old.desconto
     or new.valor_frete     is distinct from old.valor_frete
     or new.valor_frete_fob is distinct from old.valor_frete_fob
     or new.valor_faturado  is distinct from old.valor_faturado
     or new.valor_quebra    is distinct from old.valor_quebra then
    raise exception 'Somente a equipe pode alterar itens, valores ou o dono do pedido';
  end if;

  if new.data_pagamento     is distinct from old.data_pagamento
     or new.data_aprovacao  is distinct from old.data_aprovacao
     or new.nf_url          is distinct from old.nf_url
     or new.nf_numero       is distinct from old.nf_numero
     or new.nf_data_upload  is distinct from old.nf_data_upload
     or new.nota_fiscal     is distinct from old.nota_fiscal
     or new.estoque_baixado is distinct from old.estoque_baixado then
    raise exception 'Somente o fornecedor ou a administracao podem alterar pagamento, nota fiscal ou estoque do pedido';
  end if;

  -- Comprovante do pedido: pendente -> em_analise.
  if new.status_pagamento is distinct from old.status_pagamento
     and not (coalesce(old.status_pagamento, 'pendente') = 'pendente'
              and new.status_pagamento = 'em_analise') then
    raise exception 'Somente o fornecedor ou a administracao podem alterar o status de pagamento';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'novo_pedido' and new.status = 'cancelado' then
      null; -- cancelar antes do aceite (lote: pedidos_bloqueia_cancelar_lote)
    elsif old.status = 'em_transporte'
          and new.status in ('pendente_pagamento', 'finalizado')
          and coalesce(new.cliente_confirmou_recebimento, false) then
      if new.status = 'finalizado' and not (
           case when exists (select 1 from public.carteira c
                              where c.pedido_id = new.id and c.parcela_numero is not null)
                then not exists (select 1 from public.carteira c
                                  where c.pedido_id = new.id and c.parcela_numero is not null
                                    and c.status is distinct from 'pago')
                else coalesce(old.status_pagamento, '') in ('pago', 'pago_total')
           end) then
        raise exception 'Pedido com parcelas em aberto nao pode ser finalizado';
      end if;
    else
      raise exception 'Mudanca de status nao permitida: % -> %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

-- Definicao anterior de pedidos_guard_colunas (para rollback):
--
-- create or replace function public.pedidos_guard_colunas()
--  returns trigger language plpgsql security definer set search_path to 'public'
-- as $function$
-- begin
--   if coalesce(auth.role(), '') = 'service_role' then return new; end if;
--   if public.ve_todos_pedidos()
--      or (public.app_role() = 'fornecedor' and new.fornecedor_id = public.meu_fornecedor_id()) then
--     return new;
--   end if;
--
--   if new.comprador_user_id is distinct from old.comprador_user_id
--      or new.fornecedor_id   is distinct from old.fornecedor_id
--      or new.itens           is distinct from old.itens
--      or new.valor_total     is distinct from old.valor_total
--      or new.valor_final     is distinct from old.valor_final then
--     raise exception 'Somente a equipe pode alterar itens, valores ou o dono do pedido';
--   end if;
--   return new;
-- end $function$;
