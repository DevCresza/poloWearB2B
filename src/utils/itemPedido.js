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
 * Pecas de um item ja gravado no pedido. Item por tamanho ja vem em pecas --
 * multiplicar pela grade (como o pedidos_calc_resumo faz hoje) conta a mais.
 */
export function pecasDoItem(item) {
  const qtd = Number(item?.quantidade) || 0;
  if (item?.tamanho_selecionado) return qtd;
  const pecasGrade = Number(item?.total_pecas_grade) || 0;
  return ehGrade(item) && pecasGrade > 0 ? qtd * pecasGrade : qtd;
}

/** Preco por peca de um item ja gravado no pedido. */
export function precoPorPecaDoItem(item) {
  const preco = Number(item?.preco) || 0;
  if (item?.tamanho_selecionado) return preco;
  const pecasGrade = Number(item?.total_pecas_grade) || 0;
  return ehGrade(item) && pecasGrade > 0 ? preco / pecasGrade : preco;
}
