import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, password, full_name, role, tipo_negocio } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'email e password são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar se já existe usuário com esse email na tabela users
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Já existe um usuário com este email' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar usuário no Auth com email já confirmado (sem trocar sessão de quem chamou)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, tipo_negocio },
    });

    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || 'Falha ao criar usuário no Auth' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar registro public.users
    const userRow: Record<string, unknown> = { id: authData.user.id, email };
    const allowed = [
      'full_name', 'role', 'tipo_negocio', 'empresa', 'telefone',
      'fornecedor_id', 'ativo', 'cnpj', 'cidade', 'estado',
      'endereco_completo', 'cep', 'categoria_cliente', 'permissoes', 'observacoes'
    ];
    for (const k of allowed) {
      if (body[k] !== undefined && body[k] !== null) userRow[k] = body[k];
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('users')
      .insert([userRow])
      .select()
      .single();

    if (insertError) {
      // rollback do auth user para não deixar órfão
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar dados do usuário: ' + insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user: inserted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Erro create-user:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
