// Vista da lista de despesas: efeito no acerto, cor por pagador, grupos por categoria.
import type { Expense, Member } from './types';

/** Efeito no acerto do ponto de vista de `me` (cêntimos): + o outro deve-me, − eu devo, 0 pessoal. */
export function settlementEffect(e: Pick<Expense, 'amount_cents' | 'paid_by' | 'type' | 'shares' | 'is_deleted'>, me: string): number {
  if (e.is_deleted || e.type !== 'partilhada') return 0;
  const mine = e.shares[me] ?? 0;
  return e.paid_by === me ? e.amount_cents - mine : -mine;
}

/** Ana = rosa; António (e qualquer outro) = azul. */
export function payerTone(ms: Member[], id: string): 'pink' | 'blue' {
  const n = (ms.find((m) => m.id === id)?.display_name ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return /^ana\b/.test(n) ? 'pink' : 'blue';
}

export type Group = { category: string; items: Expense[]; total: number; effect: number; payers: string[] };
/** Agrupa por categoria (ordem: maior total primeiro). Retiradas não contam no total. */
export function groupByCategory(list: Expense[], me: string): Group[] {
  const m = new Map<string, Group>();
  for (const e of list) {
    const g = m.get(e.category) ?? { category: e.category, items: [], total: 0, effect: 0, payers: [] };
    g.items.push(e);
    if (!e.is_deleted) { g.total += e.amount_cents; g.effect += settlementEffect(e, me); }
    if (!g.payers.includes(e.paid_by)) g.payers.push(e.paid_by);
    m.set(e.category, g);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

/** Total pago por cada membro (despesas não retiradas). */
export function paidBy(list: Expense[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const e of list) if (!e.is_deleted) o[e.paid_by] = (o[e.paid_by] ?? 0) + e.amount_cents;
  return o;
}
