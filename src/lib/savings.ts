// Poupança do mês: receitas, gasto e objetivo. Lógica pura.
export type Income = { id: string; family_id: string; member_id: string; ym: string; amount_cents: number; note: string | null; is_deleted: boolean };
export type Settings = { family_id: string; savings_goal_cents: number; notify_days: number };

export type SavingsState = { income: number; spent: number; projected: number; leftover: number; projectedLeftover: number; goal: number; ratio: number; status: 'ok' | 'risco' | 'sem-dados' };
export function savings(income: number, spent: number, projected: number, goal: number): SavingsState {
  if (!income) return { income, spent, projected, leftover: 0, projectedLeftover: 0, goal, ratio: 0, status: 'sem-dados' };
  const leftover = income - spent, projectedLeftover = income - projected;
  return { income, spent, projected, leftover, projectedLeftover, goal, ratio: goal > 0 ? Math.max(0, projectedLeftover) / goal : 1, status: projectedLeftover >= goal ? 'ok' : 'risco' };
}

