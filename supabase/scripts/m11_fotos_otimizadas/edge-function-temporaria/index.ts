// TEMPORARIA (M11): recebe as fotos otimizadas e grava no bucket produtos,
// sob otimizadas/. Sai do ar ao fim do reprocessamento, junto com o segredo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CHAVE_OK = /^otimizadas\/produtos\/[A-Za-z0-9._-]{1,200}\.webp$/;
const MAX = 3 * 1024 * 1024;

let segredoCache: string | null = null;
async function segredo(): Promise<string | null> {
  if (segredoCache) return segredoCache;
  const { data } = await supa.from("app_settings").select("value")
    .eq("key", "tmp_upload_fotos_secret").maybeSingle();
  segredoCache = data?.value ?? null;
  return segredoCache;
}

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const json = (s: number, o: unknown) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "metodo" });
  const dado = req.headers.get("x-upload-secret") ?? "";
  const s = await segredo();
  if (!s || s.length < 32 || !iguais(dado, s)) return json(401, { erro: "nao autorizado" });

  const chave = new URL(req.url).searchParams.get("chave") ?? "";
  if (!CHAVE_OK.test(chave)) return json(400, { erro: "chave invalida" });

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length < 12 || buf.length > MAX) return json(400, { erro: "tamanho" });
  const riff = String.fromCharCode(...buf.slice(0, 4)), webp = String.fromCharCode(...buf.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return json(400, { erro: "nao e webp" });

  const { error } = await supa.storage.from("produtos").upload(chave, buf, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    const msg = String(error.message || "");
    if (/exist|duplicate/i.test(msg)) return json(200, { ok: true, ja_existia: true });
    return json(500, { erro: "upload falhou" });
  }
  return json(200, { ok: true });
});
