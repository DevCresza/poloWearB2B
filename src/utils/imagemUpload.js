// Regras de gravacao das fotos novas (produto, variante, banner, capa).
//
// O acervo tem fotos de ate 3 MB porque o editor gravava JPEG 0,92 no tamanho
// original. A partir daqui toda foto nova sai com no maximo 1600 px no lado
// maior, em WebP 0,82 (ou JPEG 0,82 no navegador que nao gera WebP).
// O acervo antigo NAO e reprocessado aqui.

export const LADO_MAXIMO = 1600;
export const QUALIDADE = 0.82;

const gerarBlob = (canvas, tipo, qualidade) =>
  new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade));

/**
 * Reduz o canvas (se passar de LADO_MAXIMO) e codifica em WebP, ou JPEG se o
 * navegador nao souber gerar WebP (o toBlob devolve PNG nesse caso).
 * @param {HTMLCanvasElement} origem
 * @returns {Promise<Blob>}
 */
export async function canvasParaUpload(origem) {
  let canvas = origem;
  const maior = Math.max(origem.width, origem.height);

  if (maior > LADO_MAXIMO) {
    const escala = LADO_MAXIMO / maior;
    canvas = document.createElement('canvas');
    canvas.width = Math.round(origem.width * escala);
    canvas.height = Math.round(origem.height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível criar contexto do canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(origem, 0, 0, canvas.width, canvas.height);
  }

  const webp = await gerarBlob(canvas, 'image/webp', QUALIDADE);
  if (webp && webp.type === 'image/webp') return webp;

  const jpeg = await gerarBlob(canvas, 'image/jpeg', QUALIDADE);
  if (jpeg) return jpeg;
  throw new Error('Falha ao gerar imagem recortada. Tente novamente.');
}

/**
 * Embrulha o Blob do editor num File com nome e tipo coerentes com o conteudo.
 * @param {Blob} blob
 * @param {string} prefixo ex: 'produto', 'banner'
 */
export function arquivoDoBlob(blob, prefixo) {
  const tipo = blob.type || 'image/jpeg';
  const ext = tipo === 'image/webp' ? 'webp' : tipo === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `${prefixo}-${Date.now()}.${ext}`, { type: tipo });
}
