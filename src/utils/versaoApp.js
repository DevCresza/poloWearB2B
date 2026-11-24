// Detecta que o portal ganhou um deploy novo enquanto a aba estava aberta.
//
// Por quê: uma aba aberta antes de um deploy continua rodando o JavaScript
// antigo até ser recarregada. Em 24/11 isso derrubou o envio de NF: o código
// antigo subia em `documentos/uploads/`, que as regras novas de arquivos (T3)
// recusam. Regra de banco nova + JS velho = erro para o usuário.
//
// Como: o build grava /version.json com a versão dele (vite.config.js) e a
// mesma versão vai embutida no JS (VITE_VERSAO_BUILD). A aba confere o arquivo
// de tempos em tempos; se a versão do servidor for outra, a aba está velha.

export const VERSAO_ATUAL = import.meta.env.VITE_VERSAO_BUILD || '';

const INTERVALO_MINIMO_MS = 60 * 1000; // não consulta mais de 1x por minuto

let desatualizada = false;
let ultimaConsulta = 0;
let consultando = null;

export const versaoDesatualizada = () => desatualizada;

/**
 * Consulta /version.json e devolve true se o servidor já tem outra versão.
 * Falha de rede ou arquivo ausente (ambiente de dev) contam como "em dia".
 */
export async function conferirVersao({ forcar = false } = {}) {
  if (!VERSAO_ATUAL || import.meta.env.DEV) return false;
  if (desatualizada) return true;
  const agora = Date.now();
  if (!forcar && agora - ultimaConsulta < INTERVALO_MINIMO_MS) return desatualizada;
  if (consultando) return consultando;

  ultimaConsulta = agora;
  consultando = (async () => {
    try {
      const resp = await fetch(`/version.json?t=${agora}`, { cache: 'no-store' });
      if (!resp.ok) return false;
      const dados = await resp.json();
      const versaoServidor = typeof dados?.versao === 'string' ? dados.versao : '';
      if (versaoServidor && versaoServidor !== VERSAO_ATUAL) desatualizada = true;
    } catch {
      /* rede caída, JSON inválido: tenta de novo na próxima */
    }
    return desatualizada;
  })();

  try {
    return await consultando;
  } finally {
    consultando = null;
  }
}
