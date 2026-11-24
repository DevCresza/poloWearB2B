// Criacao de pedido no servidor (T9 / diagnostico C5, M8, M9).
//
// Antes o Carrinho fazia tres escritas soltas (Pedido.create, a RPC
// aplicar_baixa_estoque e Carteira.create) com preco calculado no navegador:
// um pedido de R$ 0,01 passava, um clique duplo criava dois pedidos e uma falha
// no meio deixava pedido sem titulo ou sem baixa. Agora a RPC criar_pedido faz
// tudo numa transacao so: recalcula os precos a partir de produtos e capsulas,
// valida pedido minimo, bloqueio, forma de pagamento e estoque (com trava),
// cria o pedido e o titulo provisorio, e e idempotente pela chave.
import { supabase } from '@/lib/supabase';

/** Erro da RPC com a mensagem do banco (ja em portugues) e o code/hint. */
export class PedidoError extends Error {
  constructor(original) {
    super(original?.message || 'Erro ao criar o pedido.');
    this.name = 'PedidoError';
    this.code = original?.code;
    this.hint = original?.hint;
    this.cause = original;
  }
}

/** Chave de idempotencia nova (uma por tentativa de envio). */
export function novaChaveEnvio() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * @param {object} args
 * @param {Array} args.carrinho - linhas no formato de carrinhoParaPayload()
 * @param {string|null} args.lojaId
 * @param {string} args.metodoPagamento
 * @param {string} args.chave - idempotencia: a mesma chave devolve o mesmo pedido
 * @param {string} [args.observacoes]
 * @param {string|null} [args.compradorUserId] - so quando o vendedor compra em nome do cliente
 * @returns {Promise<{pedido_id: string, valor_total: number, repetido: boolean}>}
 */
export async function criarPedido({ carrinho, lojaId, metodoPagamento, chave, observacoes = '', compradorUserId = null }) {
  const { data, error } = await supabase.rpc('criar_pedido', {
    p_carrinho: carrinho,
    p_loja_id: lojaId || null,
    p_metodo_pagamento: metodoPagamento,
    p_idempotency_key: chave,
    p_observacoes: observacoes || null,
    p_comprador_user_id: compradorUserId || null,
  });
  if (error) throw new PedidoError(error);
  return data;
}

/**
 * Emissao em lote (admin): a mesma montagem de itens do checkout, sem baixa de
 * estoque e sem pedido minimo.
 */
export async function emitirPedidoLote({ capsulaId, quantidade, mesEntrega, lojaId, metodoPagamento, observacoes = '', chave }) {
  const { data, error } = await supabase.rpc('emitir_pedido_lote', {
    p_capsula_id: capsulaId,
    p_quantidade: quantidade,
    p_mes_entrega: mesEntrega || null,
    p_loja_id: lojaId,
    p_metodo_pagamento: metodoPagamento,
    p_observacoes: observacoes || null,
    p_idempotency_key: chave,
  });
  if (error) throw new PedidoError(error);
  return data;
}
