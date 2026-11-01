import { describe, it, expect } from 'vitest';
import { matchExpense } from './search';
const e = { description: 'Mercadona', category: 'Supermercado', amount_cents: 8030, date: '2026-10-01' };
describe('matchExpense', () => {
  it('vazio mostra tudo', () => expect(matchExpense(e, ' ')).toBe(true));
  it('valor por prefixo', () => { expect(matchExpense(e, '80')).toBe(true); expect(matchExpense(e, '80,3')).toBe(true); expect(matchExpense(e, '8')).toBe(true); expect(matchExpense(e, '81')).toBe(false); });
  it('texto sem acentos e combinado', () => { expect(matchExpense(e, 'MERCA 80')).toBe(true); expect(matchExpense(e, 'mercado')).toBe(true); expect(matchExpense(e, 'lidl')).toBe(false); });
});

import { matchIncome, monthIncomes } from './search';
import { describe as d2, it as i2, expect as x2 } from 'vitest';
d2('receitas na lista do mês', () => {
  const I = (o: object) => ({ note: 'Abono', category: 'Abono', amount_cents: 8954, date: '2026-10-05', is_deleted: false, ...o });
  i2('só o mês escolhido, com valor e não retiradas', () => {
    const xs = [I({}), I({ date: '2026-09-05' }), I({ amount_cents: null }), I({ is_deleted: true })];
    x2(monthIncomes(xs, '2026-10')).toHaveLength(1);
  });
  i2('procura encontra receitas por texto e valor', () => {
    x2(matchIncome(I({}), 'abono')).toBe(true); x2(matchIncome(I({}), '89')).toBe(true); x2(matchIncome(I({}), 'receita')).toBe(true); x2(matchIncome(I({}), 'talho')).toBe(false);
  });
});
