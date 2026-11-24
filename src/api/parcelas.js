// Troca das parcelas de boleto (T6 / diagnostico C6).
//
// Antes, cada tela apagava e recriava os titulos um a um. O fornecedor nao tem
// DELETE em carteira, entao o "apagar" voltava 0 linhas sem erro e o jogo novo
// nascia por cima do antigo (cliente devendo em dobro); com admin, a rotina
// apagava ate titulo pago ou com comprovante em analise. Agora tudo passa pela
// RPC substituir_parcelas, numa transacao so, que:
//   - preserva os titulos 'pago' e 'em_analise' (parcela com o mesmo numero de
//     um preservado e ignorada, nao volta a ser cobrada);
//   - tira pedido, cliente, loja e fornecedor do PEDIDO, e grava o
//     faturamento_id da nota nos titulos novos;
//   - recusa soma acima do valor da nota (ou do pedido);
//   - so aceita admin ou o fornecedor dono do pedido.
import { supabase } from '@/lib/supabase';
import { EntidadeError } from './supabaseEntities';

/**
 * @param {object} args
 * @param {string} [args.faturamentoId] - nota fiscal (escopo por nota)
 * @param {string} [args.pedidoId] - pedido sem nota (escopo por pedido)
 * @param {Array<{parcela_numero:number, valor:number, data_vencimento:string,
 *   boleto_url?:string, metodo_pagamento?:string, descricao?:string}>} args.parcelas
 * @returns {Promise<{removidas:number, criadas:number, preservadas:number[], ignoradas:number[]}>}
 */
export async function substituirParcelas({ faturamentoId = null, pedidoId = null, parcelas }) {
  const { data, error } = await supabase.rpc('substituir_parcelas', {
    p_faturamento_id: faturamentoId,
    p_parcelas: parcelas,
    p_pedido_id: pedidoId,
  });
  if (error) throw new EntidadeError('substituir', 'parcelas', error);
  return data;
}

/** Frase curta para o toast quando parcelas pagas/em analise foram mantidas. */
export function avisoPreservadas(resultado) {
  const mantidas = resultado?.preservadas || [];
  if (mantidas.length === 0) return '';
  return ` Mantida(s) a(s) parcela(s) ${mantidas.join(', ')}, já paga(s) ou com comprovante em análise.`;
}

/**
 * Pedido com mais de uma nota: o boleto antecipado do pedido (titulos sem nota)
 * nao e substituido, porque nao da para saber a qual nota ele pertence.
 */
export function avisoAntecipadas(resultado) {
  const n = resultado?.antecipadas_mantidas || 0;
  if (n === 0) return '';
  return `Atenção: este pedido ainda tem ${n} parcela(s) do boleto antecipado, sem nota fiscal. `
    + 'Como o pedido tem mais de uma nota, elas não foram substituídas. Peça ao admin para conciliar, '
    + 'ou o cliente pode aparecer devendo em dobro.';
}
