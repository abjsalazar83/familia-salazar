import { describe, expect, it } from 'vitest';
import { crossings, usage } from './budget';
import type { Budget } from './types';
const b = (id: string, category: string, member_id: string | null, limit_cents: number): Budget => ({ id, family_id: 'f', category, member_id, limit_cents, is_deleted: false, created_at: '' });
const e = (amount_cents: number, category: string, type: 'pessoal' | 'partilhada', paid_by = 'A', date = '2026-10-05', id?: string) => ({ id, amount_cents, category, type, paid_by, date, is_deleted: false });
const B = [b('1', 'Lazer', null, 10000), b('2', '*', 'A', 5000), b('3', 'Casa', null, 1000)];
describe('limites', () => {
  const ex = [e(7000, 'Lazer', 'partilhada'), e(4500, 'Saúde', 'pessoal'), e(9999, 'Lazer', 'pessoal', 'B'), e(5000, 'Lazer', 'partilhada', 'A', '2026-09-01')];
  it('conta só o que pertence ao limite e ao mês', () => {
    const u = usage(B, ex, '2026-10');
    expect(u.map((x) => [x.spent, x.level])).toEqual([[7000, 'ok'], [4500, 'warn'], [0, 'ok']]);
  });
  it('ignora limites apagados e despesas apagadas', () => {
    expect(usage([{ ...B[0], is_deleted: true }], ex, '2026-10')).toEqual([]);
    expect(usage(B, [{ ...ex[0], is_deleted: true }], '2026-10')[0].spent).toBe(0);
  });
  it('avisa ao cruzar 80% e 100%', () => {
    expect(crossings(B, ex, e(1500, 'Lazer', 'partilhada')).map((x) => x.budget.id)).toEqual(['1']);
    expect(crossings(B, ex, e(600, 'Outros', 'pessoal')).map((x) => [x.budget.id, x.level])).toEqual([['2', 'over']]);
    expect(crossings(B, ex, e(100, 'Lazer', 'partilhada'))).toEqual([]);
  });
  it('edição não conta a despesa duas vezes', () => {
    const ex2 = [e(7000, 'Lazer', 'partilhada', 'A', '2026-10-05', 'x')];
    expect(crossings(B, ex2, e(7500, 'Lazer', 'partilhada', 'A', '2026-10-05', 'x'), 'x')).toEqual([]);
    expect(crossings(B, ex2, e(8500, 'Lazer', 'partilhada', 'A', '2026-10-05', 'x'), 'x').length).toBe(1);
    expect(crossings(B, [e(9000, 'Lazer', 'partilhada', 'A', '2026-10-05', 'x')], e(9100, 'Lazer', 'partilhada', 'A', '2026-10-05', 'x'), 'x')).toEqual([]);
  });
});
