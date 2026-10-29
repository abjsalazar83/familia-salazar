import { describe, it, expect } from 'vitest';
import { matchExpense } from './search';
const e = { description: 'Mercadona', category: 'Supermercado', amount_cents: 8030, date: '2026-10-01' };
describe('matchExpense', () => {
  it('vazio mostra tudo', () => expect(matchExpense(e, ' ')).toBe(true));
  it('valor por prefixo', () => { expect(matchExpense(e, '80')).toBe(true); expect(matchExpense(e, '80,3')).toBe(true); expect(matchExpense(e, '8')).toBe(true); expect(matchExpense(e, '81')).toBe(false); });
  it('texto sem acentos e combinado', () => { expect(matchExpense(e, 'MERCA 80')).toBe(true); expect(matchExpense(e, 'mercado')).toBe(true); expect(matchExpense(e, 'lidl')).toBe(false); });
});
