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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Troca a senha de QUALQUER usuario via service_role. Sem esta checagem,
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
      return json({ error: 'Apenas administradores podem trocar a senha de outro usuario' }, 403);
    }

    const { user_id, email, new_password } = await req.json();

    if (!new_password || new_password.length < 6) {
      return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
    }

    let targetUserId = user_id;

    // Se não tem user_id mas tem email, buscar o user_id pelo email
    if (!targetUserId && email) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', email)
        .single();

      if (userError || !userData) {
        return json({ error: 'Usuário não encontrado' }, 404);
      }
      targetUserId = userData.id;
    }

    if (!targetUserId) {
      return json({ error: 'user_id ou email é obrigatório' }, 400);
    }

    // Atualizar a senha do usuário
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: new_password }
    );

    if (error) {
      console.error('Erro ao atualizar senha:', error);
      return json({ error: error.message }, 500);
    }

    return json({ success: true, message: 'Senha atualizada com sucesso' }, 200);
  } catch (err) {
    console.error('Erro:', err);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
