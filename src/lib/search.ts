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
