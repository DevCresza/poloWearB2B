import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Data de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().split('T')[0];

    // Buscar títulos que vencem hoje e estão pendentes
    const { data: titulosVencendo, error: titulosError } = await supabase
      .from('carteira')
      .select(`
        *,
        pedido:pedido_id(*),
        cliente:cliente_user_id(*)
      `)
      .eq('data_vencimento', hoje)
      .eq('status', 'pendente');

    if (titulosError) {
      throw titulosError;
    }

    console.log(`Encontrados ${titulosVencendo?.length || 0} títulos vencendo hoje`);

    const emailsEnviados = [];
    const erros = [];

    for (const titulo of titulosVencendo || []) {
      try {
        const cliente = titulo.cliente;
        const pedido = titulo.pedido;

        if (!cliente?.email) {
          console.log(`Cliente sem email para título ${titulo.id}`);
          continue;
        }

        // Formatar valor
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(titulo.valor);

        // Formatar data
        const dataFormatada = new Date(titulo.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR');

        // Montar descrição da parcela
        const descricaoParcela = titulo.total_parcelas > 1
          ? `Parcela ${titulo.parcela_numero}/${titulo.total_parcelas}`
          : 'Pagamento';

        // Enviar email usando Resend ou outro serviço
        const resendApiKey = Deno.env.get('RESEND_API_KEY');

        if (resendApiKey) {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'POLO B2B <noreply@polomultimarca.com.br>',
              to: cliente.email,
              subject: `⚠️ Lembrete de Vencimento - ${descricaoParcela} vence hoje!`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">⚠️ Vencimento Hoje</h1>
                  </div>
                  <div style="padding: 30px; background: white;">
                    <p>Olá <strong>${cliente.full_name || 'Cliente'}</strong>,</p>
                    <p>Este é um lembrete de que você tem um pagamento vencendo <strong>hoje</strong>:</p>

                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                      <p style="margin: 5px 0;"><strong>${descricaoParcela}</strong></p>
                      <p style="margin: 5px 0;"><strong>Valor:</strong> ${valorFormatado}</p>
                      <p style="margin: 5px 0;"><strong>Vencimento:</strong> ${dataFormatada}</p>
                      ${pedido ? `<p style="margin: 5px 0;"><strong>Pedido:</strong> #${pedido.id?.slice(-8).toUpperCase()}</p>` : ''}
                      ${titulo.descricao ? `<p style="margin: 5px 0;"><strong>Ref:</strong> ${titulo.descricao}</p>` : ''}
                    </div>

                    ${titulo.boleto_url ? `
                      <div style="text-align: center; margin-top: 30px;">
                        <a href="${titulo.boleto_url}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                          📄 Baixar Boleto
                        </a>
                      </div>
                    ` : ''}

                    <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                      Após efetuar o pagamento, envie o comprovante pelo sistema para agilizar a baixa.
                    </p>
                    <p style="font-size: 12px; color: #9ca3af;">
                      Em caso de dúvidas, entre em contato conosco.
                    </p>
                  </div>
                </div>
              `
            })
          });

          if (emailResponse.ok) {
            emailsEnviados.push({
              titulo_id: titulo.id,
              cliente_email: cliente.email,
              valor: titulo.valor
            });

            // Marcar que o lembrete foi enviado
            await supabase
              .from('carteira')
              .update({ lembrete_enviado: true, data_lembrete: new Date().toISOString() })
              .eq('id', titulo.id);
          } else {
            const errorText = await emailResponse.text();
            erros.push({ titulo_id: titulo.id, erro: errorText });
          }
        } else {
          console.log('RESEND_API_KEY não configurada');
        }
      } catch (emailError) {
        console.error(`Erro ao enviar email para título ${titulo.id}:`, emailError);
        erros.push({ titulo_id: titulo.id, erro: String(emailError) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data_processamento: hoje,
        titulos_encontrados: titulosVencendo?.length || 0,
        emails_enviados: emailsEnviados.length,
        erros: erros.length,
        detalhes: { enviados: emailsEnviados, erros }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
