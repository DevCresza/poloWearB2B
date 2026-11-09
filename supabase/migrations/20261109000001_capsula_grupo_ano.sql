-- Catalogo: capsulas em linhas com titulo, e separadas por ano.
--
-- Hoje as 30 capsulas ativas vivem numa unica faixa de rolagem horizontal.
-- Quem compra 99% por capsula (que e o caso) precisa rolar a faixa inteira
-- para achar a linha certa, e nao ha nada na tela dizendo o que e colecao
-- nova e o que e basico continuo.
--
-- Duas colunas, nao uma:
--
--   grupo  titulo da LINHA no catalogo ("Inverno", "Basicos", "Pronta
--          entrega"). Texto livre de proposito -- a Polo muda o recorte por
--          estacao, e uma tabela de grupos so adicionaria um cadastro a
--          manter. Capsula sem grupo cai numa linha final generica, entao
--          nada some por falta de preenchimento.
--
--   ano    o ano da colecao, que vira os botoes 2026 / 2027 no topo. Separado
--          de `grupo` porque o filtro de ano precisa cruzar os grupos: o
--          cliente quer ver "Inverno" de 2027, nao "Inverno 2027" como um
--          rotulo opaco. Capsula sem ano aparece em qualquer ano selecionado
--          -- basico continuo nao pertence a uma colecao.
--
-- O nome ja carrega parte disso hoje ("JEANS COLECAO INVERNO 27 - ZUNE"), mas
-- como texto dentro do nome ele nao agrupa nem filtra, e obriga a renomear a
-- capsula para reorganizar a vitrine.

alter table public.capsulas
  add column if not exists grupo text,
  add column if not exists ano   smallint;

comment on column public.capsulas.grupo is
  'Titulo da linha no catalogo (ex.: Inverno, Basicos). Vazio cai na linha generica.';
comment on column public.capsulas.ano is
  'Ano da colecao, usado nos botoes de ano do catalogo. Vazio aparece em todos os anos.';

-- O catalogo monta as linhas lendo so as capsulas em circulacao.
create index if not exists idx_capsulas_vitrine
  on public.capsulas (grupo, ano, ordem_exibicao)
  where ativa = true and coalesce(arquivada, false) = false;
