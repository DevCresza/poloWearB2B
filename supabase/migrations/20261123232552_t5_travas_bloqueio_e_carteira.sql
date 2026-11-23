-- T5 (diagnostico de 23/11/2026, achado A5): o bloqueio por inadimplencia e a
-- carteira deixam de ser alteraveis pelo proprio cliente.
--
-- 1. chamada_de_servidor(): verdadeiro para service_role (Edge Functions) e para
--    sessoes SEM JWT nenhum (cron, migracoes, SQL do dono). Toda requisicao do
--    PostgREST traz o papel no JWT (anon ou authenticated), entao o navegador
--    nunca cai aqui.
-- 2. recalcular_totais_cliente(): marca a transacao (app.recalc_totais) enquanto
--    grava os totais derivados, para o guard de users deixar passar. Ela roda
--    dentro da requisicao do cliente (trigger carteira_sync_totais), com o JWT
--    dele.
-- 3. users_guard_privilegios: o proprio usuario nao muda bloqueado,
--    motivo_bloqueio, data_bloqueio, total_em_aberto, total_vencido nem
--    categoria_cliente. No auto-cadastro esses campos nascem zerados.
-- 4. lojas_guard_colunas (novo): o dono da loja nao mexe no bloqueio nem troca o
--    dono da loja.
-- 5. carteira_guard_colunas: o cliente so informa pagamento e manda comprovante
--    (status pendente -> em_analise). Vencimento, parcela, pedido, faturamento,
--    fornecedor, loja e boleto ficam com a equipe e o fornecedor. O fornecedor
--    passa a ser reconhecido tambem no titulo provisorio (sem fornecedor_id) de
--    pedido dele: marcar o pedido como pago falhava na cascata.
--
-- Rollback:
--   drop trigger trg_lojas_guard_colunas on public.lojas;
--   drop function public.lojas_guard_colunas();
--   e recriar users_guard_privilegios, carteira_guard_colunas e
--   recalcular_totais_cliente com as definicoes anteriores, copiadas no fim
--   deste arquivo. chamada_de_servidor() so pode sair depois do rollback da T4.

-- 1 -------------------------------------------------------------------------
create or replace function public.chamada_de_servidor()
returns boolean
language sql
stable
set search_path = public
as $$
  -- auth.role() e nulo quando nao ha JWT nenhum (cron, migracao, SQL do dono).
  select coalesce(auth.role(), 'service_role') = 'service_role'
$$;

revoke execute on function public.chamada_de_servidor() from anon, public;
grant execute on function public.chamada_de_servidor() to authenticated, service_role;

