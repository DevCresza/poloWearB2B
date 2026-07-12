import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Reseta a senha de qualquer email via service_role. Sem esta checagem,
    // qualquer cliente logado assumia a conta do admin. Padrao: deleteAuthUser.
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
    return json({ error: err.message || 'Erro interno' }, 500);
  }
});
