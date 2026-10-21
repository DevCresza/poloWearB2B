-- Fornecedor nao conseguia cancelar pedido: 3.319 de 3.902 cancelaveis (85%).
--
-- Cancelar um pedido dispara trg_cascade_cancelar_carteira, que marca como
-- cancelados os titulos daquele pedido. Esse UPDATE passa por
-- carteira_guard_colunas, que permite a escrita quando:
--
--   app_role() = 'fornecedor' AND new.fornecedor_id = meu_fornecedor_id()
--
-- Acontece que as linhas que o Carrinho cria no checkout -- os placeholders,
-- sem parcela_numero -- nascem com fornecedor_id NULL. Para elas a condicao
-- vira NULL, nao verdadeira, e o guard levanta "Somente a equipe pode dar
-- baixa, alterar valor ou aprovar comprovante". A excecao derruba a transacao
-- inteira e o fornecedor ve "Erro ao cancelar pedido" sem nenhuma pista: a
-- mensagem fala de baixa e comprovante, assuntos que nada tem a ver com o que
-- ele tentou fazer.
--
-- SECURITY DEFINER na cascata nao ajuda: ela troca o papel do BANCO, enquanto
-- o guard decide pela identidade da APLICACAO (auth.uid()/app_role()), que
-- continua sendo a do fornecedor.
--
-- A correcao trata a causa certa: cancelar em cascata e acao do SISTEMA,
-- consequencia de um cancelamento que a RLS de pedidos ja autorizou. Nao e o
-- cliente mexendo na propria divida, que e o que o guard existe para impedir.
-- A cascata marca a transacao com uma flag e o guard a respeita.
--
-- A flag e local a transacao (set_config com is_local = true) e so a cascata a
-- define. Pelo PostgREST um cliente nao consegue executar set_config, entao
-- isso nao abre caminho para ele se dar por pago.

create or replace function public.cascade_cancelar_carteira_ao_cancelar_pedido()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'cancelado' and (old.status is distinct from 'cancelado') then
    -- Diz ao guard que o que vem a seguir e a cascata, nao o cliente.
    perform set_config('app.cascata_cancelamento', '1', true);

    update public.carteira
       set status = 'cancelado',
           updated_at = now()
     where pedido_id = new.id
       and status not in ('cancelado', 'pago');

    perform set_config('app.cascata_cancelamento', '', true);
  end if;
  return new;
end;
$$;

create or replace function public.carteira_guard_colunas()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;

  -- Cancelamento em cascata de um pedido ja autorizado. So muda status para
  -- 'cancelado' -- nunca da baixa, nunca mexe em valor.
  if coalesce(current_setting('app.cascata_cancelamento', true), '') = '1'
     and tg_op = 'UPDATE'
     and new.status = 'cancelado'
     and new.valor is not distinct from old.valor
     and new.data_pagamento is not distinct from old.data_pagamento then
    return new;
  end if;

  if public.is_admin()
     or (public.app_role() = 'fornecedor' and new.fornecedor_id = public.meu_fornecedor_id()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Titulo nasce pendente e sem baixa.
    if coalesce(new.status, '') not in ('pendente', '') then
      raise exception 'Titulo so pode ser criado como pendente';
    end if;
    new.data_pagamento        := null;
    new.comprovante_aprovado  := null;
    new.comprovante_analisado := null;
    return new;
  end if;

  if new.valor                is distinct from old.valor
     or new.status               is distinct from old.status and coalesce(new.status,'') not in ('em_analise')
     or new.data_pagamento       is distinct from old.data_pagamento
     or new.comprovante_aprovado is distinct from old.comprovante_aprovado
     or new.cliente_user_id      is distinct from old.cliente_user_id then
    raise exception 'Somente a equipe pode dar baixa, alterar valor ou aprovar comprovante';
  end if;
  return new;
end;
$$;
