import { describe, it, expect } from 'vitest';
import { perUnit, purchases, stats, expected } from './prices';
import { keyOf } from './shop';
const it0 = (name: string, paid: number | null, qty: number | null, unit: any, at: string, exp?: string) => ({ id: name + at, family_id: 'f', name, quantity: null, note: null, bought: true, created_at: at, qty, unit, paid_cents: paid, archived_at: at + 'T10:00:00Z', expense_id: exp ?? null }) as any;
const ex = (id: string, store: string, date: string) => ({ id, description: store, date, is_deleted: false }) as any;
describe('preços', () => {
  it('perUnit', () => {
    expect(perUnit(300, 500, 'g')).toEqual({ per: 600, base: 'kg' });
    expect(perUnit(258, 2, 'L')).toEqual({ per: 129, base: 'L' });
    expect(perUnit(300, null, 'kg')).toBeNull(); expect(perUnit(300, 1, null)).toBeNull();
  });
  it('sem dados → null (não inventa)', () => {
    expect(stats(undefined)).toBeNull();
    const p = purchases([it0('Leite', null, 1, 'L', '2026-10-01')], []);
    expect(p).toEqual({});
  });
  it('média, mín/máx, último vs média e loja mais barata', () => {
    const items = [it0('Bananas', 120, 1, 'kg', '2026-09-01', 'a'), it0('bananas', 150, 1000, 'g', '2026-09-15', 'b'), it0('Bananas', 180, 1, 'kg', '2026-10-01', 'c')];
    const s = stats(purchases(items, [ex('a', 'Lidl', '2026-09-01'), ex('b', 'Continente', '2026-09-15'), ex('c', 'Continente', '2026-10-01')])[keyOf('Bananas')])!;
    expect(s).toMatchObject({ n: 3, base: 'kg', avg: 150, min: 120, max: 180, lastVsAvg: 20 });
    expect(s.last.store).toBe('Continente'); expect(s.cheapest).toEqual({ store: 'Lidl', avg: 120 });
    expect(expected(s, 500, 'g')).toBe(75); expect(expected(s, 2, 'L')).toBeNull(); expect(expected(s, null, null)).toBeNull();
  });
  it('sem quantidade: guarda o pago mas sem €/kg', () => {
    const p = purchases([it0('Pão', 95, null, null, '2026-10-01')], []); const s = stats(Object.values(p)[0])!;
    expect(s.avg).toBeNull(); expect(s.last.paid).toBe(95); expect(s.lastVsAvg).toBeNull();
  });
});
