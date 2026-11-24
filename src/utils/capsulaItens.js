// Expansao de capsula em itens de pedido -- uma regra so para o Carrinho e a
// EmissaoLote (antes cada tela tinha a sua copia, e a da EmissaoLote ignorava
// os produtos por tamanho). A mesma regra roda no banco (_montar_itens_pedido),
// que e quem grava o pedido; aqui serve para mostrar valores antes de enviar.
//
// produtos_quantidades de uma capsula, por produto:
//   numero                         -> quantidade (grades ou pecas, conforme o produto)
//   { variantes: [{cor_id, cor_nome, quantidade}] } -> uma linha por cor (> 0)
//   { tamanhos:  [{tamanho, quantidade}] }          -> uma linha por tamanho, em pecas
import { precoUnitarioItem } from './itemPedido';

const lerJson = (v, padrao) => {
  if (v === null || v === undefined || v === '') return padrao;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return padrao; }
};

/**
 * Linhas (produto, cor/tamanho, quantidade, preco) de UMA configuracao de capsula.
 * @param {object} args
 * @param {string[]} args.produtoIds
 * @param {object} args.produtosQuantidades
 * @param {number} [args.quantidade=1] - quantas vezes a capsula
 * @param {Array} args.produtos - produtos ja carregados
 * @param {object} args.comprador - define o preco (multimarca/franqueado)
 */
export function expandirCapsula({ produtoIds, produtosQuantidades, quantidade = 1, produtos, comprador }) {
  const pq = lerJson(produtosQuantidades, {}) || {};
  const vezes = Number(quantidade) || 1;
  return (lerJson(produtoIds, []) || []).flatMap((pid) => {
    const produto = (produtos || []).find(p => p.id === pid);
    if (!produto || produto.arquivado) return [];
    const config = pq[pid];
    if (config === undefined || config === null) return [];

    if (typeof config === 'object' && Array.isArray(config.variantes)) {
      const preco = precoUnitarioItem(produto, comprador);
      return config.variantes
        .map(v => ({ produto, cor_id: v.cor_id, cor_nome: v.cor_nome, quantidade: (Number(v.quantidade) || 0) * vezes, preco }))
        .filter(l => l.quantidade > 0);
    }
    if (typeof config === 'object' && Array.isArray(config.tamanhos)) {
      const preco = precoUnitarioItem(produto, comprador, { porTamanho: true });
      return config.tamanhos
        .map(t => ({ produto, tamanho: t.tamanho, quantidade: (Number(t.quantidade) || 0) * vezes, preco }))
        .filter(l => l.quantidade > 0);
    }
    if (typeof config === 'number') {
      const qtd = config * vezes;
      return qtd > 0 ? [{ produto, quantidade: qtd, preco: precoUnitarioItem(produto, comprador) }] : [];
    }
    return [];
  });
}

/** Valor de UMA capsula (quantidade 1) com a configuracao dada. */
export function precoCapsula({ produtoIds, produtosQuantidades, produtos, comprador }) {
  return expandirCapsula({ produtoIds, produtosQuantidades, quantidade: 1, produtos, comprador })
    .reduce((s, l) => s + l.preco * l.quantidade, 0);
}

/**
 * Carrinho (localStorage) -> linhas que a RPC criar_pedido aceita. So vai
 * identificador e quantidade: preco, nome e foto saem do banco.
 */
export function carrinhoParaPayload(itens) {
  return (itens || []).map((item) => {
    if (item.tipo === 'capsula') {
      return {
        tipo: 'capsula',
        capsula_id: item.capsula_id,
        quantidade: Number(item.quantidade) || 1,
        mes_entrega: item.mes_selecionado || null,
        produtos_quantidades: item.produtos_quantidades || {},
      };
    }
    return {
      tipo: 'produto',
      produto_id: item.id,
      quantidade: Number(item.quantidade) || 0,
      tamanho: item.tamanho_selecionado || null,
      cor_id: item.cor_selecionada?.id || null,
      cor_nome: item.cor_selecionada?.cor_nome || null,
    };
  });
}