-- 2 -------------------------------------------------------------------------
create or replace function public.recalcular_totais_cliente(p_user_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- 3 -------------------------------------------------------------------------
create or replace function public.users_guard_privilegios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- Edge Functions (service_role), cron e SQL do dono: confiaveis.
  if public.chamada_de_servidor() then
    return new;
  end if;

  -- Totais derivados da carteira, gravados por recalcular_totais_cliente().
  if tg_op = 'UPDATE' and coalesce(current_setting('app.recalc_totais', true), '') = '1' then
    return new;
  end if;

  caller_role := public.app_role();

  if tg_op = 'INSERT' then
    -- Auto-cadastro publico (CadastroCompra) so pode gerar cliente multimarca.
    -- Sem isto, signup({role:'admin'}) cria um admin.
    if caller_role is distinct from 'admin' then
      if coalesce(new.role, '') <> 'multimarca'
         or coalesce(new.tipo_negocio, '') <> 'multimarca' then
        raise exception 'Auto-cadastro so pode criar conta multimarca';
      end if;
      new.permissoes        := '{}'::jsonb;
      new.limite_credito    := null;
      new.fornecedor_id     := null;
      new.bloqueado         := false;
      new.motivo_bloqueio   := null;
      new.data_bloqueio     := null;
      new.total_em_aberto   := 0;
      new.total_vencido     := 0;
      new.categoria_cliente := 'multimarca';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if caller_role is distinct from 'admin' then
      if new.role           is distinct from old.role
         or new.tipo_negocio   is distinct from old.tipo_negocio
         or new.permissoes     is distinct from old.permissoes
         or new.limite_credito is distinct from old.limite_credito
         or new.fornecedor_id  is distinct from old.fornecedor_id
         or new.ativo          is distinct from old.ativo then
        raise exception 'Somente admin pode alterar papel, permissoes, credito ou status';
      end if;
      if new.bloqueado            is distinct from old.bloqueado
         or new.motivo_bloqueio   is distinct from old.motivo_bloqueio
         or new.data_bloqueio     is distinct from old.data_bloqueio
         or new.total_em_aberto   is distinct from old.total_em_aberto
         or new.total_vencido     is distinct from old.total_vencido
         or new.categoria_cliente is distinct from old.categoria_cliente then
        raise exception 'Somente admin pode alterar bloqueio, totais ou categoria do cliente';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

-- 4 -------------------------------------------------------------------------
create or replace function public.lojas_guard_colunas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.chamada_de_servidor() or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.bloqueada       := false;
    new.motivo_bloqueio := null;
    new.data_bloqueio   := null;
    return new;
  end if;

  if new.bloqueada          is distinct from old.bloqueada
     or new.motivo_bloqueio is distinct from old.motivo_bloqueio
     or new.data_bloqueio   is distinct from old.data_bloqueio then
    raise exception 'Somente admin pode alterar o bloqueio da loja';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'Somente admin pode trocar o dono da loja';
  end if;
  return new;
end;
$$;

revoke execute on function public.lojas_guard_colunas() from anon, public;

create or replace trigger trg_lojas_guard_colunas
  before insert or update on public.lojas
  for each row execute function public.lojas_guard_colunas();

-- 5 -------------------------------------------------------------------------
create or replace function public.carteira_guard_colunas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.chamada_de_servidor() then return new; end if;

  -- Cancelamento em cascata a partir do pedido (cascade_cancelar_carteira...).
  if coalesce(current_setting('app.cascata_cancelamento', true), '') = '1'
     and tg_op = 'UPDATE'
     and new.status = 'cancelado'
     and new.valor is not distinct from old.valor
     and new.data_pagamento is not distinct from old.data_pagamento then
    return new;
  end if;

  -- Fornecedor: titulos dele e o titulo provisorio do checkout (sem
  -- fornecedor_id) de um pedido dele. Sem o segundo caso, marcar o pedido como
  -- pago falhava na cascata (cascade_pagamento_carteira...) sobre o provisorio.
  if public.is_admin()
     or (public.app_role() = 'fornecedor'
         and (new.fornecedor_id = public.meu_fornecedor_id()
              or (new.fornecedor_id is null
                  and exists (select 1 from public.pedidos p
                               where p.id = new.pedido_id
                                 and p.fornecedor_id = public.meu_fornecedor_id())))) then
    return new;
  end if;

  -- Daqui para baixo: cliente (e vendedor criando o titulo do checkout).
  if tg_op = 'INSERT' then
    if coalesce(new.status, '') not in ('pendente', '') then
      raise exception 'Titulo so pode ser criado como pendente';
    end if;
    if new.pedido_id is not null and not exists (
         select 1 from public.pedidos p
          where p.id = new.pedido_id
            and p.comprador_user_id = new.cliente_user_id) then
      raise exception 'Titulo de pedido que nao e deste cliente';
    end if;
    if new.loja_id is not null and not exists (
         select 1 from public.lojas l
          where l.id = new.loja_id
            and l.user_id = new.cliente_user_id) then
      raise exception 'Titulo de loja que nao e deste cliente';
    end if;
    new.status                   := 'pendente';
    new.data_pagamento           := null;
    new.data_pagamento_informada := null;
    new.comprovante_url          := null;
    new.comprovante_data_upload  := null;
    new.comprovante_aprovado     := null;
    new.comprovante_analisado    := null;
    new.boleto_url               := null;
    return new;
  end if;

  if new.valor                is distinct from old.valor
     or new.status               is distinct from old.status and coalesce(new.status,'') not in ('em_analise')
     or new.data_pagamento       is distinct from old.data_pagamento
     or new.comprovante_aprovado is distinct from old.comprovante_aprovado
     or new.cliente_user_id      is distinct from old.cliente_user_id then
    raise exception 'Somente a equipe pode dar baixa, alterar valor ou aprovar comprovante';
  end if;

  -- Enviar comprovante: so de um titulo pendente (ou reenviar estando em analise).
  if new.status is distinct from old.status
     and coalesce(old.status, '') not in ('pendente', 'em_analise') then
    raise exception 'Comprovante so pode ser enviado para titulo pendente';
  end if;
  -- O cliente so "desmarca" a analise ao reenviar; marcar como analisado e da equipe.
  if new.comprovante_analisado is distinct from old.comprovante_analisado
     and coalesce(new.comprovante_analisado, false) then
    raise exception 'Somente a equipe pode analisar comprovante';
  end if;

  if new.data_vencimento   is distinct from old.data_vencimento
     or new.parcela_numero is distinct from old.parcela_numero
     or new.total_parcelas is distinct from old.total_parcelas
     or new.pedido_id      is distinct from old.pedido_id
     or new.faturamento_id is distinct from old.faturamento_id
     or new.fornecedor_id  is distinct from old.fornecedor_id
     or new.loja_id        is distinct from old.loja_id
     or new.boleto_url     is distinct from old.boleto_url
     or new.tipo           is distinct from old.tipo then
    raise exception 'Somente a equipe ou o fornecedor podem alterar vencimento, parcela, vinculos ou boleto do titulo';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Definicoes anteriores (producao em 23/11/2026), para rollback:
--
-- create or replace function public.recalcular_totais_cliente(p_user_id uuid default null::uuid)
--  returns void language sql security definer set search_path to 'public'
-- as $function$
--   with derivado as (
--     select u.id,
--            coalesce(sum(c.valor) filter (where c.status in ('pendente', 'em_analise')), 0) as aberto,
--            coalesce(sum(c.valor) filter (where c.status = 'pendente' and c.data_vencimento < current_date), 0) as vencido
--       from public.users u
--       left join public.carteira c on c.cliente_user_id = u.id and c.parcela_numero is not null
--      where (p_user_id is null or u.id = p_user_id)
--      group by u.id
--   )
--   update public.users u
--      set total_em_aberto = d.aberto, total_vencido = d.vencido
--     from derivado d
--    where u.id = d.id
--      and (coalesce(u.total_em_aberto, 0) is distinct from d.aberto
--        or coalesce(u.total_vencido, 0)   is distinct from d.vencido);
-- $function$;
--
-- create or replace function public.users_guard_privilegios()
--  returns trigger language plpgsql security definer set search_path to 'public'
-- as $function$
-- declare caller_role text;
-- begin
--   if coalesce(auth.role(), '') = 'service_role' then return new; end if;
--   caller_role := public.app_role();
--   if tg_op = 'INSERT' then
--     if caller_role is distinct from 'admin' then
--       if coalesce(new.role, '') <> 'multimarca' or coalesce(new.tipo_negocio, '') <> 'multimarca' then
--         raise exception 'Auto-cadastro so pode criar conta multimarca';
--       end if;
--       new.permissoes := '{}'::jsonb; new.limite_credito := null;
--       new.fornecedor_id := null; new.bloqueado := false;
--     end if;
--     return new;
--   end if;
--   if tg_op = 'UPDATE' then
--     if caller_role is distinct from 'admin' then
--       if new.role is distinct from old.role or new.tipo_negocio is distinct from old.tipo_negocio
--          or new.permissoes is distinct from old.permissoes or new.limite_credito is distinct from old.limite_credito
--          or new.fornecedor_id is distinct from old.fornecedor_id or new.ativo is distinct from old.ativo then
--         raise exception 'Somente admin pode alterar papel, permissoes, credito ou status';
--       end if;
--     end if;
--     return new;
--   end if;
--   return new;
-- end;
-- $function$;
--
-- create or replace function public.carteira_guard_colunas()
--  returns trigger language plpgsql security definer set search_path to 'public'
-- as $function$
-- begin
--   if coalesce(auth.role(), '') = 'service_role' then return new; end if;
--   if coalesce(current_setting('app.cascata_cancelamento', true), '') = '1'
--      and tg_op = 'UPDATE' and new.status = 'cancelado'
--      and new.valor is not distinct from old.valor
--      and new.data_pagamento is not distinct from old.data_pagamento then
--     return new;
--   end if;
--   if public.is_admin()
--      or (public.app_role() = 'fornecedor' and new.fornecedor_id = public.meu_fornecedor_id()) then
--     return new;
--   end if;
--   if tg_op = 'INSERT' then
--     if coalesce(new.status, '') not in ('pendente', '') then
--       raise exception 'Titulo so pode ser criado como pendente';
--     end if;
--     new.data_pagamento := null; new.comprovante_aprovado := null; new.comprovante_analisado := null;
--     return new;
--   end if;
--   if new.valor is distinct from old.valor
--      or new.status is distinct from old.status and coalesce(new.status,'') not in ('em_analise')
--      or new.data_pagamento is distinct from old.data_pagamento
--      or new.comprovante_aprovado is distinct from old.comprovante_aprovado
--      or new.cliente_user_id is distinct from old.cliente_user_id then
--     raise exception 'Somente a equipe pode dar baixa, alterar valor ou aprovar comprovante';
--   end if;
--   return new;
-- end;
-- $function$;
