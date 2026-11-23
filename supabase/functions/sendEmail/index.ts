import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok');
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Metodo nao permitido' }, 405);
  }

  try {
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

    const { to, subject, body, html, from_name } = await req.json();

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
        html: emailContent
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
