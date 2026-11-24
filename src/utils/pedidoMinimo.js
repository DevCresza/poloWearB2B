// Pedido minimo do fornecedor conforme o tipo do COMPRADOR.
// Mesma regra da funcao criar_pedido no banco -- quem decide de verdade e o
// servidor; aqui e so para avisar antes de enviar.
//   multimarca -> pedido_minimo_multimarca
//   franqueado -> pedido_minimo_franqueado
//   sem valor especifico (> 0) -> pedido_minimo_valor (legado)
export function getPedidoMinimo(fornecedor, comprador) {
  if (!fornecedor) return 0;
  const especifico = Number(comprador?.tipo_negocio === 'multimarca'
    ? fornecedor.pedido_minimo_multimarca
    : fornecedor.pedido_minimo_franqueado);
  if (Number.isFinite(especifico) && especifico > 0) return especifico;
  return Number(fornecedor.pedido_minimo_valor) || 0;
}
