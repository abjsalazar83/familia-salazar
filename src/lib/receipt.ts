// Leitura de talões portugueses a partir do texto do OCR. Só sugere: o utilizador confirma sempre.
export type ReceiptGuess = { store: string | null; category: string | null; date: string | null; total: number | null };

export const STORES: [RegExp, string][] = [
  [/mercadona/i, 'Mercadona'], [/continente/i, 'Continente'], [/pingo\s*doce/i, 'Pingo Doce'], [/\blidl\b/i, 'Lidl'], [/\baldi\b/i, 'Aldi'],
  [/interm(a|á)rch(e|é)/i, 'Intermarché'], [/auchan|jumbo/i, 'Auchan'], [/minipre(c|ç)o|\bdia\b/i, 'Minipreço'], [/el\s*corte\s*ingl/i, 'El Corte Inglés'],
];
const SUPER = new Set(STORES.map((s) => s[1]));

/** «1.234,56» / «12,50» / «12.50» → cêntimos */
export function money(s: string): number | null {
  const m = s.replace(/\s/g, '').match(/^(\d{1,3}(?:[.\s]\d{3})*|\d+)[,.](\d{2})$/); if (!m) return null;
  return Number(m[1].replace(/[.\s]/g, '')) * 100 + Number(m[2]);
}
const AMT = /(\d{1,3}(?:\.\d{3})*|\d+)\s?[,.]\s?(\d{2})(?!\d)/g;
const amounts = (line: string) => [...line.matchAll(AMT)].map((m) => money(m[1] + ',' + m[2])!).filter((n) => n != null);

export function parseDate(text: string, today = new Date()): string | null {
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    let [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]; if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > today.getFullYear() + 1) continue;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  for (const m of text.matchAll(/\b(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})\b/g)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

const KEY = /\b(total\s*a\s*pagar|a\s*pagar|total)\b/i;
const NOT = /sub\s*-?total|iva|taxa|poupan|desconto|troco|entregue|n\.?\s*º?\s*artigos|base|cart(a|ã)o\s+cliente|saldo/i;
export function parseTotal(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cands: { v: number; w: number }[] = [];
  lines.forEach((l, i) => {
    if (!KEY.test(l) || NOT.test(l)) return;
    const w = /total\s*a\s*pagar|a\s*pagar/i.test(l) ? 3 : 2;
    for (const v of amounts(l)) cands.push({ v, w });
    if (!amounts(l).length && lines[i + 1]) for (const v of amounts(lines[i + 1])) cands.push({ v, w: w - 0.5 });
  });
  const ok = cands.filter((c) => c.v > 0 && c.v < 500000);
  if (ok.length) return ok.sort((a, b) => b.w - a.w || b.v - a.v)[0].v;
  return null;
}

export function parseStore(text: string): string | null {
  for (const [re, n] of STORES) if (re.test(text)) return n;
  const first = text.split(/\r?\n/).map((l) => l.trim()).find((l) => /[a-zà-ú]{3,}/i.test(l) && !/fatura|factura|contribuinte|nif|tel|rua|av\./i.test(l));
  return first ? first.replace(/[^\p{L}\d &'.-]/gu, '').trim().slice(0, 40) || null : null;
}

export function parseReceipt(text: string, today = new Date()): ReceiptGuess {
  const store = parseStore(text);
  return { store, category: store && SUPER.has(store) ? 'Supermercado' : null, date: parseDate(text, today), total: parseTotal(text) };
}
