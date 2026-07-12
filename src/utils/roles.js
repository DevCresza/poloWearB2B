/**
 * Papeis do sistema — fonte unica de verdade.
 *
 * O schema tem DOIS campos redundantes (`role` e `tipo_negocio`) que o
 * userCreationHelper preenche com o mesmo valor. Espalhados pelo codigo havia
 * checagens divergentes (`Layout` olhava `role`, as paginas olhavam
 * `tipo_negocio`), o que ja causava bug: um usuario com `tipo_negocio='admin'`
 * e `role='user'` passava nos guards mas nao via o menu admin.
 *
 * Aqui `role` e a fonte de verdade, com `tipo_negocio` como fallback.
 */

export const PAPEIS = {
  ADMIN: 'admin',
  VENDEDOR: 'vendedor',
  CADASTRO: 'cadastro',
  FORNECEDOR: 'fornecedor',
  MULTIMARCA: 'multimarca',
  FRANQUEADO: 'franqueado',
};

/** Papel efetivo do usuario. */
export function getPapel(user) {
  if (!user) return null;
  return user.role || user.tipo_negocio || null;
}

export const isAdmin = (user) => getPapel(user) === PAPEIS.ADMIN;
export const isVendedor = (user) => getPapel(user) === PAPEIS.VENDEDOR;
export const isCadastro = (user) => getPapel(user) === PAPEIS.CADASTRO;
export const isFornecedor = (user) => getPapel(user) === PAPEIS.FORNECEDOR;

/** Cliente = quem compra (multimarca ou franqueado). */
export const isCliente = (user) => {
  const p = getPapel(user);
  return p === PAPEIS.MULTIMARCA || p === PAPEIS.FRANQUEADO;
};

/** Equipe interna Polo (nao e cliente nem fornecedor). */
export const isEquipeInterna = (user) =>
  isAdmin(user) || isVendedor(user) || isCadastro(user);

export const LABELS_PAPEL = {
  [PAPEIS.ADMIN]: 'Administrador',
  [PAPEIS.VENDEDOR]: 'Vendedor',
  [PAPEIS.CADASTRO]: 'Cadastro',
  [PAPEIS.FORNECEDOR]: 'Fornecedor',
  [PAPEIS.MULTIMARCA]: 'Multimarca',
  [PAPEIS.FRANQUEADO]: 'Franqueado',
};
