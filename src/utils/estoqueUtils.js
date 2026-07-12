// Baixa e devolução automática de estoque a partir dos itens de um pedido.
// A baixa é aplicada no checkout; a devolução, quando o pedido é cancelado/recusado.
import { Produto } from '@/api/entities';
import { supabase } from '@/lib/supabase';

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

// Agrupa os itens do pedido por produto_id.
// Itens vindos de capsula (com origem_capsula preenchida) ja foram expandidos
// em produtos individuais no criarPedidoParaLoja e possuem produto_id real,
// cor_selecionada ou tamanho_selecionado, e quantidade em pecas — devem
// abater estoque normalmente, igual pedido direto do catalogo.
// So descartamos:
//  - item sem produto_id
//  - item marcador do proprio agrupador de capsula (produto_id "capsula-...")
//  - item que ainda esteja marcado tipo: "capsula" (nao deveria ocorrer apos
//    expansao, mas guardamos por seguranca)
//  - quantidade zero
const agruparItensPorProduto = (itens) => {
  const grupos = {};
  (itens || []).forEach((item) => {
    const pid = item?.produto_id;
    if (!pid) return;
    if (item.tipo === 'capsula') return;
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

/**
 * Dá baixa no estoque (checkout).
 *
 * Vai por RPC, não por Produto.update: quem finaliza a compra é o CLIENTE, e
 * com RLS ele não pode (nem deve) escrever em `produtos` — `variantes_cor`
 * carrega os preços de cada variante, então permitir essa escrita seria
 * permitir que o cliente reescrevesse a própria tabela de preços.
 *
 * A função no servidor mexe só no estoque e ignora o que não for pronta entrega.
 */
export async function darBaixaEstoque(itens) {
  const grupos = agruparItensPorProduto(itens);
  const payload = Object.entries(grupos).flatMap(([produtoId, itensDoProduto]) =>
    itensDoProduto.map((item) => ({
      produto_id: produtoId,
      quantidade: Number(item.quantidade) || 0,
      tamanho_selecionado: item.tamanho_selecionado || null,
      cor_selecionada: item.cor_selecionada || null,
    }))
  );

  if (payload.length === 0) return;

  const { error } = await supabase.rpc('aplicar_baixa_estoque', { itens: payload });
  if (error) throw error;
}

// Devolve o estoque (cancelamento/recusa). Só quem tem acesso de staff faz isso,
// e o staff pode escrever em `produtos` — segue pelo caminho normal.
export async function devolverEstoque(itens) {
  return ajustarEstoque(itens, 1);
}
