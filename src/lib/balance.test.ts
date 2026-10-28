import { describe, it, expect } from 'vitest';
import { calculateHouseholdBalance, splitEqual, type ExpenseLike } from './balance';
import { parseCents, eur } from './money';

const A = 'antonio', N = 'ana', M = [A, N];
const shared = (amount: number, payer: string, shares?: Record<string, number>): ExpenseLike =>
  ({ amount_cents: amount, paid_by: payer, type: 'partilhada', shares: shares ?? splitEqual(amount, M, payer) });

describe('calculateHouseholdBalance', () => {
  it('exemplo do prompt: 100 € António, 20 € Ana → Ana deve 40 €', () => {
    const b = calculateHouseholdBalance(M, [shared(10000, A), shared(2000, N)], []);
    expect(b.debt).toEqual({ from: N, to: A, cents: 4000 });
    expect(b.net[A] + b.net[N]).toBe(0);
  });
  it('despesas pessoais não mexem no saldo', () => {
    const b = calculateHouseholdBalance(M, [{ amount_cents: 5000, paid_by: A, type: 'pessoal', shares: {} }], []);
    expect(b.debt).toBeNull();
  });
  it('divisão personalizada', () => {
    const b = calculateHouseholdBalance(M, [shared(9000, A, { [A]: 3000, [N]: 6000 })], []);
    expect(b.debt).toEqual({ from: N, to: A, cents: 6000 });
  });
  it('liquidação só conta depois de confirmada', () => {
    const e = [shared(10000, A), shared(2000, N)];
    const s = { from_member: N, to_member: A, amount_cents: 4000, confirmed: false };
    expect(calculateHouseholdBalance(M, e, [s]).debt?.cents).toBe(4000);
    expect(calculateHouseholdBalance(M, e, [{ ...s, confirmed: true }]).debt).toBeNull();
  });
  it('liquidação parcial e a mais inverte o sentido', () => {
    const e = [shared(10000, A)];
    expect(calculateHouseholdBalance(M, e, [{ from_member: N, to_member: A, amount_cents: 2000, confirmed: true }]).debt)
      .toEqual({ from: N, to: A, cents: 3000 });
    expect(calculateHouseholdBalance(M, e, [{ from_member: N, to_member: A, amount_cents: 7000, confirmed: true }]).debt)
      .toEqual({ from: A, to: N, cents: 2000 });
  });
  it('despesas apagadas (soft-delete) ficam de fora', () => {
    const b = calculateHouseholdBalance(M, [{ ...shared(10000, A), is_deleted: true }], []);
    expect(b.debt).toBeNull();
  });
  it('cêntimos ímpares sem erros de arredondamento', () => {
    const many = Array.from({ length: 1000 }, (_, i) => shared(1 + (i % 7) * 333, i % 2 ? A : N));
    const b = calculateHouseholdBalance(M, many, []);
    expect(b.net[A] + b.net[N]).toBe(0);
    expect(Number.isInteger(b.net[A])).toBe(true);
    expect(splitEqual(101, M, A)).toEqual({ [A]: 51, [N]: 50 });
  });
});

describe('money', () => {
  it('parseCents', () => {
    expect(parseCents('12,34')).toBe(1234);
    expect(parseCents('0,1')).toBe(10);
    expect(parseCents('1 234,59')).toBe(123459);
    expect(parseCents('1.234,56')).toBe(123456);
    expect(parseCents('455.85')).toBe(45585);
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('-5')).toBeNull();
  });
  it('eur', () => { expect(eur(45585)).toMatch(/455,85\s€/); });
});
