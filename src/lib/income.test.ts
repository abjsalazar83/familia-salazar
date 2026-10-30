import { describe, expect, it } from 'vitest';
import { calculateHouseholdBalance } from './balance';
import { halvedLists, closeCalc } from './plan';
import { dueIncomeEntries, incomeEffect, incomeMonth, otherShare, type IncomeRule, type SharedIncome } from './income';

const A = 'antonio', N = 'ana';
const inc = (o: Partial<SharedIncome>): SharedIncome => ({ id: 'i', family_id: 'f', amount_cents: 10000, received_by: N, category: 'Abono', date: '2026-10-05', note: null, receiver_pct: 50, rule_id: null, ym: null, confirmed_by: null, confirmed_at: null, is_deleted: false, created_at: '', ...o });

describe('receita partilhada', () => {
  it('quem recebe deve metade ao outro', () => {
    const b = calculateHouseholdBalance([A, N], [], [], [inc({})]);
    expect(b.debt).toEqual({ from: N, to: A, cents: 5000 });
    expect(b.net[A] + b.net[N]).toBe(0);
  });
  it('cêntimo ímpar fica com quem recebe; divisão configurável', () => {
    expect(otherShare(inc({ amount_cents: 10001 }))).toBe(5000);
    expect(otherShare(inc({ receiver_pct: 70 }))).toBe(3000);
    expect(otherShare(inc({ receiver_pct: 100 }))).toBe(0);
  });
  it('sem valor (fixa por preencher) ou retirada não conta', () => {
    const b = calculateHouseholdBalance([A, N], [], [], [inc({ amount_cents: null }), inc({ is_deleted: true })]);
    expect(b.debt).toBeNull();
  });
  it('efeito do ponto de vista de cada um', () => {
    expect(incomeEffect(inc({}), A)).toBe(5000);
    expect(incomeEffect(inc({}), N)).toBe(-5000);
  });
  it('mistura com despesas e acerto já feito (conta uma vez)', () => {
    const exp = [{ amount_cents: 20000, paid_by: N, type: 'partilhada' as const, shares: { [A]: 10000, [N]: 10000 } }];
    // Ana pagou 200 → António deve 100; Ana recebeu abono 120 → Ana deve 60. Líquido: António deve 40.
    let b = calculateHouseholdBalance([A, N], exp, [], [inc({ amount_cents: 12000 })]);
    expect(b.debt).toEqual({ from: A, to: N, cents: 4000 });
    const s = { from_member: A, to_member: N, amount_cents: 4000, confirmed: true };
    b = calculateHouseholdBalance([A, N], exp, [s], [inc({ amount_cents: 12000 })]);
    expect(b.debt).toBeNull();
    // acerto por confirmar ou retirado não desconta
    expect(calculateHouseholdBalance([A, N], exp, [{ ...s, confirmed: false }], [inc({ amount_cents: 12000 })]).debt?.cents).toBe(4000);
    expect(calculateHouseholdBalance([A, N], exp, [{ ...s, is_deleted: true }], [inc({ amount_cents: 12000 })]).debt?.cents).toBe(4000);
  });
  it('fecho de mês inclui a receita na lista de quem tem a receber', () => {
    const exp = [{ paid_by: A, amount_cents: 30000, shares: { [A]: 15000, [N]: 15000 }, date: '2026-10-02', is_deleted: false, type: 'partilhada' }];
    const l = halvedLists([A, N], exp, '2026-10', [inc({ amount_cents: 12000 }), inc({ amount_cents: 9999, date: '2026-09-30' })]);
    expect(l).toEqual({ [A]: 21000, [N]: 0 });
    expect(closeCalc(l).diff).toBe(21000);
  });
  it('receita fixa cria uma entrada por mês, sem valor, e não repete', () => {
    const r: IncomeRule = { id: 'r1', family_id: 'f', name: 'Abono', category: 'Abono', received_by: N, receiver_pct: 50, day: 31, active: true, is_deleted: false, created_at: '' };
    const d = dueIncomeEntries([r, { ...r, id: 'r2', active: false }], [], '2026-11');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ amount_cents: null, date: '2026-11-30', rule_id: 'r1', ym: '2026-11' });
    expect(dueIncomeEntries([r], [{ rule_id: 'r1', ym: '2026-11' }], '2026-11')).toHaveLength(0);
  });
  it('resumo do mês', () => {
    expect(incomeMonth([inc({}), inc({ amount_cents: null }), inc({ date: '2026-09-01' })], '2026-10')).toEqual({ total: 10000, owed: 5000, pending: 1 });
  });
});
