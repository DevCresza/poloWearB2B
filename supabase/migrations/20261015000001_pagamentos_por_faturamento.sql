-- Divisao de pagamento GERAL, no lugar do "parte no cartao" de 20261008000002.
--
-- Aquela versao assumia "cartao + boleto" e vivia no fluxo do boleto. O caso
-- real do Bruno e outro: metade a vista, metade no credito -- nenhum boleto
-- envolvido, entao o campo nunca aparecia. A divisao nao e entre cartao e
-- boleto, e entre QUAISQUER formas, e acontece na hora de faturar.
--
-- pagamentos: [{"metodo": "a_vista", "valor": 8638.56},
--              {"metodo": "cartao_credito", "valor": 8638.56}]
--
-- metodo_pagamento continua e guarda a PRIMEIRA forma da lista: relatorios,
-- exports e o PDF do pedido leem essa coluna, e nao vale quebra-los.
--
-- valor_cartao (de 20261008000002) para de ser usado pelo codigo. Era a mesma
-- informacao num segundo lugar, e duas fontes de verdade para dinheiro foi
-- exatamente o que produziu a cobranca errada da NF 1199. Ninguem chegou a
-- usar: zero notas com valor_cartao > 0 e zero titulos de cartao, em 775
-- faturamentos.
--
-- A coluna NAO e removida aqui de proposito: dropar coluna em producao e
-- irreversivel e o ganho seria so estetico. Fica morta, sem leitor no src.

alter table public.faturamentos
  add column if not exists pagamentos jsonb not null default '[]'::jsonb;

comment on column public.faturamentos.pagamentos is
  'Divisao do pagamento desta NF: [{metodo, valor}]. Soma = valor_total. metodo_pagamento espelha a primeira forma.';

-- Faturamento antigo tem uma forma so; entra na lista para as telas lerem
-- sempre do mesmo lugar.
update public.faturamentos
   set pagamentos = jsonb_build_array(
         jsonb_build_object('metodo', metodo_pagamento, 'valor', valor_total)
       )
 where metodo_pagamento is not null
   and pagamentos = '[]'::jsonb;
