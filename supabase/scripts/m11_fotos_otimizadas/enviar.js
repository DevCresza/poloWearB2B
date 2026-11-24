// Uso: node enviar.js [limite]. O segredo fica em segredo.txt ao lado (nunca no repositorio).
// Envia out/otimizadas/... pela Edge Function temporaria. Retomavel: grava enviados.json.
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const FN = 'https://jbdcoftzffrppkyzdaqr.supabase.co/functions/v1/tmp-upload-fotos';
const SEG = fs.readFileSync(path.join(DIR, 'segredo.txt'), 'utf8').trim();
const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifesto.json'), 'utf8'));
const ENV = path.join(DIR, 'enviados.json');
const env = fs.existsSync(ENV) ? JSON.parse(fs.readFileSync(ENV, 'utf8')) : {};
const limite = Number(process.argv[2]) || Infinity;

const fila = Object.values(man).filter((m) => m.ok && m.chave && !env[m.chave]).slice(0, limite);
console.log('a enviar', fila.length);
let n = 0, erros = 0;
const salvar = () => fs.writeFileSync(ENV, JSON.stringify(env));

async function worker() {
  while (fila.length) {
    const m = fila.shift();
    const body = fs.readFileSync(path.join(DIR, 'out', m.chave));
    for (let t = 0; t < 4; t++) {
      try {
        const r = await fetch(FN + '?chave=' + encodeURIComponent(m.chave), {
          method: 'POST', headers: { 'x-upload-secret': SEG, 'content-type': 'image/webp' }, body,
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(r.status + ' ' + JSON.stringify(j));
        env[m.chave] = j.ja_existia ? 'existia' : 'ok';
        break;
      } catch (e) {
        if (t === 3) { erros++; console.log('ERRO', m.chave, String(e.message)); }
        else await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
      }
    }
    if (++n % 100 === 0) { salvar(); console.log(new Date().toISOString(), n, 'erros', erros); }
  }
}
(async () => {
  await Promise.all(Array.from({ length: 4 }, worker));
  salvar();
  console.log('fim', n, 'erros', erros, 'total enviados', Object.keys(env).length);
})();
