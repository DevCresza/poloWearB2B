// Baixa e devolução automática de estoque a partir dos itens de um pedido.
// A baixa é aplicada no checkout; a devolução, quando o pedido é cancelado/recusado.
import { Produto } from '@/api/entities';

// variantes_cor pode vir como array (jsonb) ou string — normaliza para array.
const parseVariantes = (valor) => {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

// Agrupa os itens do pedido por produto_id. Ignora cápsulas (a baixa de
// estoque de itens vindos de cápsula não é suportada por enquanto).
const agruparItensPorProduto = (itens) => {
  const grupos = {};
  (itens || []).forEach((item) => {
    const pid = item?.produto_id;
    if (!pid) return;
    if (item.tipo === 'capsula') return;
    if (item.origem_capsula) return;
    if (String(pid).startsWith('capsula-')) return;
    if ((Number(item.quantidade) || 0) <= 0) return;
    if (!grupos[pid]) grupos[pid] = [];
    grupos[pid].push(item);
  });
  return grupos;
};

/**
 * Ajusta o estoque dos produtos de um pedido.
 * @param {Array} itens - itens do pedido (campo `itens` do pedido)
 * @param {number} sinal - -1 para dar baixa, +1 para devolver
 */
async function ajustarEstoque(itens, sinal) {
  const grupos = agruparItensPorProduto(itens);

  for (const [produtoId, itensDoProduto] of Object.entries(grupos)) {
    try {
      const produto = await Produto.get(produtoId);

      // Estoque só é controlado em produtos de pronta entrega
      if (!produto || !produto.controla_estoque || produto.disponibilidade !== 'pronta_entrega') {
        continue;
      }

      // Produto vendido POR TAMANHO: cada item tem tamanho_selecionado e
      // a quantidade eh em pecas. Baixa em estoque_por_tamanho[tam].
      if (produto.venda_por_tamanho) {
        let mapa = produto.estoque_por_tamanho;
        if (typeof mapa === 'string') {
          try { mapa = JSON.parse(mapa); } catch { mapa = {}; }
        }
        mapa = { ...(mapa || {}) };
        itensDoProduto.forEach((item) => {
          const tam = item.tamanho_selecionado;
          if (!tam) return;
          const qtd = Number(item.quantidade) || 0;
          const atual = Number(mapa[tam]) || 0;
          mapa[tam] = Math.max(0, atual + sinal * qtd);
        });
        const totalGeral = Object.values(mapa).reduce((s, v) => s + (Number(v) || 0), 0);
        await Produto.update(produtoId, {
          estoque_por_tamanho: mapa,
          estoque_atual_grades: totalGeral,
        });
        continue;
      }

      if (produto.tem_variantes_cor) {
        const variantes = parseVariantes(produto.variantes_cor);
        if (variantes.length === 0) continue;

        itensDoProduto.forEach((item) => {
          const qtd = Number(item.quantidade) || 0;
          const cor = item.cor_selecionada || {};
          // Identifica a variante pelo id; se não houver, pelo nome da cor
          const variante = (cor.id && variantes.find((v) => v.id === cor.id))
            || (cor.cor_nome && variantes.find((v) => v.cor_nome === cor.cor_nome));
          if (!variante) return;
          const atual = Number(variante.estoque_grades) || 0;
          variante.estoque_grades = Math.max(0, atual + sinal * qtd);
        });

        const estoqueTotal = variantes.reduce((s, v) => s + (Number(v.estoque_grades) || 0), 0);
        await Produto.update(produtoId, {
          variantes_cor: variantes,
          estoque_atual_grades: estoqueTotal,
        });
      } else {
        const qtdTotal = itensDoProduto.reduce((s, it) => s + (Number(it.quantidade) || 0), 0);
        const atual = Number(produto.estoque_atual_grades) || 0;
        await Produto.update(produtoId, {
          estoque_atual_grades: Math.max(0, atual + sinal * qtdTotal),
        });
      }
    } catch (err) {
      // Falha em um produto não interrompe os demais
      console.error(`[estoque] Falha ao ajustar estoque do produto ${produtoId}:`, err);
    }
  }
}

// Dá baixa no estoque (chamado ao finalizar o pedido no checkout).
export async function darBaixaEstoque(itens) {
  return ajustarEstoque(itens, -1);
}

// Devolve o estoque (chamado ao cancelar/recusar um pedido).
export async function devolverEstoque(itens) {
  return ajustarEstoque(itens, 1);
}
