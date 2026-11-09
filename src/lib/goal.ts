// Meta de poupança: o mês está a gastar como o habitual (mediana dos meses fechados)? Estimativa: a app só vê despesas partilhadas.
import type { HistoryMonth } from './types';

export const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

export type GoalState = { usual: number | null; months: number; projected: number; spent: number; diff: number | null; status: 'sem-dados' | 'ok' | 'atencao' | 'acima'; goal: number; goalLeft: number | null; midMonth: boolean };

/** `spent` = gasto até hoje; projeção linear até ao fim do mês. Usa os últimos `n` meses fechados (mín. 3). */
export function goalState(ms: HistoryMonth[], ym: string, spent: number, day: number, dim: number, goal = 60000, n = 12): GoalState {
  const base = ms.filter((m) => m && !m.provisional && m.ym < ym).sort((a, b) => a.ym.localeCompare(b.ym)).slice(-n).map((m) => Number(m.total_cents) || 0).filter((v) => v > 0);
  const projected = Math.round((spent / Math.max(1, day)) * dim);
  const usual = base.length >= 3 ? median(base) : null;
  const midMonth = day >= 15;
  if (usual == null) return { usual: null, months: base.length, projected, spent, diff: null, status: 'sem-dados', goal, goalLeft: null, midMonth };
  const diff = projected - usual;
  // No início do mês a projeção é instável: só se assinala «acima» a partir de dia 10.
  const status = diff <= 0 ? 'ok' : day < 10 ? 'atencao' : diff > usual * 0.05 ? 'acima' : 'atencao';
  return { usual, months: base.length, projected, spent, diff, status, goal, goalLeft: goal - Math.max(0, diff), midMonth };
}

/** Aviso a meio do mês (dia ≥ 15) quando a projeção passa o habitual. Chave por mês para mostrar só uma vez por mês, se fechado. */
export const midMonthWarning = (g: GoalState, ym: string) => g.midMonth && g.status === 'acima' ? { key: 'fs-goal-' + ym, over: g.diff! } : null;

type E = { category: string; amount_cents: number; date: string; is_deleted: boolean; type?: string; trip_id?: string | null };
/** Meta para hoje: gasto partilhado do mês corrente (sem viagens) vs a mediana dos meses fechados. */
export function goalForToday(ms: HistoryMonth[], exps: E[], today: string, goal = 60000): GoalState {
  const ym = today.slice(0, 7); const day = Math.max(1, Number(today.slice(8, 10)) || 1);
  const dim = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const spent = exps.reduce((s, e) => s + (e && !e.is_deleted && e.type !== 'pessoal' && !e.trip_id && e.category !== 'Viagem' && e.date?.startsWith(ym) ? Number(e.amount_cents) || 0 : 0), 0);
  return goalState(ms, ym, spent, day, dim, goal);
}
