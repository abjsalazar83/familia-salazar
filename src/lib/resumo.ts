// Resumo simples: barras dos últimos meses e categorias ordenadas com a variação face ao mês anterior.
import type { HistoryMonth } from './types';

export type CatRow = { cat: string; v: number; prev: number | null; pct: number | null };

/** Variação inteira em % (null quando não há base para comparar). */
export const pctChange = (now: number, before: number | null | undefined): number | null =>
  before == null || before <= 0 ? null : Math.round(((now - before) / before) * 100);

/** Categorias do mês, por valor (maior primeiro), com o valor e a variação do mês anterior. */
export function catRows(cur: Record<string, number>, prev?: Record<string, number> | null): CatRow[] {
  return Object.entries(cur).filter(([, v]) => v > 0)
    .map(([cat, v]) => { const p = prev ? prev[cat] ?? 0 : null; return { cat, v, prev: p, pct: pctChange(v, p) }; })
    .sort((a, b) => b.v - a.v || a.cat.localeCompare(b.cat, 'pt'));
}

/** Mês anterior em AAAA-MM. */
export function prevYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export type MonthBar = { ym: string; v: number; current: boolean; provisional: boolean };

/** Últimos n meses para o gráfico: os n−1 anteriores do histórico + o mês corrente (gasto até hoje). */
export function monthBars(ms: HistoryMonth[], curYm: string, curTotal: number, n = 6): MonthBar[] {
  const past = ms.filter((m) => m.ym < curYm).sort((a, b) => a.ym.localeCompare(b.ym)).slice(-(n - 1))
    .map((m) => ({ ym: m.ym, v: Number(m.total_cents) || 0, current: false, provisional: !!m.provisional }));
  return [...past, { ym: curYm, v: curTotal, current: true, provisional: true }];
}
