import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recebe os relatorios de violacao da CSP (Report-Only) do portal.
//
// Roda SEM login (verify_jwt = false): quem chama e o navegador, sozinho, sem
// apikey nem Authorization. Por isso a funcao se protege:
//   - so POST com content-type application/csp-report (report-uri) ou
//     application/reports+json (report-to / Reporting API);
//   - corpo de no maximo 16 kB e no maximo 20 relatorios por envio;
//   - limite de 60 envios por minuto por IP (em memoria, por instancia) e
//     teto global de 300 relatorios gravados por minuto (no banco);
//   - grava so directive, blocked-uri e document-uri sem query/fragmento,
//     user agent resumido (navegador + versao maior + sistema) e a data.
// Tabela public.csp_reports: RLS ligado, sem acesso para anon/authenticated.

const ALLOWED_ORIGINS = [
  'https://www.portalpolowear.com.br',
  'https://portalpolowear.com.br',
  'https://polo-wear-b2-b.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
];

const TAMANHO_MAXIMO = 16 * 1024;
const MAX_RELATORIOS_POR_ENVIO = 20;
const LIMITE_POR_IP = 60;
const JANELA_MS = 60 * 1000;
const LIMITE_GLOBAL_POR_MINUTO = 300;
const TIPOS_ACEITOS = ['application/csp-report', 'application/reports+json'];

const enviosPorIp = new Map<string, number[]>();

function dentroDoLimite(ip: string): boolean {
  const agora = Date.now();
  const recentes = (enviosPorIp.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  if (recentes.length >= LIMITE_POR_IP) {
    enviosPorIp.set(ip, recentes);
    return false;
  }
  recentes.push(agora);
  enviosPorIp.set(ip, recentes);
  if (enviosPorIp.size > 5000) enviosPorIp.clear();
  return true;
}

function ipDe(req: Request): string {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? ((req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido');
}

// A Reporting API (report-to) manda com mode "cors": precisa responder o preflight.
function cors(req: Request, headers: Record<string, string> = {}): Headers {
  const h = new Headers(headers);
  const origin = req.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'content-type');
    h.set('Access-Control-Max-Age', '86400');
  }
  h.set('Vary', 'Origin');
  return h;
}

const resposta = (req: Request, status: number) =>
  new Response(null, { status, headers: cors(req) });

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

// Tira query string e fragmento (podem ter token, e-mail, id de sessao).
// Valores que nao sao URL ("inline", "eval", "data", "self") ficam como estao.
function semQuery(v: unknown): string | null {
  const t = texto(v, 2000);
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol === 'data:' || u.protocol === 'blob:') return u.protocol.slice(0, -1);
    return (u.origin !== 'null' ? u.origin : u.protocol) + u.pathname;
  } catch {
    return t.split(/[?#]/)[0].slice(0, 300);
  }
}

function resumirUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  const nav =
    ua.match(/(Edg|OPR|SamsungBrowser|Firefox|FxiOS|CriOS|Chrome)\/(\d+)/) ??
    (/Safari\//.test(ua) ? ua.match(/(Version)\/(\d+)/) : null);
  let navegador = 'Outro';
  if (nav) {
    const nomes: Record<string, string> = {
      Edg: 'Edge', OPR: 'Opera', SamsungBrowser: 'Samsung', FxiOS: 'Firefox',
      CriOS: 'Chrome', Version: 'Safari',
    };
    navegador = `${nomes[nav[1]] ?? nav[1]} ${nav[2]}`;
  }
  const so =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Outro';
  return `${navegador} / ${so}`;
}

type Linha = {
  directive: string;
  blocked_uri: string | null;
  document_uri: string | null;
  user_agent: string | null;
};

// deno-lint-ignore no-explicit-any
function deCspReport(corpo: any, ua: string | null): Linha[] {
  const r = corpo?.['csp-report'];
  if (!r || typeof r !== 'object') return [];
  const directive = texto(r['effective-directive'], 100) ?? texto(r['violated-directive'], 100);
  if (!directive) return [];
  return [{
    directive: directive.split(' ')[0],
    blocked_uri: semQuery(r['blocked-uri']),
    document_uri: semQuery(r['document-uri']),
    user_agent: resumirUserAgent(ua),
  }];
}

// deno-lint-ignore no-explicit-any
function deReportsJson(corpo: any, ua: string | null): Linha[] {
  if (!Array.isArray(corpo)) return [];
  const linhas: Linha[] = [];
  for (const rel of corpo.slice(0, MAX_RELATORIOS_POR_ENVIO)) {
    if (rel?.type !== 'csp-violation' || !rel.body || typeof rel.body !== 'object') continue;
    const b = rel.body;
    const directive = texto(b.effectiveDirective, 100) ?? texto(b.violatedDirective, 100);
    if (!directive) continue;
    linhas.push({
      directive: directive.split(' ')[0],
      blocked_uri: semQuery(b.blockedURL ?? b.blockedURI),
      document_uri: semQuery(b.documentURL ?? b.documentURI ?? rel.url),
      user_agent: resumirUserAgent(texto(rel.user_agent, 500) ?? ua),
    });
  }
  return linhas;
}

async function lerCorpoLimitado(req: Request): Promise<string | null> {
  const declarado = Number(req.headers.get('content-length') ?? '0');
  if (declarado > TAMANHO_MAXIMO) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > TAMANHO_MAXIMO) {
      await reader.cancel();
      return null;
    }
    partes.push(value);
  }
  const tudo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { tudo.set(p, pos); pos += p.byteLength; }
  return new TextDecoder().decode(tudo);
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return resposta(req, 204);
  if (req.method !== 'POST') return resposta(req, 405);

  const tipo = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!TIPOS_ACEITOS.includes(tipo)) return resposta(req, 415);

  if (!dentroDoLimite(ipDe(req))) return resposta(req, 429);

  const bruto = await lerCorpoLimitado(req);
  if (bruto === null) return resposta(req, 413);

  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return resposta(req, 400);
  }

  const ua = req.headers.get('user-agent');
  const linhas = tipo === 'application/csp-report' ? deCspReport(corpo, ua) : deReportsJson(corpo, ua);
  if (linhas.length === 0) return resposta(req, 400);

  // Teto global no banco: o limite por IP acima e por instancia (o runtime
  // recicla instancias), entao este e o que garante que uma enxurrada nao
  // enche a tabela.
  const { count, error: erroContagem } = await supabase
    .from('csp_reports')
    .select('id', { count: 'exact', head: true })
    .gte('criado_em', new Date(Date.now() - JANELA_MS).toISOString());
  if (erroContagem) {
    console.error('csp-report: falha ao contar', erroContagem.code, erroContagem.message);
    return resposta(req, 500);
  }
  if ((count ?? 0) >= LIMITE_GLOBAL_POR_MINUTO) return resposta(req, 429);

  const { error } = await supabase.from('csp_reports').insert(linhas);
  if (error) {
    console.error('csp-report: falha ao gravar', error.code, error.message);
    return resposta(req, 500);
  }
  return resposta(req, 204);
});
