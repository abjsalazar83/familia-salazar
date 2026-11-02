// Mercadona × Lidl por produto. Fontes, por esta ordem: preço de prateleira (manual ou referência escolhida) e talões da família
// (o mais recente vence); só se não houver nenhum, a melhor correspondência do Open Prices dessa cadeia em Portugal.
// Sem fonte → null (mostra «—»). Nunca se inventa um valor.
import type { Unit } from './types';
import type { Buy } from './prices';
import { webMatches, type WebPrice } from './webprice';

export const CHAINS = ['mercadona', 'lidl'] as const;
export type Chain = (typeof CHAINS)[number];
export const CHAIN_NAME: Record<Chain, string> = { mercadona: 'Mercadona', lidl: 'Lidl' };
export type PBase = 'kg' | 'L' | 'un';
export type Shelf = { id: string; key: string; chain: Chain; source: 'manual' | 'web'; web_id: string | null; price_cents: number; base: PBase | null; seen_on: string; created_at: string };
export type Quote = { chain: Chain; cents: number; base: PBase | null; source: 'talão' | 'manual' | 'web'; at: string; name?: string; auto?: boolean };

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Cadeia a partir do nome da loja (descrição da despesa ou loja do Open Prices). */
export function chainOf(store: string | null | undefined): Chain | null {
  const n = strip(store ?? '');
  return /\bmercadona\b/.test(n) ? 'mercadona' : /\blidl\b/.test(n) ? 'lidl' : null;
}

const fromBuy = (b: Buy, chain: Chain): Quote => b.per != null && b.base && b.base !== 'pack'
  ? { chain, cents: b.per, base: b.base, source: 'talão', at: b.at } : { chain, cents: b.paid, base: null, source: 'talão', at: b.at };
const fromWeb = (w: WebPrice, chain: Chain, auto: boolean): Quote => w.unit_price_cents != null && w.base
  ? { chain, cents: w.unit_price_cents, base: w.base, source: 'web', at: w.seen_on ?? '', name: w.name, auto } : { chain, cents: w.price_cents, base: null, source: 'web', at: w.seen_on ?? '', name: w.name, auto };

/** Preço de cada cadeia para um item. */
export function quotes(name: string, buys: Buy[] | undefined, shelf: Shelf[], web: WebPrice[]): Record<Chain, Quote | null> {
  const out = {} as Record<Chain, Quote | null>;
  for (const c of CHAINS) {
    const cand: Quote[] = [];
    const lastBuy = (buys ?? []).filter((b) => chainOf(b.store) === c).slice(-1)[0];
    if (lastBuy) cand.push(fromBuy(lastBuy, c));
    const s = shelf.filter((x) => x.chain === c).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (s) { const w = s.web_id ? web.find((x) => x.id === s.web_id) : undefined;
      cand.push({ chain: c, cents: s.price_cents, base: s.base, source: s.source, at: s.seen_on, name: w?.name }); }
    // mais recente vence; empate → o que a família escreveu/escolheu
    cand.sort((a, b) => b.at.localeCompare(a.at) || (a.source === 'talão' ? 1 : -1));
    if (cand[0]) { out[c] = cand[0]; continue; }
    const m = webMatches(name, web.filter((w) => w.chain === c), 1)[0];
    out[c] = m ? fromWeb(m, c, true) : null;
  }
  return out;
}

/** Qual é mais barata — só se as duas estão na mesma base (€/kg com €/kg, preço da embalagem com embalagem). */
export function cheaper(q: Record<Chain, Quote | null>): Chain | 'igual' | null {
  const m = q.mercadona, l = q.lidl;
  if (!m || !l || m.base !== l.base) return null;
  return m.cents === l.cents ? 'igual' : m.cents < l.cents ? 'mercadona' : 'lidl';
}

/** Custo do item na lista com esse preço (quantidade × €/unidade); null se as unidades não batem. */
export function cost(q: Quote | null, qty: number | null | undefined, unit: Unit | null | undefined): number | null {
  if (!q) return null;
  const n = qty && qty > 0 ? qty : null;
  if (!n) return q.cents; // sem quantidade: 1 kg / 1 L / 1 un / 1 embalagem de cada (igual nas duas lojas → comparação justa)
  if (q.base === 'kg') return unit === 'kg' ? Math.round(q.cents * n) : unit === 'g' ? Math.round((q.cents * n) / 1000) : null;
  if (q.base === 'L') return unit === 'L' ? Math.round(q.cents * n) : null;
  if (q.base === 'un') return unit === 'un' ? Math.round(q.cents * n) : null;
  return unit === 'pack' ? Math.round(q.cents * n) : null; // preço da embalagem × n embalagens; «12 un» com preço da caixa não se multiplica
}

/** Cesto por loja só com os itens que têm preço nas duas (comparação justa). */
export function basket(rows: { q: Record<Chain, Quote | null>; qty?: number | null; unit?: Unit | null }[]) {
  let m = 0, l = 0, n = 0;
  for (const r of rows) { const a = cost(r.q.mercadona, r.qty, r.unit), b = cost(r.q.lidl, r.qty, r.unit); if (a == null || b == null) continue; m += a; l += b; n++; }
  return { mercadona: m, lidl: l, n, of: rows.length };
}

export const srcLabel = (q: Quote) => q.source === 'talão' ? 'talão' : q.source === 'manual' ? 'prateleira' : q.auto ? 'internet?' : 'internet';
