// Preços só a partir do histórico da própria app: linhas de talão (paid_cents) dos itens comprados, com quantidade e unidade.
// Sem dados → null (nunca se inventa um preço).
import type { Expense, Item, Unit } from './types';
import { keyOf } from './shop';

export type Base = 'kg' | 'L' | 'un' | 'pack';
export type Buy = { key: string; at: string; paid: number; per: number | null; base: Base | null; store: string | null };
export type Stats = {
  n: number; base: Base | null; avg: number | null; min: number | null; max: number | null;
  last: Buy; lastVsAvg: number | null; cheapest: { store: string; avg: number } | null; series: number[];
};

/** Preço por kg/L/un em cêntimos (null sem quantidade ou unidade). g → kg. */
export function perUnit(paid: number, qty: number | null | undefined, unit: Unit | null | undefined): { per: number; base: Base } | null {
  if (!qty || qty <= 0 || !unit) return null;
  if (unit === 'g') return { per: Math.round(paid / (qty / 1000)), base: 'kg' };
  return { per: Math.round(paid / qty), base: unit };
}

export const baseLabel = (b: Base) => (b === 'un' ? '€/un' : b === 'pack' ? '€/pack' : `€/${b}`);

/** Compras com preço pago, por item (chave normalizada), mais antigas primeiro. */
export function purchases(items: Item[], expenses: Expense[]): Record<string, Buy[]> {
  const ex = new Map(expenses.filter((e) => !e.is_deleted).map((e) => [e.id, e]));
  const out: Record<string, Buy[]> = {};
  for (const i of items) {
    if (i.paid_cents == null || i.paid_cents <= 0 || !i.archived_at) continue;
    const u = perUnit(i.paid_cents, i.qty, i.unit); const e = i.expense_id ? ex.get(i.expense_id) : undefined;
    const b: Buy = { key: keyOf(i.name), at: e?.date ?? i.archived_at.slice(0, 10), paid: i.paid_cents, per: u?.per ?? null, base: u?.base ?? null, store: e?.description?.trim() || null };
    (out[b.key] ??= []).push(b);
  }
  for (const k in out) out[k].sort((a, b) => a.at.localeCompare(b.at));
  return out;
}

const mean = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);

/** Média, mín/máx, último (+ loja), último vs média e loja mais barata — na unidade mais usada do item. */
export function stats(buys: Buy[] | undefined): Stats | null {
  if (!buys?.length) return null;
  const last = buys[buys.length - 1];
  const counts: Record<string, number> = {};
  for (const b of buys) if (b.base) counts[b.base] = (counts[b.base] ?? 0) + 1;
  const base = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Base) ?? null;
  const pts = base ? buys.filter((b) => b.base === base && b.per != null) : [];
  const vals = pts.map((b) => b.per as number);
  const avg = vals.length ? mean(vals) : null;
  const lastPer = last.base === base ? last.per : null;
  const byStore: Record<string, number[]> = {};
  for (const b of pts) if (b.store) (byStore[b.store] ??= []).push(b.per as number);
  const stores = Object.entries(byStore).map(([store, v]) => ({ store, avg: mean(v) })).sort((a, b) => a.avg - b.avg);
  return {
    n: buys.length, base, avg, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null,
    last, lastVsAvg: avg && lastPer != null && vals.length >= 2 ? Math.round(((lastPer - avg) / avg) * 100) : null,
    cheapest: stores.length >= 2 ? stores[0] : null, series: vals,
  };
}

/** Valor esperado de um item na lista: média €/unidade × quantidade (mesma base); sem quantidade e base un → 1 un. */
export function expected(s: Stats | null, qty: number | null | undefined, unit: Unit | null | undefined): number | null {
  if (!s?.avg || !s.base) return null;
  if (qty && unit) { const u = perUnit(1, qty, unit); if (!u || u.base !== s.base) return null; return Math.round(s.avg * (unit === 'g' ? qty / 1000 : qty)); }
  return s.base === 'un' ? s.avg : null;
}
