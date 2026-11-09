// Resumo: mesmo mês do ano passado e inflação do INE (variação homóloga do IPC). Sem dados → null; nunca inventa.
import type { HistoryMonth } from './types';
import { pctChange } from './resumo';

export type Cpi = { source: string; fetched?: string; series: Record<string, number> };
export type CpiPick = { ym: string; pct: number; source: 'ine' | 'manual'; exact: boolean } | null;

export const lastYearYm = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4, 7)}`;

/** Inflação para o mês: o valor do INE desse mês; senão o último publicado (até 3 meses antes); senão o manual; senão null. */
export function cpiFor(ym: string, cpi: Cpi, manual?: { pct: number | null; ym: string | null } | null): CpiPick {
  if (cpi.series[ym] != null) return { ym, pct: cpi.series[ym], source: 'ine', exact: true };
  if (manual?.pct != null && manual.ym === ym) return { ym, pct: Number(manual.pct), source: 'manual', exact: true };
  const before = Object.keys(cpi.series).filter((k) => k < ym).sort().pop();
  if (before && monthsBetween(before, ym) <= 3) return { ym: before, pct: cpi.series[before], source: 'ine', exact: false };
  if (manual?.pct != null && manual.ym && manual.ym <= ym && monthsBetween(manual.ym, ym) <= 3) return { ym: manual.ym, pct: Number(manual.pct), source: 'manual', exact: false };
  return null;
}
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

/** Há meses suficientes? Pelo menos 12 meses fechados e o mesmo mês do ano passado no histórico. */
export function hasYoY(ms: HistoryMonth[], ym: string) {
  const closed = ms.filter((m) => m && !m.provisional);
  return closed.length >= 12 && closed.some((m) => m.ym === lastYearYm(ym) && Number(m.total_cents) > 0);
}

export type YoYRow = { cat: string; now: number; before: number; pct: number | null; real: number | null };
/** Por categoria e total: valor agora vs mesmo mês do ano passado, % nominal e % acima/abaixo da inflação (pontos). */
export function yoy(ms: HistoryMonth[], ym: string, nowCats: Record<string, number>, nowTotal: number, inflPct: number | null) {
  const ly = ms.find((m) => m.ym === lastYearYm(ym) && !m.provisional);
  if (!ly) return null;
  const real = (p: number | null) => (p == null || inflPct == null ? null : Math.round((p - inflPct) * 10) / 10);
  const rows: YoYRow[] = Object.entries(nowCats).filter(([c, v]) => v > 0 && (ly.cats?.[c] ?? 0) > 0)
    .map(([cat, now]) => { const before = ly.cats[cat]; const pct = pctChange(now, before); return { cat, now, before, pct, real: real(pct) }; })
    .sort((a, b) => b.now - a.now);
  const tPct = pctChange(nowTotal, Number(ly.total_cents));
  return { ly: ly.ym, total: { now: nowTotal, before: Number(ly.total_cents), pct: tPct, real: real(tPct) }, rows };
}
