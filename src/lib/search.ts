// Procura na lista de despesas: texto (descrição/categoria, sem acentos) e valor ("80" encontra 80,30 €).
import { centsToInput } from './money';
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function matchExpense(e: { description: string; category: string; amount_cents: number; date: string }, q: string): boolean {
  const t = norm(q.trim()); if (!t) return true;
  const euros = centsToInput(e.amount_cents);
  return t.split(/\s+/).every((w) => {
    if (/^\d+([.,]\d{0,2})?$/.test(w)) return euros.startsWith(w.replace('.', ','));
    return norm(e.description).includes(w) || norm(e.category).includes(w) || e.date.includes(w);
  });
}
/** Receitas partilhadas na mesma procura: nota/categoria como descrição. */
export function matchIncome(i: { note: string | null; category: string; amount_cents: number | null; date: string }, q: string): boolean {
  return matchExpense({ description: (i.note ?? '') + ' receita', category: i.category, amount_cents: i.amount_cents ?? 0, date: i.date }, q);
}
/** Receitas com valor do mês ym (as por preencher ficam no aviso «por confirmar»). */
export function monthIncomes<T extends { is_deleted: boolean; amount_cents: number | null; date: string }>(xs: T[], ym: string): T[] {
  return xs.filter((i) => !i.is_deleted && i.amount_cents != null && i.date.startsWith(ym));
}
