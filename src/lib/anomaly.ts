import type { HistoryMonth } from './types';

export type Flag = { what: string; value: number; avg: number; pct: number };
/** Base = últimos n meses fechados antes de `ym`. Assinala quando valor > média +25% ou z > 1,5 (mín. 3 meses). */
export function monthFlags(ms: HistoryMonth[], ym: string, total: number, cats: Record<string, number>, opts: { n?: number; noExtra?: boolean } = {}): Flag[] {
  const n = opts.n ?? 6;
  const base = ms.filter((m) => !m.provisional && m.ym < ym).sort((a, b) => a.ym.localeCompare(b.ym)).slice(-n);
  if (base.length < 3) return [];
  const test = (what: string, v: number, xs: number[]): Flag | null => {
    const avg = xs.reduce((s, x) => s + x, 0) / xs.length;
    if (avg <= 0 || v <= 0) return null;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - avg) ** 2, 0) / xs.length);
    const over = v > avg * 1.25 || (sd > 0 && (v - avg) / sd > 1.5);
    if (!over || v - avg < 2000) return null;
    return { what, value: v, avg: Math.round(avg), pct: Math.round(((v - avg) / avg) * 100) };
  };
  const out: Flag[] = [];
  const t = test('total', total, base.map((m) => Number(m.total_cents) - (opts.noExtra ? Number(m.extra_cents) || 0 : 0)));
  if (t) out.push(t);
  for (const [c, v] of Object.entries(cats)) { const f = test(c, v, base.map((m) => m.cats?.[c] ?? 0)); if (f) out.push(f); }
  return out;
}

/** Totais de um mês a partir das despesas partilhadas; `noExtra` tira as marcadas como extraordinárias. */
export function monthTotals(exps: { category: string; amount_cents: number; date: string; is_deleted: boolean; type?: string; extraordinary?: boolean }[], ym: string, noExtra = false) {
  const cats: Record<string, number> = {}; let total = 0, extra = 0;
  for (const e of exps) {
    if (e.is_deleted || e.type === 'pessoal' || !e.date?.startsWith(ym)) continue;
    if (e.extraordinary) extra += e.amount_cents;
    if (noExtra && e.extraordinary) continue;
    total += e.amount_cents; cats[e.category || 'Outros'] = (cats[e.category || 'Outros'] ?? 0) + e.amount_cents;
  }
  return { total, cats, extra };
}

/** Despesas partilhadas do mês: quantas confirmadas pelo outro membro. */
export function confirmCount(exps: { date: string; is_deleted: boolean; type?: string; confirmed_by?: string | null }[], ym: string) {
  const xs = exps.filter((e) => !e.is_deleted && e.type === 'partilhada' && e.date?.startsWith(ym));
  return { done: xs.filter((e) => e.confirmed_by).length, total: xs.length };
}
