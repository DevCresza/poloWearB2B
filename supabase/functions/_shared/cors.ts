// Headers CORS compartilhados por todas as Edge Functions.
// IMPORTANTE: qualquer header customizado enviado pelo frontend
// (supabase-js global.headers) PRECISA estar listado em Allow-Headers,
// senão o navegador bloqueia o POST após o preflight
// ("Failed to send a request to the Edge Function").
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
