import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Documentos de pedido (NF, XML, boleto, comprovante) no bucket `documentos`.
// Diagnóstico A2 / tarefa T3.
//
// O bucket vai ficar PRIVADO: a URL pública guardada no banco (nf_url,
// boleto_url, comprovante_url, nf_arquivos[].url...) deixa de abrir. A tela
// passa a gerar, na hora de abrir, uma URL assinada de validade curta.
//
// O banco continua guardando a URL no formato público
// (…/storage/v1/object/public/documentos/<caminho>): ela é só a REFERÊNCIA do
// arquivo. As colunas têm CHECK de https e o e-mail e o histórico já leem esse
// formato. Quem precisa abrir passa por urlAssinadaDocumento()/abrirUrlSegura().
//
// Pastas por dono (as policies de storage.objects conferem):
//   fornecedor/<fornecedor_id>/…  NF, XML e boleto, enviados pelo fornecedor
//   cliente/<user_id>/…           comprovante, enviado pelo cliente
//   uploads/…                     arquivos antigos: só staff altera; quem tinha
//                                 acesso pelo pedido continua lendo

export const BUCKET_DOCUMENTOS = 'documentos';
export const VALIDADE_URL_ASSINADA = 60 * 60; // 1 hora
export const TAMANHO_MAXIMO_DOCUMENTO = 20 * 1024 * 1024; // igual ao bucket

// Extensão → content-type aceito pelo bucket. O tipo vem da extensão, não do
// navegador: XML costuma chegar sem tipo ou como application/octet-stream,
// que o bucket recusa.
const TIPOS_POR_EXTENSAO = {
  pdf: 'application/pdf',
  xml: 'application/xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const EXTENSOES_DOCUMENTO = Object.keys(TIPOS_POR_EXTENSAO);

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const ORIGEM_SUPABASE = (() => {
  try { return SUPABASE_URL ? new URL(SUPABASE_URL).origin : null; } catch { return null; }
})();

// …/storage/v1/object/{public|sign|authenticated}/documentos/<caminho>
const RE_OBJETO = /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/documentos\/(.+)$/;
const RE_CAMINHO = /^(?:uploads|fornecedor|cliente)\/[^?#]+$/;

const caminhoValido = (c) => !!c && RE_CAMINHO.test(c) && !c.split('/').some(p => p === '..' || p === '.' || p === '');

/**
 * Caminho do arquivo dentro do bucket `documentos`, a partir da URL guardada
 * no banco (pública ou assinada, do NOSSO projeto) ou de um caminho puro.
 * Devolve null para qualquer outra coisa (link externo, outro bucket...).
 */
export function caminhoDocumento(ref) {
  if (typeof ref !== 'string') return null;
  const bruto = ref.trim();
  if (!bruto) return null;

  if (/^https?:\/\//i.test(bruto)) {
    let url;
    try { url = new URL(bruto); } catch { return null; }
    if (!ORIGEM_SUPABASE || url.origin !== ORIGEM_SUPABASE) return null;
    const m = url.pathname.match(RE_OBJETO);
    if (!m) return null;
    let caminho;
    try { caminho = decodeURIComponent(m[1]); } catch { return null; }
    return caminhoValido(caminho) ? caminho : null;
  }

  return caminhoValido(bruto) ? bruto : null;
}

/** true se a referência aponta para um arquivo do bucket `documentos`. */
export const ehDocumento = (ref) => caminhoDocumento(ref) !== null;

/**
 * URL assinada (validade curta) para abrir ou baixar o documento.
 * Referência que não é do bucket `documentos` volta igual.
 * Lança erro se o usuário não tiver acesso ao arquivo.
 */
export async function urlAssinadaDocumento(ref, validade = VALIDADE_URL_ASSINADA) {
  const caminho = caminhoDocumento(ref);
  if (!caminho) return ref;
  if (!isSupabaseConfigured() || !supabase) return ref;

  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(caminho, validade);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Sem acesso ao arquivo');
  }
  return data.signedUrl;
}

/**
 * Pasta do dono do documento. O DONO é quem responde pelo arquivo, não quem
 * está logado: boleto que o admin sobe por um fornecedor vai para a pasta
 * desse fornecedor, senão o cliente do pedido não consegue ler.
 *   { fornecedorId } → fornecedor/<id>
 *   { clienteId }    → cliente/<id>
 */
export function pastaDocumento({ fornecedorId, clienteId } = {}) {
  const limpo = (v) => String(v ?? '').trim();
  const idValido = (v) => /^[0-9a-zA-Z-]+$/.test(v);
  if (fornecedorId && idValido(limpo(fornecedorId))) return `fornecedor/${limpo(fornecedorId)}`;
  if (clienteId && idValido(limpo(clienteId))) return `cliente/${limpo(clienteId)}`;
  throw new Error('Documento sem dono: informe o fornecedor ou o cliente.');
}

/** Content-type aceito pelo bucket para o arquivo, ou null se o tipo não é permitido. */
export function tipoDocumento(file) {
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (ext && TIPOS_POR_EXTENSAO[ext]) return TIPOS_POR_EXTENSAO[ext];
  // Blob sem nome (ex.: imagem recortada): aceita se o tipo já é um dos permitidos.
  const tipo = String(file?.type || '').toLowerCase();
  if (tipo === 'text/xml') return 'application/xml';
  return Object.values(TIPOS_POR_EXTENSAO).includes(tipo) ? tipo : null;
}
