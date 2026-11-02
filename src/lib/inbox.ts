import type { Expense } from './types';
import type { SharedIncome } from './income';
import { autoPost, porLancar, type Payment } from './plan';

/** Tudo o que espera por uma decisão, num só sítio. Nada aqui conta no saldo até ser decidido (exceto ○, que já conta). */
export type InboxItem =
  | { kind: 'extrato'; id: string; e: Expense }
  | { kind: 'receita'; id: string; i: SharedIncome }
  | { kind: 'lancar'; id: string; p: Payment; date: string; amount: number | null; hint?: number | null }
  | { kind: 'confirmar'; id: string; e: Expense };

export function inboxItems(d: { review?: Expense[]; incomes?: SharedIncome[]; expenses: Expense[] }, payments: Payment[], me: string, today: string): InboxItem[] {
  const ex: InboxItem[] = (d.review ?? []).filter((e) => !e.is_deleted).map((e) => ({ kind: 'extrato', id: e.id, e }));
  const inc: InboxItem[] = (d.incomes ?? []).filter((i) => !i.is_deleted && i.amount_cents == null).map((i) => ({ kind: 'receita', id: i.id, i }));
  const pl: InboxItem[] = porLancar(payments, d.expenses as never, today)
    // fixos certos com dono: lança-os o dispositivo de quem paga (useAutoPost); aqui só os variáveis ou sem dono/valor
    .filter((x) => !(autoPost(x, x.p.owner_member ?? '') && x.p.owner_member))
    .map((x) => ({ kind: 'lancar', id: x.p.id + '|' + x.date, p: x.p, date: x.date, amount: x.amount, hint: x.hint }));
  const cf: InboxItem[] = d.expenses.filter((e) => !e.is_deleted && e.type === 'partilhada' && !e.confirmed_by && e.paid_by !== me).map((e) => ({ kind: 'confirmar', id: e.id, e }));
  return [...ex, ...inc, ...pl, ...cf];
}
