-- Pagamento dividido na MESMA nota: parte no cartao, resto no boleto.
--
-- Ate agora o boleto de uma NF era gerado sobre o valor CHEIO dela
-- (handleEnviarBoletoNF: valorBase = faturamento.valor_total). Com parte paga
-- no cartao, isso cobraria o franqueado duas vezes pela mesma mercadoria --
-- cartao fora do sistema e boleto integral dentro dele.
--
-- valor_cartao diz quanto daquela nota sai no cartao; o boleto passa a cobrir
-- valor_total - valor_cartao.
alter table public.faturamentos
  add column if not exists valor_cartao numeric not null default 0;

comment on column public.faturamentos.valor_cartao is
  'Parte desta NF paga no cartao. O boleto cobre valor_total - valor_cartao.';

-- A carteira nao distinguia COMO cada titulo e pago: tudo parecia boleto.
-- Com a divisao isso deixa de ser detalhe -- o financeiro precisa saber que
-- aquele titulo nao tem boleto para conciliar porque e cartao.
alter table public.carteira
  add column if not exists metodo_pagamento text;

comment on column public.carteira.metodo_pagamento is
  'Como este titulo e pago. Herda do faturamento/pedido; cartao na divisao.';

-- Titulos antigos herdam o metodo de quem os originou, para a coluna nao
-- nascer meio vazia e o filtro do financeiro valer para o historico.
update public.carteira c
   set metodo_pagamento = coalesce(
         (select f.metodo_pagamento from public.faturamentos f where f.id = c.faturamento_id),
         (select p.metodo_pagamento from public.pedidos p where p.id = c.pedido_id)
       )
 where c.metodo_pagamento is null
   and c.parcela_numero is not null;
