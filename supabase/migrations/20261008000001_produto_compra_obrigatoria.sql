-- Produtos de compra obrigatoria: os que precisam estar em TODA loja.
--
-- A franquia precisa enxergar isso na hora de montar o pedido. Hoje nao ha
-- como marcar: is_destaque e vitrine (ordena e promove), nao obrigacao.
--
-- Fica no PRODUTO, nao na capsula: o mesmo produto obrigatorio pode aparecer
-- em mais de uma capsula, e a obrigacao e dele. A capa da capsula mostra o
-- selo quando QUALQUER produto dela for obrigatorio.
--
-- Por ora e sinalizacao visual: nao bloqueia tirar o item do carrinho nem
-- mexe no minimo por produto da capsula (produtos_quantidades). Virar regra
-- de verdade e outra decisao, e precisa vir do negocio.

alter table public.produtos
  add column if not exists compra_obrigatoria boolean not null default false;

comment on column public.produtos.compra_obrigatoria is
  'Produto que toda loja precisa ter. Mostra selo no catalogo e na capa da capsula. Nao bloqueia o carrinho.';
