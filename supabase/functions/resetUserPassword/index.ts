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

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Reseta a senha de qualquer email via service_role. Sem esta checagem,
    // qualquer cliente logado assumia a conta do admin. A autorizacao e feita
    // AQUI, nao pelo `verify_jwt` da plataforma: validamos o token com
    // auth.getUser() e exigimos papel admin. Padrao: deleteAuthUser.
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
      return json({ error: 'Apenas administradores podem resetar senhas' }, 403);
    }

    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return json({ error: 'email e newPassword são obrigatórios' }, 400);
    }

    if (newPassword.length < 6) {
      return json({ error: 'A senha deve ter pelo menos 6 caracteres' }, 400);
    }

    // Buscar usuário pelo email na tabela users (mais eficiente)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return json({ error: 'Usuário não encontrado' }, 404);
    }

    // Atualizar senha usando o ID do usuário
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.id,
      { password: newPassword }
    );

    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    return json({ success: true, message: 'Senha atualizada com sucesso' }, 200);
  } catch (err) {
    console.error('Erro resetUserPassword:', err);
    return json({ error: 'Erro interno' }, 500);
  }
}

Deno.serve(async (req: Request) => withCors(req, await handler(req)));
