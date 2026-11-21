import type { Expense } from './types';
import type { SharedIncome } from './income';

/** Tudo o que espera por uma decisão, num só sítio. Nada aqui conta no saldo até ser decidido (exceto ○, que já conta).
 *  fs-v44: as fixas por lançar saíram daqui → lembrete próprio «Faltam lançar» (nada é lançado sozinho). */
export type InboxItem =
  | { kind: 'extrato'; id: string; e: Expense }
  | { kind: 'receita'; id: string; i: SharedIncome }
  | { kind: 'confirmar'; id: string; e: Expense };

export function inboxItems(d: { review?: Expense[]; incomes?: SharedIncome[]; expenses: Expense[] }, me: string): InboxItem[] {
  const ex: InboxItem[] = (d.review ?? []).filter((e) => !e.is_deleted).map((e) => ({ kind: 'extrato', id: e.id, e }));
  const inc: InboxItem[] = (d.incomes ?? []).filter((i) => !i.is_deleted && i.amount_cents == null).map((i) => ({ kind: 'receita', id: i.id, i }));
  const cf: InboxItem[] = d.expenses.filter((e) => !e.is_deleted && e.type === 'partilhada' && !e.confirmed_by && e.paid_by !== me).map((e) => ({ kind: 'confirmar', id: e.id, e }));
  return [...ex, ...inc, ...cf];
}
