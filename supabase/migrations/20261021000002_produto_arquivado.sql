-- Arquivar produto: coleção encerrada sai de circulação.
--
-- Troca de estação enche a tela de produtos de inverno que ninguem vai mais
-- vender. Desativar (ativo=false) nao resolve: o produto continua na gestao,
-- ocupando espaco e aparecendo em "Todos".
--
-- arquivado e DIFERENTE de ativo, de proposito:
--
--   ativo = false    fora de venda agora, mas segue na gestao do dia a dia
--                    (ex: ruptura, produto suspenso, vai voltar)
--   arquivado = true coleção encerrada. Some da gestao por padrao E do
--                    catalogo do cliente, independente de ativo.
--
-- Por isso sao duas colunas e nao um status unico: um produto pode estar
-- inativo e voltar a ser ativo sem nunca ter sido arquivado, e um produto
-- arquivado pode ter sido arquivado estando ativo.
--
-- arquivado_em responde "de quando e esta coleção?" na hora de desarquivar.

alter table public.produtos
  add column if not exists arquivado boolean not null default false,
  add column if not exists arquivado_em timestamptz;

comment on column public.produtos.arquivado is
  'Colecao encerrada: some da gestao por padrao e do catalogo do cliente. Diferente de ativo=false, que e fora de venda temporario.';

-- A gestao sempre filtra por "nao arquivado" e o catalogo tambem; o indice
-- parcial cobre so os que continuam em circulacao, que e o lado consultado.
create index if not exists idx_produtos_nao_arquivados
  on public.produtos (fornecedor_id)
  where arquivado = false;
