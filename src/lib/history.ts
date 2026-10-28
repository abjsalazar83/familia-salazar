import type { HistoryMonth } from './types';

/** Meses fechados (não provisórios), do mais antigo ao mais recente. */
export const closed = (ms: HistoryMonth[]) => ms.filter((m) => !m.provisional).sort((a, b) => a.ym.localeCompare(b.ym));

/** Médias mensais dos últimos n meses fechados. */
export function averages(ms: HistoryMonth[], n = 12) {
  const last = closed(ms).slice(-n);
  if (!last.length) return null;
  const k = last.length;
  const total = last.reduce((s, m) => s + m.total_cents, 0);
  const extra = last.reduce((s, m) => s + m.extra_cents, 0);
  const cats: Record<string, number> = {};
  for (const m of last) for (const [c, v] of Object.entries(m.cats || {})) cats[c] = (cats[c] ?? 0) + v;
  const byCat = Object.entries(cats).map(([c, v]) => [c, Math.round(v / k)] as [string, number]).sort((a, b) => b[1] - a[1]);
  return { months: k, from: last[0].ym, to: last[k - 1].ym, total: Math.round(total / k), noExtra: Math.round((total - extra) / k), byCat };
}

/** Média mensal por ano (meses fechados). */
export function yearly(ms: HistoryMonth[]) {
  const y: Record<string, { s: number; n: number }> = {};
  for (const m of closed(ms)) { const k = m.ym.slice(0, 4); (y[k] ??= { s: 0, n: 0 }); y[k].s += m.total_cents; y[k].n++; }
  return Object.entries(y).map(([year, v]) => ({ year, avg: Math.round(v.s / v.n), n: v.n }));
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const ymLabel = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

/** Custo mensal equivalente de uma conta recorrente. */
export function monthly(cents: number | null, period: string) {
  if (cents == null) return null;
  const d = { mensal: 1, bimestral: 2, trimestral: 3, anual: 12 }[period as 'mensal'] ?? 1;
  return Math.round(cents / d);
}
