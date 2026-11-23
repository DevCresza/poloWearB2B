// Uso: npm i sharp@0.34 && node processar.js (le lista.json: [{name,size}] dos arquivos em uso).
/* global Buffer */
// Baixa cada foto pela URL publica, gera WebP <=1600px q82 e grava em out/.
// Idempotente: pula o que ja esta em manifesto.json.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE = 'https://jbdcoftzffrppkyzdaqr.supabase.co/storage/v1/object/public/produtos/';
const DIR = __dirname;
const lista = JSON.parse(fs.readFileSync(path.join(DIR, 'lista.json'), 'utf8'));
const MAN = path.join(DIR, 'manifesto.json');
const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : {};
fs.mkdirSync(path.join(DIR, 'out'), { recursive: true });

const novaChave = (n) => 'otimizadas/' + n.replace(/\.jpe?g$/i, '.webp');

async function um(item) {
  if (man[item.name]?.ok) return;
  const r = await fetch(BASE + item.name.split('/').map(encodeURIComponent).join('/'));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const out = await sharp(buf).rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const chave = novaChave(item.name);
  const menor = out.data.length < buf.length;
  if (menor) {
    const f = path.join(DIR, 'out', chave);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, out.data);
  }
  man[item.name] = {
    ok: true, orig: buf.length, w: meta.width, h: meta.height, orient: meta.orientation || 1,
    novo: out.data.length, nw: out.info.width, nh: out.info.height, chave: menor ? chave : null,
  };
}

(async () => {
  const fila = lista.filter((i) => !man[i.name]?.ok);
  console.log('pendentes', fila.length, 'de', lista.length);
  let feitos = 0, erros = 0;
  const salvar = () => fs.writeFileSync(MAN, JSON.stringify(man));
  async function worker() {
    while (fila.length) {
      const it = fila.shift();
      for (let t = 0; t < 3; t++) {
        try { await um(it); break; } catch (e) {
          if (t === 2) { erros++; man[it.name] = { ok: false, erro: String(e.message || e) }; }
          else await new Promise((r) => setTimeout(r, 1000 * (t + 1)));
        }
      }
      if (++feitos % 100 === 0) { salvar(); console.log(new Date().toISOString(), feitos, 'erros', erros); }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  salvar();
  console.log('fim', feitos, 'erros', erros);
})();
