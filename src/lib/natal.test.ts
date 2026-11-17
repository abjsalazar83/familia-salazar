import { describe, expect, it } from 'vitest';
import { natalSummary, seasonOf, showNatal, seasonBudget, inWindow } from './natal';
import { CATS } from './types';

const E = (x: Partial<{ category: string; amount_cents: number; date: string; is_deleted: boolean; type: 'pessoal' | 'partilhada'; paid_by: string }>) =>
  ({ category: 'Natal', amount_cents: 1000, date: '2026-12-10', is_deleted: false, type: 'partilhada' as const, paid_by: 'a', ...x });

describe('Natal 🎄', () => {
  it('categoria disponível ao lançar', () => { expect(CATS).toContain('Natal'); });
  it('época: set.–dez. → ano; janeiro → ano anterior; fev.–ago. → nenhuma', () => {
    expect(seasonOf('2026-11-17')).toEqual({ year: 2026, from: '2026-09-01', to: '2027-01-31' });
    expect(seasonOf('2027-01-10')?.year).toBe(2026);
    expect(seasonOf('2027-03-01')).toBeNull();
  });
  it('janela 1/nov–15/jan', () => {
    expect(inWindow('2026-11-01')).toBe(true); expect(inWindow('2027-01-15')).toBe(true);
    expect(inWindow('2027-01-16')).toBe(false); expect(inWindow('2026-10-31')).toBe(false);
  });
  it('total, conjunta vs pessoal, quem pagou; ignora apagadas, outras categorias e outras épocas', () => {
    const s = natalSummary([E({ amount_cents: 4000 }), E({ amount_cents: 2500, type: 'pessoal', paid_by: 'b' }), E({ amount_cents: 1500, paid_by: 'b', date: '2027-01-05' }),
      E({ amount_cents: 999, is_deleted: true }), E({ category: 'Lazer' }), E({ date: '2025-12-20' })], '2026-12-01', null)!;
    expect(s).toMatchObject({ total: 8000, shared: 5500, personal: 2500, count: 3, paid: { a: 4000, b: 4000 }, budget: null, left: null, ratio: null });
  });
  it('orçamento opcional: só conta se definido para esta época', () => {
    const season = seasonOf('2026-12-01')!;
    expect(seasonBudget(null, season)).toBeNull();
    expect(seasonBudget({ natal_budget_cents: 50000, natal_budget_year: 2025 }, season)).toBeNull();
    expect(seasonBudget({ natal_budget_cents: 50000, natal_budget_year: 2026 }, season)).toBe(50000);
    const s = natalSummary([E({ amount_cents: 60000 })], '2026-12-01', 50000)!;
    expect(s.left).toBe(-10000); expect(s.ratio).toBeCloseTo(1.2);
  });
  it('visível de 1/nov a 15/jan, ou fora disso só com despesas Natal na época', () => {
    expect(showNatal(natalSummary([], '2026-11-02', null), '2026-11-02')).toBe(true);
    expect(showNatal(natalSummary([], '2026-10-10', null), '2026-10-10')).toBe(false);
    expect(showNatal(natalSummary([E({ date: '2026-10-05' })], '2026-10-10', null), '2026-10-10')).toBe(true);
    expect(showNatal(natalSummary([E({ date: '2027-01-02' })], '2027-01-20', null), '2027-01-20')).toBe(true);
    expect(showNatal(natalSummary([E({})], '2027-03-01', null), '2027-03-01')).toBe(false);
  });
});

import { parseVoice } from './voice';
describe('voz → Natal', () => {
  it('«prendas de natal 45 euros» sugere Natal', () => { expect(parseVoice('prendas de natal 45 euros').category).toBe('Natal'); });
});
