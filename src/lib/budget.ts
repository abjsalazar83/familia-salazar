import type { Budget, Expense } from './types';
type Exp = Pick<Expense, 'amount_cents' | 'category' | 'paid_by' | 'type' | 'date' | 'is_deleted'> & { id?: string };
export type Level = 'ok' | 'warn' | 'over';
export type Usage = { budget: Budget; spent: number; ratio: number; level: Level };

/** Um limite da casa conta despesas partilhadas; um limite pessoal conta as despesas pessoais dessa pessoa. '*' = todas as categorias. */
export const counts = (b: Budget, e: Exp, ym: string) =>
  !e.is_deleted && e.date.startsWith(ym) && (b.category === '*' || e.category === b.category) &&
  (b.member_id == null ? e.type === 'partilhada' : e.type === 'pessoal' && e.paid_by === b.member_id);

export const level = (r: number): Level => (r >= 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok');

export function usage(budgets: Budget[], exps: Exp[], ym: string): Usage[] {
  return budgets.filter((b) => !b.is_deleted && b.limit_cents > 0).map((b) => {
    const spent = exps.filter((e) => counts(b, e, ym)).reduce((s, e) => s + e.amount_cents, 0);
    const ratio = spent / b.limit_cents;
    return { budget: b, spent, ratio, level: level(ratio) };
  });
}

/** Limites cujo nível piora ao gravar `next` (nova ou editada; `prevId` = id editado). */
export function crossings(budgets: Budget[], exps: Exp[], next: Exp, prevId?: string): Usage[] {
  const ym = next.date.slice(0, 7);
  const rest = exps.filter((e) => e.id == null || e.id !== prevId);
  const before = usage(budgets, exps, ym);
  const after = usage(budgets, [...rest, next], ym);
  const rank = { ok: 0, warn: 1, over: 2 };
  return after.filter((a) => { const b = before.find((x) => x.budget.id === a.budget.id)!; return rank[a.level] > rank[b.level] || (a.level === 'over' && a.spent > b.spent && counts(a.budget, next, ym)); });
}
