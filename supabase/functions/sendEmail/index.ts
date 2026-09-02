import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Remetente: precisa ser um dominio VERIFICADO no Resend, senao a API responde
// 403 validation_error e nenhum e-mail sai.
//
// Ficou em noreply@polomultimarca.com.br ate 02/09/2026, dominio que deixou de
// ser verificado quando a operacao migrou para portalpolowear.com.br. O
// notify-pedido acompanhou a migracao, este nao -- e como as 7 chamadas do app
// engolem a falha, parou de sair e-mail de credencial de acesso e de lead novo
// sem ninguem perceber. Mesmo dominio do notify-pedido.
const FROM_EMAIL = 'nao-responda@info.portalpolowear.com.br';

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, body, html, from_name } = await req.json();

    if (!to || !subject || (!body && !html)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: to, subject, body ou html' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('RESEND_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'Serviço de email não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
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

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${from_name || 'POLO B2B'} <${FROM_EMAIL}>`,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: emailContent
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro Resend:', result);
      return new Response(
        JSON.stringify({ success: false, error: result.message || 'Erro ao enviar email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      );
    }

    console.log('Email enviado com sucesso:', result.id, 'para:', to);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.id,
        to,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
