// Link que veio do banco (notificacao.link etc.) so pode levar a um caminho
// interno do portal ("/Pagina"). Bloqueia javascript:, data:, http(s):// e
// "//host" ou "/\host", que o navegador trata como outro dominio.
export const linkInternoSeguro = (link) =>
  typeof link === 'string' && /^\/(?![/\\])/.test(link);
