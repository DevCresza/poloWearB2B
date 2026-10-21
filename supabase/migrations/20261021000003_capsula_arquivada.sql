-- Arquivar CAPSULA, e separar isso de "um produto da capsula foi arquivado".
--
-- Na primeira versao (20261021000002) a capsula sumia inteira quando qualquer
-- produto dela era arquivado -- isCapsulaVisivelParaCliente exige todos os
-- internos visiveis. Na pratica isso e perder a capsula por causa de uma peca:
-- arquivar um item de inverno derrubava toda capsula que o continha.
--
-- Agora sao duas coisas distintas:
--
--   produto arquivado dentro da capsula  -> some so ele; a capsula continua,
--                                           com um item a menos e preco menor
--   capsula arquivada                    -> some a capsula inteira
--
-- Quem decide encerrar a capsula e a pessoa, nao um efeito colateral.

alter table public.capsulas
  add column if not exists arquivada boolean not null default false,
  add column if not exists arquivada_em timestamptz;

comment on column public.capsulas.arquivada is
  'Capsula encerrada: some da gestao por padrao e do catalogo. Produto arquivado dentro de uma capsula ATIVA some so ele, a capsula continua.';
