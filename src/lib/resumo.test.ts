import { describe, it, expect } from 'vitest';
import { catRows, monthBars, pctChange, prevYm } from './resumo';
describe('resumo', () => {
  it('pctChange', () => { expect(pctChange(120, 100)).toBe(20); expect(pctChange(80, 100)).toBe(-20); expect(pctChange(5, 0)).toBeNull(); expect(pctChange(5, null)).toBeNull(); });
  it('catRows ordena por valor e compara com o mês anterior', () => {
    const r = catRows({ Casa: 500, Super: 900, Zero: 0 }, { Super: 1000 });
    expect(r.map((x) => x.cat)).toEqual(['Super', 'Casa']);
    expect(r[0].pct).toBe(-10); expect(r[1].pct).toBeNull(); expect(r[1].prev).toBe(0);
    expect(catRows({ A: 1 }, null)[0].prev).toBeNull();
  });
  it('prevYm atravessa o ano', () => { expect(prevYm('2026-01')).toBe('2025-12'); expect(prevYm('2026-11')).toBe('2026-10'); });
  it('monthBars: 5 anteriores + corrente', () => {
    const ms = Array.from({ length: 8 }, (_, i) => ({ ym: `2026-0${i + 1}`, total_cents: (i + 1) * 100, cats: {} })) as never;
    const b = monthBars(ms, '2026-07', 42);
    expect(b.map((x) => x.ym)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    expect(b[5]).toMatchObject({ v: 42, current: true });
  });
});
