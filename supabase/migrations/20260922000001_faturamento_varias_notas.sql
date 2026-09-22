-- Um faturamento podia carregar UMA nota (faturamentos.nf_url, texto).
--
-- Dar mais de uma nota ao mesmo pedido ja era possivel faturando em partes --
-- 47 pedidos estao assim --, mas so quando as notas cobrem itens diferentes.
-- Fornecedor que emite duas notas para a MESMA remessa (CFOP diferente, limite
-- do emissor, nota complementar) nao tinha onde anexar a segunda: o campo era
-- um so e o segundo upload substituia o primeiro.
--
-- nf_arquivos guarda a lista: [{"url": "...", "nome": "NFe 123.xml"}].
-- nf_url CONTINUA valendo e aponta para a primeira da lista -- e o que as telas
-- do cliente e os e-mails ja leem, e nao vale quebra-las por causa disto.

alter table public.faturamentos
  add column if not exists nf_arquivos jsonb not null default '[]'::jsonb;

comment on column public.faturamentos.nf_arquivos is
  'Notas deste faturamento: [{url, nome}]. nf_url espelha a primeira.';

-- Faturamento antigo tem a nota so em nf_url; entra na lista como item unico
-- para as telas poderem ler sempre do mesmo lugar.
update public.faturamentos
   set nf_arquivos = jsonb_build_array(
         jsonb_build_object('url', nf_url, 'nome', 'Nota fiscal ' || coalesce(numero_nf, ''))
       )
 where nf_url is not null
   and nf_arquivos = '[]'::jsonb;
