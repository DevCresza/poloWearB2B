// Miniatura de foto do Storage do Supabase, gerada no servidor.
//
// O bucket `produtos` tem fotos de ate 3 MB (media de 347 kB). Num card de 200 px
// isso e desperdicio: pela transformacao de imagem do Supabase
// (/storage/v1/render/image/...) a mesma foto sai com ~90 kB a 400 px, e em
// WebP quando o navegador aceita (o Supabase escolhe o formato pelo Accept).
//
// So reescreve URL publica do NOSSO projeto. Qualquer outra (Base44 antigo,
// blob:, data:, links externos) volta igual.
//
// Custo: o plano cobra por "imagem de origem" transformada no ciclo (100
// incluidas no Pro, depois US$ 5 por mil). Use nas listas e cards; na foto
// ampliada/zoom use a URL original.

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const PREFIXO_OBJETO = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/` : null;
const PREFIXO_RENDER = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/render/image/public/` : null;

/**
 * @param {string} url URL publica do Storage (/storage/v1/object/public/...)
 * @param {number} largura largura em px CSS; pedimos o dobro para telas retina
 * @param {object} [opcoes]
 * @param {number} [opcoes.qualidade=70] 20 a 100
 * @returns {string}
 */
export function thumb(url, largura, { qualidade = 70 } = {}) {
  if (!url || typeof url !== 'string' || !PREFIXO_OBJETO) return url;
  if (!url.startsWith(PREFIXO_OBJETO)) return url;

  const [caminho] = url.slice(PREFIXO_OBJETO.length).split('?');
  // 2x para telas de alta densidade, com teto: o Supabase aceita ate 2500.
  const w = Math.min(Math.round((Number(largura) || 400) * 2), 2500);
  return `${PREFIXO_RENDER}${caminho}?width=${w}&quality=${qualidade}&resize=contain`;
}

/**
 * onError para <img src={thumb(url)}>: se a miniatura falhar (formato que o
 * Supabase nao transforma, limite do plano, etc.), tenta a URL original uma vez.
 * Depois disso chama `seFalharDeNovo` (ex: placeholder), se houver.
 */
export function usarOriginalSeFalhar(original, seFalharDeNovo) {
  return (e) => {
    const img = e.currentTarget;
    if (original && img.dataset.original !== '1' && img.src !== original) {
      img.dataset.original = '1';
      img.src = original;
      return;
    }
    if (seFalharDeNovo) seFalharDeNovo(e);
  };
}
