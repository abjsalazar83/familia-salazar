import { closed } from './history';
import type { HistoryMonth } from './types';

const pct = (a: number, b: number) => b ? Math.round(((a - b) / b) * 1000) / 10 : null;

/** Últimos 12 meses fechados vs os 12 anteriores (só com 24 meses). */
export function yoy(ms: HistoryMonth[]) {
  const c = closed(ms); if (c.length < 24) return null;
  const cur = c.slice(-12), prev = c.slice(-24, -12);
  const a = cur.reduce((s, m) => s + m.total_cents, 0), b = prev.reduce((s, m) => s + m.total_cents, 0);
  return { to: cur[11].ym, cur: a, prev: b, pct: pct(a, b)! };
}

/** Média dos últimos n meses fechados e delta do valor dado face a ela. */
export function vsAvg(ms: HistoryMonth[], v: number, n: number) {
  const l = closed(ms).slice(-n); if (!l.length) return null;
  const avg = Math.round(l.reduce((s, m) => s + m.total_cents, 0) / l.length);
  return { avg, n: l.length, pct: pct(v, avg) };
}

/** Maiores subidas por categoria: últimos 3 meses vs média dos 12 anteriores. */
export function topIncreases(ms: HistoryMonth[], k = 3) {
  const c = closed(ms); const cur = c.slice(-3), base = c.slice(-15, -3);
  if (!cur.length || !base.length) return [];
  const avg = (xs: HistoryMonth[], cat: string) => xs.reduce((s, m) => s + (m.cats?.[cat] ?? 0), 0) / xs.length;
  const cats = new Set(cur.flatMap((m) => Object.keys(m.cats || {})));
  return [...cats].map((cat) => { const a = avg(cur, cat), b = avg(base, cat); return { cat, now: Math.round(a), before: Math.round(b), diff: Math.round(a - b), pct: pct(a, b) }; })
    .filter((x) => x.diff > 0).sort((x, y) => y.diff - x.diff).slice(0, k);
}

type E = { amount_cents: number; paid_by: string; type: string; date: string; is_deleted: boolean };
/** Mês: partilhadas vs pessoais e quem pagou as partilhadas. */
export function monthSplit(exps: E[], ym: string) {
  let shared = 0, personal = 0; const by: Record<string, number> = {};
  for (const e of exps) { if (e.is_deleted || !e.date?.startsWith(ym)) continue;
    if (e.type === 'pessoal') personal += e.amount_cents; else { shared += e.amount_cents; by[e.paid_by] = (by[e.paid_by] ?? 0) + e.amount_cents; } }
  return { shared, personal, by };
}

/** Arcos de donut (fracções 0..1 acumuladas). */
export function arcs(values: number[]) {
  const t = values.reduce((s, v) => s + v, 0) || 1; let acc = 0;
  return values.map((v) => { const a = { from: acc / t, to: (acc + v) / t }; acc += v; return a; });
}
