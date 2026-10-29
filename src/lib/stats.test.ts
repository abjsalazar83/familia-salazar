import { describe, it, expect } from 'vitest';
import { yoy, vsAvg, topIncreases, monthSplit, arcs } from './stats';
import { realChange, inflationFor, CPI_ANNUAL } from './inflation';
const m = (i: number, t: number, cats: Record<string, number> = {}) => ({ id: String(i), ym: `${2024 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`, total_cents: t, extra_cents: 0, cats, provisional: false, note: null });
describe('stats', () => {
  it('yoy needs 24 months', () => {
    expect(yoy(Array.from({ length: 12 }, (_, i) => m(i, 100)))).toBeNull();
    const r = yoy(Array.from({ length: 24 }, (_, i) => m(i, i < 12 ? 100 : 110)))!;
    expect(r.pct).toBe(10);
  });
  it('vsAvg', () => { expect(vsAvg([m(0, 100), m(1, 300)], 300, 6)).toEqual({ avg: 200, n: 2, pct: 50 }); });
  it('topIncreases', () => {
    const ms = Array.from({ length: 15 }, (_, i) => m(i, 0, { A: i >= 12 ? 200 : 100, B: 50 }));
    expect(topIncreases(ms).map((x) => [x.cat, x.diff])).toEqual([['A', 100]]);
  });
  it('monthSplit', () => {
    const r = monthSplit([{ amount_cents: 10, paid_by: 'a', type: 'partilhada', date: '2026-10-01', is_deleted: false }, { amount_cents: 5, paid_by: 'a', type: 'pessoal', date: '2026-10-02', is_deleted: false }, { amount_cents: 9, paid_by: 'b', type: 'partilhada', date: '2026-09-01', is_deleted: false }], '2026-10');
    expect(r).toEqual({ shared: 10, personal: 5, by: { a: 10 } });
  });
  it('arcs', () => { expect(arcs([1, 3])).toEqual([{ from: 0, to: .25 }, { from: .25, to: 1 }]); });
  it('inflation', () => {
    expect(realChange(10, 2.8)).toBe(7);
    expect(CPI_ANNUAL['2025']).toBe(2.3);
    expect(inflationFor('2025-12').pct).toBe(2.3);
    expect(inflationFor('2026-10').pct).toBe(2.8);
  });
});
