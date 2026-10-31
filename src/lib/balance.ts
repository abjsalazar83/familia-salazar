import type { SharedIncome } from './income';
import { householdBalance } from './settle';
// Regras financeiras centrais. Todos os valores em cêntimos (inteiros).
export type ExpenseLike = {
  amount_cents: number;
  paid_by: string;
  type: 'pessoal' | 'partilhada';
  shares: Record<string, number>;
  is_deleted?: boolean;
};
export type SettlementLike = {
  from_member: string;
  to_member: string;
  amount_cents: number;
  confirmed: boolean;
  is_deleted?: boolean;
};
export type Balance = {
  /** Por membro: positivo = tem a receber; negativo = deve. Soma sempre 0. */
  net: Record<string, number>;
  /** Para 2 pessoas: quem deve, a quem e quanto. null se estão quites. */
  debt: { from: string; to: string; cents: number } | null;
};

/** Divide em partes iguais; os cêntimos que sobram ficam para quem pagou. */
export function splitEqual(amountCents: number, memberIds: string[], payer: string): Record<string, number> {
  const n = memberIds.length;
  const base = Math.floor(amountCents / n);
  const out: Record<string, number> = {};
  for (const m of memberIds) out[m] = base;
  out[payer] = (out[payer] ?? 0) + (amountCents - base * n);
  return out;
}

/** Saldo acumulado. Delegado no motor único (lib/settle.ts). */
export function calculateHouseholdBalance(
  memberIds: string[],
  expenses: ExpenseLike[],
  settlements: SettlementLike[],
  incomes: Pick<SharedIncome, 'amount_cents' | 'received_by' | 'receiver_pct' | 'is_deleted'>[] = [],
): Balance {
  return householdBalance(memberIds, expenses, settlements, incomes);
}
