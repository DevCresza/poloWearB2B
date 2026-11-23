import { toast } from 'sonner';

/**
 * Valida uma URL vinda de dado (comprovante, boleto, NF, rastreio, recurso...).
 *
 * Aceita só:
 *  - endereço absoluto https:
 *  - caminho interno do próprio portal ("/Pagina"), nunca "//host" nem "/\host"
 *
 * Qualquer outra coisa (javascript:, data:, http:, vbscript:, file:...) é recusada.
 * Devolve a URL normalizada ou null.
 */
export function urlSegura(url) {
  if (typeof url !== 'string') return null;
  const bruta = url.trim();
  if (!bruta) return null;

  // Caminho interno: começa com uma barra só.
  if (bruta.startsWith('/') && !bruta.startsWith('//') && !bruta.startsWith('/\\')) {
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
