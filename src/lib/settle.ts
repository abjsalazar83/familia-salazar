// Motor único do acerto. Cêntimos inteiros, sem rede. Usado pelo cartão de saldo, pelo «Saldar mês» e pelo histórico.
import { otherShare } from './income';
export type SettleExpense = { amount_cents: number; paid_by: string; type?: string; shares: Record<string, number> | null; is_deleted?: boolean; date?: string };
export type SettleIncome = { amount_cents: number | null; received_by: string; receiver_pct: number; is_deleted: boolean; date?: string };
export type SettleTransfer = { from_member: string; to_member: string; amount_cents: number; confirmed: boolean; is_deleted?: boolean };
export type Debt = { from: string; to: string; cents: number } | null;

/** Quanto cada um dos outros deve a quem pagou. Sem shares → metade (cêntimo ímpar fica com quem pagou). */
export function owedToPayer(e: SettleExpense, members: string[]): Record<string, number> {
  if (!e || e.is_deleted || e.type === 'pessoal') return {};
  const out: Record<string, number> = {};
  if (e.shares && Object.keys(e.shares).length) { for (const [m, c] of Object.entries(e.shares)) if (m !== e.paid_by) out[m] = Number(c) || 0; return out; }
  const others = members.filter((m) => m !== e.paid_by); if (!others.length) return out;
  const each = Math.floor((Number(e.amount_cents) || 0) / members.length);
  for (const m of others) out[m] = each;
  return out;
}

/** Saldo líquido por membro (positivo = tem a receber). Soma 0. */
export function netOf(members: string[], exps: SettleExpense[], transfers: SettleTransfer[] = [], incomes: SettleIncome[] = []) {
  const net: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  const add = (m: string, v: number) => { net[m] = (net[m] ?? 0) + v; };
  for (const e of exps) for (const [m, c] of Object.entries(owedToPayer(e, members))) { add(e.paid_by, c); add(m, -c); }
  for (const s of transfers) { if (s.is_deleted || !s.confirmed) continue; add(s.from_member, s.amount_cents); add(s.to_member, -s.amount_cents); }
  if (members.length === 2) for (const i of incomes) {
    const s = otherShare(i as never); if (!s || !members.includes(i.received_by)) continue;
    const o = members.find((m) => m !== i.received_by)!; add(i.received_by, -s); add(o, s);
  }
  return net;
}
export function debtOf(net: Record<string, number>): Debt {
  const ids = Object.keys(net); if (ids.length !== 2) return null;
  const [a, b] = ids; return net[a] > 0 ? { from: b, to: a, cents: net[a] } : net[a] < 0 ? { from: a, to: b, cents: -net[a] } : null;
}
/** Saldo acumulado (todas as despesas + acertos confirmados + receitas partilhadas). */
export function householdBalance(members: string[], exps: SettleExpense[], transfers: SettleTransfer[] = [], incomes: SettleIncome[] = []) {
  const net = netOf(members, exps, transfers, incomes); return { net, debt: debtOf(net) };
}
/** Listas do mês (já a metade): o que cada um tem a receber do outro nesse mês. Mesmo motor que o saldo. */
export function monthLists(members: string[], exps: SettleExpense[], ym: string, incomes: SettleIncome[] = []) {
  const out: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  const inM = (d?: string) => typeof d === 'string' && d.startsWith(ym);
  for (const e of exps) { if (!inM(e?.date) || !(e.paid_by in out)) continue; for (const c of Object.values(owedToPayer(e, members))) out[e.paid_by] += c; }
  if (members.length === 2) for (const i of incomes) { if (!inM(i?.date) || !(i.received_by in out)) continue; out[members.find((m) => m !== i.received_by)!] += otherShare(i as never); }
  return out;
}
export const MBWAY_MAX = 75000;
export type CloseCalc = { creditor: string | null; debtor: string | null; diff: number; paid: number; carry: number };
export function closeOf(lists: Record<string, number>): CloseCalc {
  const ids = Object.keys(lists); if (ids.length < 2) return { creditor: null, debtor: null, diff: 0, paid: 0, carry: 0 };
  const [a, b] = ids; const d = lists[a] - lists[b];
  if (d === 0) return { creditor: null, debtor: null, diff: 0, paid: 0, carry: 0 };
  const diff = Math.abs(d); const paid = Math.min(diff, MBWAY_MAX);
  return { creditor: d > 0 ? a : b, debtor: d > 0 ? b : a, diff, paid, carry: diff - paid };
}
export const monthSettlement = (members: string[], exps: SettleExpense[], ym: string, incomes: SettleIncome[] = []) => closeOf(monthLists(members, exps, ym, incomes));
