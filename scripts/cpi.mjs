// Na compilação: vai buscar ao INE (API pública) a variação homóloga do IPC (Portugal, total, base 2025) dos últimos 15 meses.
// Se o INE não responder, mantém o ficheiro anterior. Nunca inventa: meses sem resposta ficam de fora.
import fs from 'fs';
const OUT = new URL('../src/data/cpi.json', import.meta.url);
const prev = (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return { source: 'INE', series: {} }; } })();
const months = []; const d = new Date(); d.setDate(1);
for (let k = 0; k < 15; k++) { months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); }
const get = async (m) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(`https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0014648&Dim1=S3A${m}&lang=PT`, { signal: ctl.signal });
    const j = await r.json(); const dados = j?.[0]?.Dados; if (!dados) return null;
    const row = Object.values(dados)[0]?.find((x) => x.geocod === 'PT' && x.dim_3 === 'T');
    const v = row ? Number(row.valor) : NaN; return Number.isFinite(v) ? [m.slice(0, 4) + '-' + m.slice(4), v] : null;
  } catch { return null; } finally { clearTimeout(t); }
};
// Um pedido de cada vez (o INE recusa pedidos em paralelo), com uma segunda tentativa.
const got = [];
for (const m of months) { const r = (await get(m)) ?? (await get(m)); if (r) got.push(r); }
if (!got.length) { console.log('cpi: INE sem resposta, mantém', Object.keys(prev.series).length, 'meses'); process.exit(0); }
const series = { ...prev.series, ...Object.fromEntries(got) };
const out = { source: 'INE — IPC, taxa de variação homóloga (base 2025), Portugal, total · indicador 0014648', fetched: new Date().toISOString().slice(0, 10), series: Object.fromEntries(Object.entries(series).sort()) };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n'); console.log('cpi:', got.length, 'meses do INE; último', Object.keys(out.series).pop());
