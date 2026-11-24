// Regras de um item de pedido. As mesmas da funcao _item_pedido /
// _preco_item_pedido no banco (supabase/migrations/*_t8_t9_criar_pedido_e_estoque.sql).
//
//   grade, sem tamanho -> quantidade em GRADES, preco da grade inteira
//   por tamanho        -> quantidade em PECAS; preco = grade / pecas da grade
//                         (ou o preco da peca, se o produto nao e grade)
//   avulso/unitario    -> quantidade em pecas, preco da peca
import { getPrecoGrade, getPrecoPeca } from './precoCliente';

const ehGrade = (x) => x?.tipo_venda === 'grade';

/** Preco de UMA unidade do item (grade ou peca), no perfil do comprador. */
export function precoUnitarioItem(produto, comprador, { porTamanho = false } = {}) {
  if (!produto) return 0;
  const pecasGrade = Number(produto.total_pecas_grade) || 0;
  if (porTamanho) {
    return ehGrade(produto) && pecasGrade > 0
      ? getPrecoGrade(produto, comprador) / pecasGrade
      : getPrecoPeca(produto, comprador);
  }
  return ehGrade(produto) ? getPrecoGrade(produto, comprador) : getPrecoPeca(produto, comprador);
}

/**
 * O item gravado esta em GRADES? So quando e grade, SEM tamanho escolhido e a
 * grade tem pecas. Regra unica de pecas (T15/M4), a mesma da funcao SQL
 * public.pecas_item(): grade sem tamanho -> quantidade x total_pecas_grade;
 * qualquer outro caso -> quantidade (item por tamanho ja vem em pecas).
 */
export function itemEmGrades(item) {
  return ehGrade(item) && !item?.tamanho_selecionado && (Number(item?.total_pecas_grade) || 0) > 0;
}

/** Pecas em UMA unidade do item (pecas da grade, ou 1). */
export function pecasPorUnidadeDoItem(item) {
  return itemEmGrades(item) ? Number(item.total_pecas_grade) : 1;
}

/**
 * Pecas de um item ja gravado no pedido. Item por tamanho ja vem em pecas --
 * multiplicar pela grade (como o pedidos_calc_resumo fazia ate a T15) conta a mais.
 * `quantidade` opcional: conta outra quantidade do mesmo item (ex.: pendente).
 */
export function pecasDoItem(item, quantidade = item?.quantidade) {
  return (Number(quantidade) || 0) * pecasPorUnidadeDoItem(item);
}

/** Preco por peca de um item ja gravado no pedido. */
export function precoPorPecaDoItem(item) {
  return (Number(item?.preco) || 0) / pecasPorUnidadeDoItem(item);
}
