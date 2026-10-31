import { describe, it, expect } from 'vitest';
import { calculateHouseholdBalance, splitEqual } from './balance';
import { halvedLists, closeCalc } from './plan';
import { monthSettlement, householdBalance } from './settle';
// Mesmos casos nos dois cálculos antigos e no motor único: o acerto de um mês tem de dar o mesmo em todo o lado.
const A = 'antonio', N = 'ana', M = [A, N], ym = '2026-10';
type E = { amount_cents: number; paid_by: string; type: 'partilhada' | 'pessoal'; shares: Record<string, number> | null; date: string; is_deleted: boolean; split_mode?: string };
const sh = (amt: number, p: string, d = '2026-10-05', shares?: Record<string, number> | null): E => ({ amount_cents: amt, paid_by: p, type: 'partilhada', shares: shares === undefined ? splitEqual(amt, M, p) : shares, date: d, is_deleted: false });
const inc = (amt: number | null, by: string, pct = 50, date = '2026-10-10') => ({ amount_cents: amt, received_by: by, receiver_pct: pct, is_deleted: false, date });
const CASES: [string, E[], ReturnType<typeof inc>[]][] = [
  ['50/50 simples', [sh(10000, A), sh(2000, N)], []],
  ['cêntimo ímpar', [sh(2345, A), sh(2449, A), sh(735, A)], []],
  ['personalizada', [sh(9000, A, '2026-10-05', { [A]: 3000, [N]: 6000 })], []],
  ['pessoal não conta', [sh(5000, A), { ...sh(4000, N), type: 'pessoal', shares: {} }], []],
  ['retirada não conta', [sh(5000, A), { ...sh(4000, N), is_deleted: true }], []],
  ['receita partilhada', [sh(10000, A)], [inc(12000, N)]],
  ['receita 70/30 e por preencher', [sh(10000, N)], [inc(10000, N, 70), inc(null, N)]],
];
const oldBalance = (e: E[], i: ReturnType<typeof inc>[]) => calculateHouseholdBalance(M, e.filter((x) => x.date.startsWith(ym)) as never, [], i.filter((x) => x.date.startsWith(ym)) as never);
describe('paridade dos cálculos antigos (mês isolado, sem acertos)', () => {
  for (const [n, e, i] of CASES) it(n, () => {
    const b = oldBalance(e, i); const c = closeCalc(halvedLists(M, e, ym, i));
    expect(c.diff).toBe(b.debt?.cents ?? 0);
    if (b.debt) expect([c.debtor, c.creditor]).toEqual([b.debt.from, b.debt.to]);
    const u = monthSettlement(M, e, ym, i);
    expect(u.diff).toBe(c.diff); expect(u.debtor).toBe(c.debtor);
    expect(householdBalance(M, e.filter((x) => x.date.startsWith(ym)), [], i.filter((x) => x.date.startsWith(ym))).debt?.cents ?? 0).toBe(c.diff);
  });
});
describe('casos em que os antigos divergiam', () => {
  it('sem shares: o antigo saldo rebentava; o motor divide a meio', () => {
    const e = [sh(1001, A, '2026-10-02', null)];
    expect(calculateHouseholdBalance(M, e as never, []).debt?.cents).toBe(500); // antes rebentava (shares null)
    expect(monthSettlement(M, e, ym).diff).toBe(closeCalc(halvedLists(M, e, ym)).diff);
    expect(householdBalance(M, e, []).debt?.cents).toBe(500);
  });
  it('shares que não somam o total: conta só o que os outros devem (igual nos dois)', () => {
    const e = [sh(10000, A, '2026-10-02', { [A]: 5000, [N]: 4000 })];
    expect(monthSettlement(M, e, ym).diff).toBe(4000);
    expect(householdBalance(M, e, []).debt?.cents).toBe(4000);
  });
  it('acertos confirmados entram no saldo, não nas listas do mês', () => {
    const e = [sh(10000, A)];
    expect(householdBalance(M, e, [{ from_member: N, to_member: A, amount_cents: 5000, confirmed: true }]).debt).toBeNull();
    expect(monthSettlement(M, e, ym).diff).toBe(5000);
  });
});
