/**
 * Helpers de preço por perfil de cliente (Franqueado vs Multimarca).
 *
 * Regras:
 * - Franqueado usa os campos legados: preco_por_peca / preco_grade_completa.
 * - Multimarca usa: preco_peca_multimarca / preco_grade_multimarca.
 * - Admin e Fornecedor seguem default (franqueado) para cálculos de referência.
 * - Variantes de cor podem sobrescrever preços por perfil.
 */

export function getTipoCliente(user) {
  if (!user) return 'franqueado';
  if (user.tipo_negocio === 'multimarca') return 'multimarca';
  return 'franqueado';
}

export function isMultimarca(user) {
  return getTipoCliente(user) === 'multimarca';
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/**
 * Preço da PEÇA conforme o perfil.
 * variante (opcional) sobrescreve se tiver preço próprio do perfil.
 */
export function getPrecoPeca(produto, user, variante = null) {
  if (!produto) return 0;
  const tipo = getTipoCliente(user);

  if (tipo === 'multimarca') {
    const vMulti = num(variante?.preco_peca_multimarca);
    if (vMulti !== null) return vMulti;
    const pMulti = num(produto.preco_peca_multimarca);
    if (pMulti !== null) return pMulti;
    return 0;
  }

  const vFran = num(variante?.preco_por_peca);
  if (vFran !== null) return vFran;
  return num(produto.preco_por_peca) || 0;
}

/**
 * Preço da GRADE completa conforme o perfil.
 */
export function getPrecoGrade(produto, user, variante = null) {
  if (!produto) return 0;
  const tipo = getTipoCliente(user);

  if (tipo === 'multimarca') {
    const vMulti = num(variante?.preco_grade_multimarca);
    if (vMulti !== null) return vMulti;
    const pMulti = num(produto.preco_grade_multimarca);
    if (pMulti !== null) return pMulti;
    return 0;
  }

  const vFran = num(variante?.preco_grade_completa);
  if (vFran !== null) return vFran;
  return num(produto.preco_grade_completa) || 0;
}

/**
 * Produto visível para o perfil do usuário?
 * Admin/Fornecedor sempre veem tudo.
 */
export function isProdutoVisivelParaCliente(produto, user) {
  if (!produto) return false;
  if (!user) return false;
  if (user.role === 'admin' || user.tipo_negocio === 'admin') return true;
  if (user.tipo_negocio === 'fornecedor') return true;

  const tipo = getTipoCliente(user);
  if (tipo === 'multimarca') return produto.disponivel_multimarca === true;
  return produto.disponivel_franqueado !== false; // default true
}

/**
 * Cápsula visível para o perfil (flag própria + todos produtos internos disponíveis).
 */
export function isCapsulaVisivelParaCliente(capsula, produtosInternos, user) {
  if (!capsula) return false;
  if (!user) return false;
  if (user.role === 'admin' || user.tipo_negocio === 'admin') return true;
  if (user.tipo_negocio === 'fornecedor') return true;

  const tipo = getTipoCliente(user);
  const flagOk = tipo === 'multimarca'
    ? capsula.disponivel_multimarca === true
    : capsula.disponivel_franqueado !== false;
  if (!flagOk) return false;

  if (!Array.isArray(produtosInternos) || produtosInternos.length === 0) return true;
  return produtosInternos.every(p => isProdutoVisivelParaCliente(p, user));
}

/**
 * Total da cápsula para o perfil do user.
 * produtosInternos precisa trazer os produtos já resolvidos.
 * produtos_quantidades: { [produto_id]: qtd } - se ausente, assume 1.
 */
export function getPrecoCapsula(capsula, produtosInternos, user) {
  if (!capsula || !Array.isArray(produtosInternos)) return 0;
  const qtds = capsula.produtos_quantidades || {};
  return produtosInternos.reduce((total, p) => {
    const qtd = num(qtds[p.id]) || 1;
    const preco = getPrecoGrade(p, user) || getPrecoPeca(p, user);
    return total + preco * qtd;
  }, 0);
}

/**
 * Métodos de pagamento permitidos para o perfil.
 * Multimarca: apenas à vista (sem boleto/parcelado).
 */
export function getMetodosPagamentoPermitidos(user) {
  if (isMultimarca(user)) {
    return ['pix', 'a_vista', 'transferencia', 'dinheiro'];
  }
  return ['boleto', 'pix', 'a_vista', 'transferencia', 'dinheiro', 'cartao'];
}

export function podeUsarBoleto(user) {
  return !isMultimarca(user);
}
