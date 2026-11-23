import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS so para os dominios do portal (hotfix 23/11/2026). O wrapper withCors()
// no Deno.serve coloca o Access-Control-Allow-Origin certo em toda resposta.
const ALLOWED_ORIGINS = [
  'https://www.portalpolowear.com.br',
  'https://portalpolowear.com.br',
  'https://polo-wear-b2-b.vercel.app',
  // App antigo: sai da lista quando for redirecionado (tarefa T20).
  'https://polo-wear.vercel.app',
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
  return res;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Atualiza atomicamente o email de um usuario em auth.users + public.users
// (e opcionalmente em fornecedores.email_fornecedor quando for fornecedor).
// Tambem permite resetar a senha junto no mesmo chamado.
async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Troca email E senha de qualquer usuario via service_role => escalada trivial
    // sem esta checagem. A autorizacao e feita AQUI, nao pelo `verify_jwt` da
    // plataforma: validamos o token com auth.getUser() e exigimos papel admin.
    // Padrao: deleteAuthUser.
    //
    // verify_jwt ficou desligado em 02/09/2026: o gateway passou a recusar tokens
    // de sessao assinados no formato legado (HS256) com UNAUTHORIZED_LEGACY_JWT,
    // derrubando as funcoes de admin mesmo com sessao valida.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Token de autenticacao nao fornecido' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return json({ error: 'Token invalido ou expirado' }, 401);
    }

    const { data: callerData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (!callerData || callerData.role !== 'admin') {
      return json({ error: 'Apenas administradores podem alterar email de usuarios' }, 403);
    }

    const body = await req.json();
    const { user_id, new_email, new_password, fornecedor_id } = body || {};

    if (!user_id || !new_email) {
      return json({ error: 'user_id e new_email sao obrigatorios' }, 400);
    }

    const emailNorm = String(new_email).trim();

    // 1) Verifica se outro usuario ja tem esse email
    const { data: conflito } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .ilike('email', emailNorm)
      .neq('id', user_id)
      .maybeSingle();

    if (conflito) {
      return json({ error: 'Outro usuario ja usa este email' }, 409);
    }

    // 2) Atualiza auth.users (email + opcionalmente senha)
    const updatePayload: Record<string, unknown> = {
      email: emailNorm,
      email_confirm: true,
    };
    if (new_password && String(new_password).length >= 6) {
      updatePayload.password = String(new_password);
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, updatePayload);
    if (authErr) {
      return json({ error: 'Erro ao atualizar auth.users: ' + authErr.message }, 500);
    }

    // 3) Atualiza public.users
    const { error: pubErr } = await supabaseAdmin
      .from('users')
      .update({ email: emailNorm })
      .eq('id', user_id);
    if (pubErr) {
      return json({ error: 'Erro ao atualizar public.users: ' + pubErr.message }, 500);
    }

    // 4) Se fornecedor_id veio, sincroniza email_fornecedor
    if (fornecedor_id) {
      const { error: fornErr } = await supabaseAdmin
        .from('fornecedores')
        .update({ email_fornecedor: emailNorm })
        .eq('id', fornecedor_id);
      if (fornErr) {
        return json({
          success: true,
          warning: 'Email atualizado, mas erro ao sincronizar fornecedores: ' + fornErr.message,
        }, 200);
      }
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error('Erro update-user-email:', err);
    return json({ error: 'Erro interno' }, 500);
  }
}

Deno.serve(async (req: Request) => withCors(req, await handler(req)));
