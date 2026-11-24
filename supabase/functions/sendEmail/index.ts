import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// sendEmail v11 — 24/11/2026 (T3): links de documento assinados no servidor.
//   O bucket `documentos` (NF, boleto, comprovante) fica privado. Quem manda
//   e-mail com link de arquivo envia `documentos: [caminho, ...]` e usa
//   {{documento_0}}, {{documento_1}}... no html. Aqui, para cada caminho:
//     - confere que quem envia tem acesso ao arquivo (RPC documento_acessivel:
//       staff, o fornecedor dono da pasta/pedido ou o cliente do pedido);
//     - gera URL assinada de 60 dias com a service role e troca o marcador.
//   Sem acesso: 403 e nada sai. Arquivo sumido: o marcador vira link do portal.
//
// sendEmail v10 — hotfix 23/11/2026: deixou de ser relay aberto.
//
// Ate a v9 qualquer pessoa, sem login, mandava POST com to/subject/html/from_name
// e o Resend enviava como nao-responda@info.portalpolowear.com.br (dominio
// verificado). Agora:
//   1. Exige sessao valida: o JWT e validado AQUI com auth.getUser(). O
//      `verify_jwt` da plataforma fica DESLIGADO de proposito: os tokens de sessao
//      deste projeto ainda sao HS256 (legado) e o gateway os recusa com
//      UNAUTHORIZED_LEGACY_JWT — mesmo motivo das funcoes de admin (create-user etc.).
//      Se alguem reimplantar pela CLI, mantenha verify_jwt = false.
//   2. Destinatario depende do papel (users.role):
//      - admin / vendedor: livre, como antes (CRM, credenciais de acesso etc.).
//      - fornecedor: so o comprador (users.email) de um pedido do proprio
//        fornecedor — FaturarPedidoModal e PedidosFornecedor avisam o cliente.
//      - qualquer papel logado: a equipe (EQUIPE abaixo) — aviso de lead novo do
//        CadastroCompra, enviado logo apos o signup do lojista.
//      Fora disso: 403. Nunca destinatario arbitrario.
//   3. from_name livre so para staff; os demais saem como "POLO B2B".
//   4. CORS so para os dominios do portal.
//   5. Unica chamada aceita SEM login: o modelo fixo `lead_franqueado` (formulario
//      publico do CadastroCompra). Destinatario vem da configuracao do servidor
//      (LEAD_EMAIL_TO ou EQUIPE), assunto e remetente fixos, campos do lead
//      escapados como texto e com tamanho maximo, honeypot `website` e limite de
//      5 envios por hora por IP. Qualquer outra chamada sem login: 401.

