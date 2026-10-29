import { describe, it, expect } from 'vitest';
import { settlementEffect, payerTone, groupByCategory, paidBy } from './view';
import type { Expense, Member } from './types';
const A = 'a', N = 'n';
const ms = [{ id: A, display_name: 'António' }, { id: N, display_name: 'Ana' }] as Member[];
const x = (o: Partial<Expense>): Expense => ({ id: Math.random() + '', family_id: 'f', amount_cents: 1000, description: 'd', category: 'Supermercado', paid_by: A, type: 'partilhada', split_mode: '50/50', shares: { [A]: 500, [N]: 500 }, date: '2026-10-01', is_deleted: false, created_at: '', ...o });
describe('settlementEffect', () => {
  it('paguei eu: o outro deve-me a parte dele', () => expect(settlementEffect(x({}), A)).toBe(500));
  it('pagou o outro: devo a minha parte', () => expect(settlementEffect(x({ paid_by: N }), A)).toBe(-500));
  it('divisão personalizada', () => { expect(settlementEffect(x({ split_mode: 'personalizada', shares: { [A]: 300, [N]: 700 } }), A)).toBe(700); expect(settlementEffect(x({ paid_by: N, shares: { [A]: 300, [N]: 700 } }), A)).toBe(-300); });
  it('pessoal e retirada = 0', () => { expect(settlementEffect(x({ type: 'pessoal', shares: {} }), A)).toBe(0); expect(settlementEffect(x({ is_deleted: true }), A)).toBe(0); });
  it('perspetiva da Ana é simétrica', () => expect(settlementEffect(x({}), N)).toBe(-500));
});
describe('payerTone', () => {
  it('Ana rosa, António azul', () => { expect(payerTone(ms, N)).toBe('pink'); expect(payerTone(ms, A)).toBe('blue'); });
});
describe('groupByCategory', () => {
  it('agrupa, soma, ignora retiradas e ordena por total', () => {
    const g = groupByCategory([x({}), x({ paid_by: N }), x({ category: 'Casa', amount_cents: 5000, shares: { [A]: 2500, [N]: 2500 } }), x({ is_deleted: true })], A);
    expect(g.map((y) => y.category)).toEqual(['Casa', 'Supermercado']);
    expect(g[1]).toMatchObject({ total: 2000, effect: 0, payers: [A, N] });
    expect(g[1].items.length).toBe(3);
  });
  it('paidBy', () => expect(paidBy([x({}), x({ paid_by: N, amount_cents: 300 }), x({ is_deleted: true })])).toEqual({ [A]: 1000, [N]: 300 }));
});
