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
import { byStore, costByCategory, fixedVsVariable, savingTips } from './history';
const mk = (k: number, cats: Record<string, number>, x = 0) => { const ym = `20${String(24 + Math.floor(k / 12))}-${String((k % 12) + 1).padStart(2, '0')}`; return { id: ym, ym, total_cents: Object.values(cats).reduce((a, b) => a + b, 0), extra_cents: x, cats, provisional: false, note: null }; };
describe('quanto custa / poupar', () => {
  const ms = [...Array.from({ length: 12 }, (_, k) => mk(k, { S: 10000, C: 5000 })), ...Array.from({ length: 12 }, (_, k) => mk(12 + k, { S: k >= 9 ? 20000 : 12000, C: 5000 }))];
  it('custo por categoria com % e tendência', () => {
    const r = costByCategory(ms, 12);
    expect(r[0]).toMatchObject({ cat: 'S', month: 14000, year: 168000, trend: 40 });
    expect(r[1]).toMatchObject({ cat: 'C', trend: 0 });
    expect(r[0].pct + r[1].pct).toBeCloseTo(100, 0);
  });
  it('fixas vs variáveis', () => {
    expect(fixedVsVariable([{ name: 'a', amount_cents: 3000, period: 'trimestral' }, { name: 'b', amount_cents: 500, period: 'mensal' }, { name: 'c', amount_cents: 9000, period: 'variável' }, { name: 'd', amount_cents: null, period: 'mensal' }], 10000))
      .toEqual({ fixed: 1500, variable: 8500, unknown: 1, estimated: false });
  });
  it('sugestões só com números calculados', () => {
    const t = savingTips(ms, [{ name: 'Netflix', amount_cents: 900, period: 'mensal' }], 12);
    const a = t.find((x) => x.kind === 'acima')!; expect(a.saving).toBe(20000 - 14000);
    expect(t.find((x) => x.kind === 'subscricoes')!.saving).toBe(900);
    expect(t.find((x) => x.kind === 'pico')).toBeTruthy();
    expect(savingTips(ms.slice(0, 2), [])).toEqual([]);
  });
  it('supermercado por loja', () => {
    expect(byStore([{ description: 'LojaA x', category: 'Supermercado', amount_cents: 100, date: '2026-10-01', is_deleted: false }, { description: 'lojaa', category: 'Supermercado', amount_cents: 50, date: '2026-10-02', is_deleted: false }, { description: 'LojaB', category: 'Supermercado', amount_cents: 70, date: '2026-01-01', is_deleted: false }], '2026-09-01')).toEqual([['lojaa', 150]]);
  });
});
