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

const PAPEIS_VALIDOS = ['admin', 'fornecedor', 'multimarca', 'franqueado', 'vendedor', 'cadastro'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Esta funcao cria usuarios com QUALQUER papel usando service_role (ignora RLS).
    // `verify_jwt` so garante "tem um JWT valido" — sem a checagem abaixo, qualquer
    // cliente logado criava um admin para si. Padrao: deleteAuthUser/index.ts.
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
      return json({ error: 'Apenas administradores podem criar usuarios' }, 403);
    }

    const body = await req.json();
    const { email, password, full_name, role, tipo_negocio } = body;

    if (!email || !password) {
      return json({ error: 'email e password são obrigatórios' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
    }
    if (role && !PAPEIS_VALIDOS.includes(role)) {
      return json({ error: `Papel inválido: ${role}` }, 400);
    }
    if (tipo_negocio && !PAPEIS_VALIDOS.includes(tipo_negocio)) {
      return json({ error: `Tipo de negócio inválido: ${tipo_negocio}` }, 400);
    }

    // Verificar se já existe usuário com esse email na tabela users
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existing) {
      return json({ error: 'Já existe um usuário com este email' }, 409);
    }

    // Criar usuário no Auth com email já confirmado (sem trocar sessão de quem chamou)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, tipo_negocio },
    });

    if (authError || !authData?.user) {
      return json({ error: authError?.message || 'Falha ao criar usuário no Auth' }, 500);
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
      return json({ error: 'Erro ao salvar dados do usuário: ' + insertError.message }, 500);
    }

    return json({ success: true, user: inserted }, 200);
  } catch (err) {
    console.error('Erro create-user:', err);
    return json({ error: 'Erro interno do servidor' }, 500);
  }
});
