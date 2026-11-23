import { toast } from 'sonner';

// Links que vêm do banco (comprovante, boleto, NF, rastreio, recurso,
// notificacao.link...) nunca podem levar a javascript:, data:, http: ou a
// outro domínio disfarçado de caminho ("//host" ou "/\host", que o navegador
// trata como outro domínio). Diagnóstico C4 e M14.

/**
 * Caminho interno do portal: começa com uma barra só ("/Pagina").
 * Use para navegar dentro do app (ex.: o sino de notificações).
 */
export const linkInternoSeguro = (link) =>
  typeof link === 'string' && /^\/(?![/\\])/.test(link);

/**
 * Valida uma URL para abrir em aba nova. Aceita só:
 *  - endereço absoluto https:
 *  - caminho interno do portal (linkInternoSeguro)
 * Devolve a URL normalizada ou null.
 */
export function urlSegura(url) {
  if (typeof url !== 'string') return null;
  const bruta = url.trim();
  if (!bruta) return null;

  if (linkInternoSeguro(bruta)) {
    try {
      const alvo = new URL(bruta, window.location.origin);
      return alvo.origin === window.location.origin ? alvo.href : null;
    } catch {
      return null;
    }
  }

  try {
    const alvo = new URL(bruta);
    return alvo.protocol === 'https:' ? alvo.href : null;
  } catch {
    return null;
  }
}

/**
 * Abre a URL numa nova aba se ela passar em urlSegura(); senão avisa e não abre.
 * Usa noopener/noreferrer para a página aberta não controlar o portal.
 */
export function abrirUrlSegura(url) {
  const segura = urlSegura(url);
  if (!segura) {
    toast.error('Link inválido ou inseguro. Ele não foi aberto.');
    return false;
  }
  window.open(segura, '_blank', 'noopener,noreferrer');
  return true;
}
