import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Atualiza atomicamente o email de um usuario em auth.users + public.users
// (e opcionalmente em fornecedores.email_fornecedor quando for fornecedor).
// Tambem permite resetar a senha junto no mesmo chamado.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_id, new_email, new_password, fornecedor_id } = body || {};

    if (!user_id || !new_email) {
      return new Response(
        JSON.stringify({ error: 'user_id e new_email sao obrigatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const emailNorm = String(new_email).trim();

    // 1) Verifica se outro usuario ja tem esse email
    const { data: conflito } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .ilike('email', emailNorm)
      .neq('id', user_id)
      .maybeSingle();

    if (conflito) {
      return new Response(
        JSON.stringify({ error: 'Outro usuario ja usa este email' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar auth.users: ' + authErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Atualiza public.users
    const { error: pubErr } = await supabaseAdmin
      .from('users')
      .update({ email: emailNorm })
      .eq('id', user_id);
    if (pubErr) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar public.users: ' + pubErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4) Se fornecedor_id veio, sincroniza email_fornecedor
    if (fornecedor_id) {
      const { error: fornErr } = await supabaseAdmin
        .from('fornecedores')
        .update({ email_fornecedor: emailNorm })
        .eq('id', fornecedor_id);
      if (fornErr) {
        return new Response(
          JSON.stringify({
            success: true,
            warning: 'Email atualizado, mas erro ao sincronizar fornecedores: ' + fornErr.message,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Erro update-user-email:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
