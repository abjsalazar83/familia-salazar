import { describe, expect, it } from 'vitest';
import { averages, monthly, yearly, ymLabel } from './history';
import type { HistoryMonth } from './types';
const m = (ym: string, t: number, x = 0, cats = {}, provisional = false): HistoryMonth => ({ id: ym, ym, total_cents: t, extra_cents: x, cats, provisional, note: null });
describe('history', () => {
  it('média dos últimos n fechados, ignora provisório', () => {
    const a = averages([m('2026-01', 100), m('2026-02', 300, 100, { A: 200 }), m('2026-03', 9999, 0, {}, true)], 12)!;
    expect(a).toMatchObject({ months: 2, total: 200, noExtra: 150, from: '2026-01', to: '2026-02' });
    expect(a.byCat).toEqual([['A', 100]]);
  });
  it('só usa os últimos n', () => { expect(averages([m('2025-12', 1000), m('2026-01', 100)], 1)!.total).toBe(100); });
  it('vazio', () => expect(averages([])).toBeNull());
  it('anual', () => expect(yearly([m('2025-01', 100), m('2025-02', 200), m('2026-01', 50)])).toEqual([{ year: '2025', avg: 150, n: 2 }, { year: '2026', avg: 50, n: 1 }]));
  it('rótulo e mensal', () => { expect(ymLabel('2026-10')).toBe('out 26'); expect(monthly(3199, 'trimestral')).toBe(1066); expect(monthly(null, 'mensal')).toBeNull(); });
});
