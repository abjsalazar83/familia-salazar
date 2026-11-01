import { describe, it, expect } from 'vitest';
import { inboxItems } from './inbox';
import type { Expense } from './types';

const E = (o: Partial<Expense>): Expense => ({ id: 'e', family_id: 'f', amount_cents: 1000, description: 'x', category: 'Casa', paid_by: 'B', type: 'partilhada', split_mode: '50/50', shares: {}, date: '2026-10-01', is_deleted: false, created_at: '', ...o });
describe('por rever', () => {
  it('junta extrato, receitas sem valor e ○ do outro; ignora o que é meu, confirmado ou retirado', () => {
    const r = inboxItems({
      review: [E({ id: 'r1', review: 'por_rever' })],
      incomes: [{ id: 'i1', amount_cents: null, is_deleted: false } as never, { id: 'i2', amount_cents: 500, is_deleted: false } as never],
      expenses: [E({ id: 'c1' }), E({ id: 'c2', paid_by: 'A' }), E({ id: 'c3', confirmed_by: 'A' }), E({ id: 'c4', is_deleted: true }), E({ id: 'c5', type: 'pessoal' })],
    }, [], 'A', '2026-10-31');
    expect(r.map((x) => x.kind + ':' + x.id)).toEqual(['extrato:r1', 'receita:i1', 'confirmar:c1']);
  });
  it('fixas por lançar (despesas, incl. 100% do outro) e receitas fixas por preencher entram na mesma lista «por confirmar»', () => {
    const pay = { id: 'p1', name: 'SAD', amount_cents: null, period: 'mensal', next_date: '2026-10-31', kind: 'conjunta', split: 'outro100', owner_member: 'A', category: 'Saúde', is_deleted: false } as never;
    const r = inboxItems({ incomes: [{ id: 'ab', amount_cents: null, is_deleted: false } as never], expenses: [] }, [pay], 'A', '2026-10-31');
    expect(r.map((x) => x.kind)).toEqual(['receita', 'lancar']);
    expect(inboxItems({ expenses: [] }, [], 'A', '2026-10-31')).toHaveLength(0);
  });
});
