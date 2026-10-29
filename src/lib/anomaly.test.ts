import { describe, expect, it } from 'vitest';
import { confirmCount, monthFlags, monthTotals } from './anomaly';
const m = (ym: string, t: number, cats: Record<string, number>, extra = 0) => ({ id: ym, ym, total_cents: t, extra_cents: extra, cats, provisional: false, note: null });
const hist = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map((ym) => m(ym, 100000, { Casa: 50000, Lazer: 10000 }));

describe('monthFlags', () => {
  it('não assinala um mês normal', () => expect(monthFlags(hist, '2026-07', 105000, { Casa: 50000, Lazer: 11000 })).toEqual([]));
  it('assinala total e categoria acima de +25%', () => {
    const f = monthFlags(hist, '2026-07', 140000, { Casa: 50000, Lazer: 50000 });
    expect(f.map((x) => x.what)).toEqual(['total', 'Lazer']);
    expect(f[0].pct).toBe(40);
  });
  it('precisa de 3 meses de base', () => expect(monthFlags(hist.slice(0, 2), '2026-07', 900000, {})).toEqual([]));
  it('ignora meses em aberto e posteriores', () => expect(monthFlags([...hist, m('2026-08', 999999, {})], '2026-07', 105000, {})).toEqual([]));
  it('sem extraordinárias usa total − extra como base', () => {
    const h = hist.map((x) => ({ ...x, total_cents: 130000, extra_cents: 30000 }));
    expect(monthFlags(h, '2026-07', 140000, {}, { noExtra: true })[0]?.what).toBe('total');
    expect(monthFlags(h, '2026-07', 140000, {})).toEqual([]);
  });
});

describe('monthTotals / confirmCount', () => {
  const e = [
    { category: 'Casa', amount_cents: 1000, date: '2026-10-01', is_deleted: false, type: 'partilhada', confirmed_by: 'x' },
    { category: 'Lazer', amount_cents: 5000, date: '2026-10-02', is_deleted: false, type: 'partilhada', extraordinary: true },
    { category: 'Casa', amount_cents: 700, date: '2026-10-02', is_deleted: false, type: 'pessoal' },
    { category: 'Casa', amount_cents: 900, date: '2026-10-03', is_deleted: true, type: 'partilhada' },
  ];
  it('soma só partilhadas ativas', () => expect(monthTotals(e, '2026-10')).toEqual({ total: 6000, cats: { Casa: 1000, Lazer: 5000 }, extra: 5000 }));
  it('pode excluir extraordinárias', () => expect(monthTotals(e, '2026-10', true).total).toBe(1000));
  it('conta confirmadas', () => expect(confirmCount(e, '2026-10')).toEqual({ done: 1, total: 2 }));
});