const ALLOWED_ORIGINS = [
  'https://www.portalpolowear.com.br',
  'https://portalpolowear.com.br',
  'https://polo-wear-b2-b.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
];

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function withCors(req: Request, res: Response): Response {
  const origin = req.headers.get('Origin') ?? '';
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  return res;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Remetente: precisa ser um dominio VERIFICADO no Resend, senao a API responde
// 403 validation_error e nenhum e-mail sai. Mesmo dominio do notify-pedido.
const FROM_EMAIL = 'nao-responda@info.portalpolowear.com.br';
const FROM_NAME_PADRAO = 'POLO B2B';

// Caixa da equipe que recebe aviso de lead novo (CadastroCompra).
const EQUIPE = ['roberto@polomultimarca.com.br'];

const PAPEIS_STAFF = ['admin', 'vendedor'];

// Links de documento (T3).
const PORTAL_URL = 'https://www.portalpolowear.com.br';
const VALIDADE_LINK_EMAIL = 60 * 24 * 60 * 60; // 60 dias, decisao do dono
const MAX_DOCUMENTOS = 10;
const RE_CAMINHO_DOCUMENTO = /^(?:uploads|fornecedor|cliente)\/[A-Za-z0-9._\-\/ ]+$/;

function caminhoDocumentoValido(c: unknown): c is string {
  if (typeof c !== 'string' || c.length > 400) return false;
  if (!RE_CAMINHO_DOCUMENTO.test(c)) return false;
  return !c.split('/').some((p) => p === '' || p === '.' || p === '..');
}

// Troca {{documento_N}} pela URL assinada do caminho N. Devolve null se quem
// envia nao tem acesso a algum dos arquivos.
// deno-lint-ignore no-explicit-any
async function linksDeDocumentos(admin: any, callerId: string, documentos: unknown): Promise<string[] | null> {
  if (documentos === undefined || documentos === null) return [];
  if (!Array.isArray(documentos) || documentos.length > MAX_DOCUMENTOS) return null;
  const links: string[] = [];
  for (const caminho of documentos) {
    // null = a tela nao achou o caminho (URL fora do padrao): link do portal.
    if (caminho === null) { links.push(`${PORTAL_URL}/MeusPedidos`); continue; }
    if (!caminhoDocumentoValido(caminho)) return null;
    const { data: ok, error: errAcesso } = await admin.rpc('documento_acessivel', { p_nome: caminho, p_user: callerId });
    if (errAcesso || ok !== true) {
      console.warn('sendEmail: documento recusado', { caller: callerId, erro: errAcesso?.message ?? null });
      return null;
    }
    const { data, error } = await admin.storage.from('documentos').createSignedUrl(caminho, VALIDADE_LINK_EMAIL);
    if (error || !data?.signedUrl) {
      console.warn('sendEmail: nao assinou documento, usa link do portal', error?.message);
      links.push(`${PORTAL_URL}/MeusPedidos`);
    } else {
      links.push(data.signedUrl);
    }
  }
  return links;
}

function aplicarLinks(html: string, links: string[]): string {
  // Marcador sem documento correspondente vira link do portal: nunca sai cru.
  return html.replace(/\{\{documento_(\d+)\}\}/g, (_m, i) => escapeHtml(links[Number(i)] ?? `${PORTAL_URL}/MeusPedidos`));
}
const MAX_DESTINATARIOS_NAO_STAFF = 5;

const norm = (e: unknown) => String(e ?? '').trim().toLowerCase();

// deno-lint-ignore no-explicit-any
async function destinatariosPermitidosFornecedor(admin: any, fornecedorId: string, destinos: string[]): Promise<boolean> {
  if (!fornecedorId) return false;
  for (const d of destinos) {
    if (EQUIPE.includes(d)) continue;
    // ilike trata _ e % como curinga: busca candidatos e compara exato aqui.
    const { data: candidatos } = await admin.from('users').select('id, email').ilike('email', d).limit(20);
    const ids = (candidatos ?? []).filter((u: { email: string }) => norm(u.email) === d).map((u: { id: string }) => u.id);
    if (ids.length === 0) return false;
    const { data: pedido } = await admin
      .from('pedidos')
      .select('id')
      .eq('fornecedor_id', fornecedorId)
      .in('comprador_user_id', ids)
      .limit(1)
      .maybeSingle();
    if (!pedido) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Modelo fixo `lead_franqueado` (aceito sem login).
// ---------------------------------------------------------------------------

const LEAD_TIPOS: Record<string, { assunto: string; titulo: string }> = {
  franqueado: {
    assunto: 'Nova Solicitação - Cadastro Franqueado POLO Wear',
    titulo: 'Nova solicitação de cadastro de franqueado POLO Wear',
  },
  lojista: {
    assunto: 'Novo Lead - Cadastro de Lojista POLO Wear',
    titulo: 'Novo lead de lojista interessado em revender POLO Wear',
  },
};

// [campo, rotulo, tamanho maximo]. Qualquer outro campo enviado e ignorado.
const LEAD_SECOES: [string, [string, string, number][]][] = [
  ['DADOS DA LOJA', [
    ['nome_loja', 'Nome da Loja', 200],
    ['cnpj', 'CNPJ', 30],
    ['inscricao_estadual', 'Inscrição Estadual', 40],
  ]],
  ['RESPONSÁVEL', [
    ['nome_responsavel', 'Nome', 200],
    ['cpf_responsavel', 'CPF', 20],
    ['email_responsavel', 'Email', 200],
    ['telefone_responsavel', 'Telefone', 40],
    ['whatsapp_responsavel', 'WhatsApp', 40],
  ]],
  ['ENDEREÇO', [
    ['endereco', 'Endereço', 400],
    ['cep', 'CEP', 20],
    ['entrega', 'Entrega', 400],
  ]],
  ['CONTATO FINANCEIRO', [
    ['contato_financeiro_nome', 'Nome', 200],
    ['contato_financeiro_email', 'Email', 200],
    ['contato_financeiro_telefone', 'Telefone', 40],
  ]],
  ['CONTATO COMERCIAL', [
    ['contato_comercial_nome', 'Nome', 200],
    ['contato_comercial_email', 'Email', 200],
    ['contato_comercial_telefone', 'Telefone', 40],
  ]],
  ['INFORMAÇÕES COMERCIAIS', [
    ['tempo_atuacao', 'Tempo de Atuação', 100],
    ['numero_funcionarios', 'Funcionários', 50],
    ['observacoes', 'Observações', 2000],
  ]],
];

const LEAD_LIMITE_POR_IP = 5;
const LEAD_JANELA_MS = 60 * 60 * 1000;
// Em memoria, por instancia da funcao: barreira simples contra rajada, nao contador global.
const leadEnviosPorIp = new Map<string, number[]>();

function leadDentroDoLimite(ip: string): boolean {
  const agora = Date.now();
  const recentes = (leadEnviosPorIp.get(ip) ?? []).filter((t) => agora - t < LEAD_JANELA_MS);
  if (recentes.length >= LEAD_LIMITE_POR_IP) {
    leadEnviosPorIp.set(ip, recentes);
    return false;
  }
  recentes.push(agora);
  leadEnviosPorIp.set(ip, recentes);
  if (leadEnviosPorIp.size > 5000) leadEnviosPorIp.clear();
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function campoTexto(v: unknown, max: number): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function destinatariosLead(): string[] {
  const env = (Deno.env.get('LEAD_EMAIL_TO') ?? '').split(',').map(norm).filter(Boolean);
  return env.length > 0 ? env : EQUIPE;
}

function ipDe(req: Request): string {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    ?? 'desconhecido';
}

// deno-lint-ignore no-explicit-any
async function enviarLead(req: Request, payload: any): Promise<Response> {
  const lead = (payload?.lead && typeof payload.lead === 'object') ? payload.lead : {};
  const tipo = LEAD_TIPOS[String(payload?.tipo ?? 'franqueado')] ? String(payload?.tipo ?? 'franqueado') : null;
  if (!tipo) {
    return json({ success: false, error: 'Modelo invalido' }, 400);
  }

  // Honeypot: campo escondido no formulario; gente nao preenche, robo sim.
  // Responde como se tivesse enviado, para o robo nao aprender.
  if (campoTexto(lead.website, 200)) {
    console.warn('sendEmail lead: honeypot preenchido, descartado');
    return json({ success: true, status: 'sent' }, 200);
  }

  if (!campoTexto(lead.nome_loja, 200) || !campoTexto(lead.nome_responsavel, 200) || !campoTexto(lead.email_responsavel, 200)) {
    return json({ success: false, error: 'Campos obrigatorios do lead ausentes' }, 400);
  }

  if (!leadDentroDoLimite(ipDe(req))) {
    console.warn('sendEmail lead: limite por IP atingido');
    return json({ success: false, error: 'Muitas solicitacoes. Tente novamente mais tarde.' }, 429);
  }

  const { assunto, titulo } = LEAD_TIPOS[tipo];
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const secoes = LEAD_SECOES.map(([nomeSecao, campos]) => {
    const linhas = campos.map(([campo, rotulo, max]) => {
      const valor = campoTexto(lead[campo], max) || 'Não informado';
      return `${escapeHtml(rotulo)}: ${escapeHtml(valor).replace(/\n/g, '<br>')}`;
    });
    return `<p><strong>${escapeHtml(nomeSecao)}</strong><br>${linhas.join('<br>')}</p>`;
  }).join('');
  const html = `<div style="font-family: Arial, sans-serif;"><p>${escapeHtml(titulo)}:</p>${secoes}`
    + `<p>Origem: Formulário Site<br>Data: ${escapeHtml(data)}</p></div>`;

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY não configurada');
    return json({ success: false, error: 'Serviço de email não configurado' }, 500);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${FROM_NAME_PADRAO} <${FROM_EMAIL}>`,
      to: destinatariosLead(),
      subject: assunto,
      html,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Erro Resend (lead):', response.status, result);
    return json({ success: false, error: 'Erro ao enviar email' }, response.status === 429 ? 429 : 502);
  }
  console.log('Lead enviado:', result.id, 'tipo', tipo);
  return json({ success: true, message_id: result.id, status: 'sent', sent_at: new Date().toISOString() }, 200);
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok');
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Metodo nao permitido' }, 405);
  }

  try {
    // deno-lint-ignore no-explicit-any
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json({ success: false, error: 'JSON invalido' }, 400);
    }

    // Modelo fixo, com ou sem login: destinatario, assunto e remetente do servidor.
    if (payload?.template === 'lead_franqueado') {
      return await enviarLead(req, payload);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return json({ success: false, error: 'Login necessario' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // A chave anon publica tambem e um JWT, mas nao tem usuario: getUser() falha.
    const { data: { user: caller }, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller) {
      return json({ success: false, error: 'Login necessario' }, 401);
    }

    const { data: perfil } = await admin
      .from('users')
      .select('role, fornecedor_id, ativo')
      .eq('id', caller.id)
      .maybeSingle();
    if (!perfil || perfil.ativo === false) {
      return json({ success: false, error: 'Usuario sem permissao para enviar e-mail' }, 403);
    }

    const { to, subject, body, html, from_name, documentos } = payload ?? {};

    if (!to || !subject || (!body && !html)) {
      return json({ success: false, error: 'Campos obrigatórios: to, subject, body ou html' }, 400);
    }

    const destinos = (Array.isArray(to) ? to : [to]).map(norm).filter(Boolean);
    if (destinos.length === 0) {
      return json({ success: false, error: 'Destinatario invalido' }, 400);
    }

    const isStaff = PAPEIS_STAFF.includes(perfil.role);
    if (!isStaff) {
      let permitido = destinos.length <= MAX_DESTINATARIOS_NAO_STAFF;
      if (permitido) {
        if (perfil.role === 'fornecedor') {
          permitido = await destinatariosPermitidosFornecedor(admin, perfil.fornecedor_id, destinos);
        } else {
          permitido = destinos.every((d) => EQUIPE.includes(d));
        }
      }
      if (!permitido) {
        console.warn('sendEmail: destinatario recusado', { caller: caller.id, role: perfil.role, qtd: destinos.length });
        return json({ success: false, error: 'Destinatario nao permitido' }, 403);
      }
    }

    const linksDocumentos = await linksDeDocumentos(admin, caller.id, documentos);
    if (linksDocumentos === null) {
      return json({ success: false, error: 'Documento nao permitido' }, 403);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY não configurada');
      return json({ success: false, error: 'Serviço de email não configurado' }, 500);
    }

    // Preparar conteúdo do email
    let emailContent: string;
    if (html) {
      emailContent = html;
    } else if (body && (body.trim().startsWith('<') || body.trim().toLowerCase().startsWith('<!doctype'))) {
      emailContent = body;
    } else {
      emailContent = `<div style="font-family: Arial, sans-serif;">${(body || '').replace(/\n/g, '<br>')}</div>`;
    }

    const nomeRemetente = isStaff && from_name
      ? String(from_name).replace(/[<>"\r\n]/g, '').slice(0, 60)
      : FROM_NAME_PADRAO;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${nomeRemetente} <${FROM_EMAIL}>`,
        to: destinos,
        subject: String(subject),
        html: aplicarLinks(emailContent, linksDocumentos)
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Erro Resend:', response.status, result);
      const msg = response.status === 429
        ? 'Limite de envio de e-mails atingido, tente novamente em instantes'
        : 'Erro ao enviar email';
      return json({ success: false, error: msg }, response.status === 429 ? 429 : 502);
    }

    console.log('Email enviado:', result.id, 'por', caller.id, 'role', perfil.role, 'qtd', destinos.length);

    return json({
      success: true,
      message_id: result.id,
      to,
      subject,
      status: 'sent',
      sent_at: new Date().toISOString()
    }, 200);
  } catch (error) {
    console.error('Erro na função:', error);
    return json({ success: false, error: 'Erro interno' }, 500);
  }
}

Deno.serve(async (req: Request) => withCors(req, await handler(req)));
