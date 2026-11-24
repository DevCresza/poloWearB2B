// Faturamento numa transacao so (T7 / diagnostico A7, M6, M7).
//
// Antes o FaturarPedidoModal gravava em quatro passos soltos (nota, titulos,
// valores do pedido e itens do pedido), somava valor_faturado a partir do pedido
// em memoria e sobrescrevia a NF do pedido a cada faturamento parcial. Agora a
// RPC registrar_faturamento faz tudo de uma vez, com o pedido travado:
//   - confere o saldo de cada item no banco e usa o preco gravado no pedido;
//   - cria a nota, os titulos 900+ (a vista/cartao/pix) e, se vierem, as
//     parcelas do boleto;
//   - soma valor_faturado/valor_quebra no banco e atualiza o status;
//   - recusa a mesma NF com o mesmo valor no mesmo pedido (codigo 23505);
//   - so aceita admin ou o fornecedor dono do pedido.
import { supabase } from '@/lib/supabase';

/**
 * @param {object} args
 * @param {string} args.pedidoId
 * @param {Array<{indice:number, qtd_faturar?:number, qtd_quebra?:number}>} args.itens
 *   indice = posicao do item em pedido.itens
 * @param {{numero:string, data_emissao:string, nf_url:string,
 *   nf_arquivos?:Array, transportadora?:string}|null} [args.nf] - nulo na quebra pura
 * @param {Array<{metodo:string, valor:number}>} [args.pagamentos]
 * @param {Array|null} [args.parcelasBoleto] - mesmo formato de substituir_parcelas
 * @returns {Promise<{faturamento_id:string|null, status:string, todos_resolvidos:boolean,
 *   valor_faturamento:number, valor_quebra:number, valor_faturado:number,
 *   valor_quebra_total:number, saldo_pendente:number, titulos_criados:number}>}
 */
export async function registrarFaturamento({ pedidoId, itens, nf = null, pagamentos = [], parcelasBoleto = null }) {
  const { data, error } = await supabase.rpc('registrar_faturamento', {
    p_pedido_id: pedidoId,
    p_itens: itens,
    p_nf: nf,
    p_pagamentos: pagamentos,
    p_parcelas_boleto: parcelasBoleto,
  });
  if (error) {
    // A mensagem do banco ja vem em portugues e diz o que corrigir (saldo,
    // divisao, NF repetida); o code segue junto para a tela tratar o 23505.
    const erro = new Error(error.message || 'Erro ao registrar o faturamento');
    erro.code = error.code;
    erro.details = error.details;
    erro.hint = error.hint;
    erro.cause = error;
    throw erro;
  }
  return data;
}
