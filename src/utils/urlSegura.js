import { toast } from 'sonner';
import { caminhoDocumento, urlAssinadaDocumento } from '@/utils/documentos';

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
 *
 * Arquivo do bucket `documentos` (NF, boleto, comprovante): o bucket é privado,
 * então troca a URL guardada por uma URL assinada de 1 hora antes de abrir
 * (diagnóstico A2 / T3). A aba abre na hora do clique, para o bloqueador de
 * pop-up não barrar, e recebe o endereço quando a assinatura volta.
 */
export function abrirUrlSegura(url) {
  if (caminhoDocumento(url)) {
    abrirDocumento(url);
    return true;
  }
  const segura = urlSegura(url);
  if (!segura) {
    toast.error('Link inválido ou inseguro. Ele não foi aberto.');
    return false;
  }
  window.open(segura, '_blank', 'noopener,noreferrer');
  return true;
}

async function abrirDocumento(ref) {
  // Sem 'noopener' aqui: com ele o window.open devolve null e não dá para
  // mandar a aba para a URL assinada. O opener é cortado logo abaixo.
  const aba = window.open('', '_blank');
  if (aba) {
    try { aba.opener = null; } catch { /* navegador não deixa: segue */ }
  }
  try {
    const assinada = urlSegura(await urlAssinadaDocumento(ref));
    if (!assinada) throw new Error('URL assinada inválida');
    if (aba && !aba.closed) {
      aba.location.replace(assinada);
    } else {
      window.open(assinada, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    if (aba && !aba.closed) aba.close();
    console.error('Erro ao abrir documento:', err);
    toast.error('Não foi possível abrir o arquivo. Ele pode ter sido removido ou você não tem acesso.');
  }
}
