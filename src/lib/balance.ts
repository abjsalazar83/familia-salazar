import { applyIncomes, type SharedIncome } from './income';
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

export function calculateHouseholdBalance(
  memberIds: string[],
  expenses: ExpenseLike[],
  settlements: SettlementLike[],
  incomes: Pick<SharedIncome, 'amount_cents' | 'received_by' | 'receiver_pct' | 'is_deleted'>[] = [],
): Balance {
  const net: Record<string, number> = {};
  for (const m of memberIds) net[m] = 0;
  const add = (m: string, v: number) => { net[m] = (net[m] ?? 0) + v; };
  for (const e of expenses) {
    if (e.is_deleted || e.type !== 'partilhada') continue;
    add(e.paid_by, e.amount_cents);
    for (const [m, c] of Object.entries(e.shares)) add(m, -c);
  }
  for (const s of settlements) {
    if (s.is_deleted || !s.confirmed) continue;
    add(s.from_member, s.amount_cents);
    add(s.to_member, -s.amount_cents);
  }
  applyIncomes(net, incomes);
  let debt: Balance['debt'] = null;
  const ids = Object.keys(net);
  if (ids.length === 2) {
    const [a, b] = ids;
    if (net[a] > 0) debt = { from: b, to: a, cents: net[a] };
    else if (net[a] < 0) debt = { from: a, to: b, cents: -net[a] };
  }
  return { net, debt };
}
