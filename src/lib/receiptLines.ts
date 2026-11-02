// Linhas de produto de um talão português (texto do OCR no telemóvel). Só sugere: nada é gravado sem confirmação.
// Nota: o código QR da fatura (Portaria 195/2020) só tem totais por taxa de IVA e total — não tem linhas.
import { norm } from './shop';
import type { Unit } from './types';

export type RLine = { name: string; qty: number | null; unit: Unit | null; unitPrice: number | null; total: number };

const SKIP = /\b(sub ?total|total|iva|taxa|troco|multibanco|\bmb\b|visa|mastercard|nif|contribuinte|atcud|cart[aã]o|pagamento|pago|dinheiro|numer[aá]rio|fatura|factura|talao|tal[aã]o|data|hora|caixa|operador|obrigad|www|tel\b|telefone|morada|saldo|acumul|cup[aã]o|poupan[cç]a|vale|isento|base|incid|n\.?º|artigos)\b/i;
const AMT = String.raw`(-?\d+[.,]\d{2})`;
const cents = (s: string) => Math.round(Number(s.replace(',', '.')) * 100);
const WEIGHT = new RegExp(String.raw`(\d+[.,]\d{1,3})\s*(kg|g|l)\b\s*[x×*]\s*${AMT}`, 'i');
const COUNT = new RegExp(String.raw`(?:^|\s)(\d{1,3})\s*(?:un\s*)?[x×*]\s*${AMT}`, 'i');
const PRODUCT = new RegExp(String.raw`^(.*?[a-zA-ZÀ-ÿ]{2}.*?)\s+${AMT}\s*(?:€|eur)?\s*(?:\(?[A-Z]{1,2}\)?|\d{1,2}%)?\s*$`, 'i');

export function parseLines(text: string): RLine[] {
  const out: RLine[] = []; let pending: { qty: number; unit: Unit; unitPrice: number } | null = null;
  for (const raw of text.split('\n')) {
    const l = raw.replace(/\s+/g, ' ').trim(); if (!l) continue;
    const w = l.match(WEIGHT), c = w ? null : l.match(COUNT);
    const qinfo = w ? { qty: Number(w[1].replace(',', '.')), unit: w[2].toLowerCase() === 'l' ? 'L' as Unit : w[2].toLowerCase() as Unit, unitPrice: cents(w[3]) }
      : c ? { qty: Number(c[1]), unit: 'un' as Unit, unitPrice: cents(c[2]) } : null;
    const rest = qinfo ? l.replace(w ? w[0] : c![0], ' ').trim() : l;
    const p = rest.match(PRODUCT);
    if (p && !SKIP.test(p[1])) {
      const name = p[1].replace(/\s+\d+[.,]\d{2}\s*$/, '').trim(); const total = cents(p[2]);
      if (total < 0) { const prev = out[out.length - 1]; if (prev && /desc|promo|poup/i.test(name)) prev.total = Math.max(0, prev.total + total); continue; }
      if (name.replace(/[^a-zA-ZÀ-ÿ]/g, '').length < 2) continue;
      const q = qinfo ?? pending; pending = null;
      out.push({ name, qty: q?.qty ?? null, unit: q?.unit ?? null, unitPrice: q?.unitPrice ?? null, total });
      continue;
    }
    if (qinfo) {
      // «1,205 kg x 1,49 €/kg» por baixo (ou por cima) do produto.
      const prev = out[out.length - 1];
      if (prev && prev.qty == null && (!rest || /^[\d.,\s€a-z/]*$/i.test(rest)) && Math.abs(Math.round(qinfo.qty * qinfo.unitPrice) - prev.total) <= Math.max(2, prev.total * 0.02)) Object.assign(prev, qinfo);
      else pending = qinfo;
    }
  }
  return out;
}

const words = (s: string) => norm(s).split(' ').filter((w) => w.length >= 3);
/** Semelhança simples: palavras do item que aparecem (por prefixo de 4 letras) no nome da linha. */
export function score(item: string, line: string): number {
  const a = words(item), b = words(line); if (!a.length || !b.length) return 0;
  let hit = 0; for (const w of a) { const k = w.slice(0, Math.max(3, Math.min(5, w.length - 1))); if (b.some((x) => x.startsWith(k) || k.startsWith(x.slice(0, 4)) && x.length >= 4)) hit++; }
  return hit / a.length;
}

/** Atribui cada linha ao item mais parecido (cada item no máximo uma vez). Devolve índice da linha → id do item. */
export function matchLines(lines: RLine[], items: { id: string; name: string }[]): Record<number, string> {
  const pairs: [number, number, string][] = [];
  lines.forEach((l, li) => items.forEach((it) => { const s = score(it.name, l.name); if (s >= 0.5) pairs.push([s, li, it.id]); }));
  pairs.sort((x, y) => y[0] - x[0]);
  const out: Record<number, string> = {}; const used = new Set<string>();
  for (const [, li, id] of pairs) if (out[li] == null && !used.has(id)) { out[li] = id; used.add(id); }
  return out;
}
