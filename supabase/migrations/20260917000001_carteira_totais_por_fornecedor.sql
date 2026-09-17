-- users.total_vencido / total_em_aberto (ver 20260816000001) sao a posicao
-- GLOBAL do cliente: somam a carteira de TODOS os fornecedores.
--
-- Na tela de pedidos do fornecedor isso virava um numero enganoso. A Green
-- River, por exemplo, deve a MX72 e a VENTURY; o fornecedor que abria o card
-- dela via o total das duas como se fosse divida com ele.
--
-- Esta view quebra o mesmo calculo por (cliente, fornecedor). A regra e
-- identica a de recalcular_totais_cliente -- se uma mudar, a outra tem que
-- mudar junto:
--   em aberto = parcela real (parcela_numero not null, ou seja, ja tem boleto)
--               ainda nao quitada
--   vencido   = o subconjunto dela que passou do vencimento
--
-- security_invoker: a view roda com a permissao de quem consulta, entao a
-- policy carteira_select e quem faz o recorte -- fornecedor enxerga so as
-- linhas dele, cliente so as proprias, admin tudo. Sem isso a view rodaria
-- como o dono e vazaria a carteira inteira. Mesmo padrao de pedidos_resumo.

create or replace view public.carteira_totais_cliente_fornecedor
with (security_invoker = true) as
  select c.cliente_user_id,
         c.fornecedor_id,
         coalesce(sum(c.valor) filter (
           where c.status in ('pendente', 'em_analise')
         ), 0) as total_em_aberto,
         coalesce(sum(c.valor) filter (
           where c.status = 'pendente'
             and c.data_vencimento < current_date
         ), 0) as total_vencido
    from public.carteira c
   where c.parcela_numero is not null  -- ignora placeholder sem boleto
   group by c.cliente_user_id, c.fornecedor_id;

grant select on public.carteira_totais_cliente_fornecedor to anon, authenticated;

-- A view sempre le o mesmo recorte (parcela real) e agrupa pelas duas colunas;
-- o indice parcial cobre so as 724 linhas que interessam das 6.219 da tabela.
-- Serve tambem o recorte por fornecedor_id que a policy carteira_select faz.
create index if not exists idx_carteira_totais_cliente_fornecedor
  on public.carteira (cliente_user_id, fornecedor_id)
  where parcela_numero is not null;
