import { describe, it, expect } from 'vitest';
import { keepBlocks, keepText, keepTotal, keepVal, keepMonth } from './keep';
import listaSrc from '../Lista.tsx?raw';
import keepSrc from './keep.ts?raw';
import { monthSettlement } from './settle';

const A = { id: 'a', display_name: 'António' }, B = { id: 'b', display_name: 'Ana' };
const I = (v: number | null, by: string, date: string, note: string, o: Record<string, unknown> = {}) => ({ amount_cents: v, received_by: by, receiver_pct: 50, is_deleted: false, date, note, category: 'Abono', created_at: date + 'T09:00', ...o });
const E = (v: number, d: string, by: string, date: string, o: Record<string, unknown> = {}) => ({ amount_cents: v, description: d, paid_by: by, type: 'partilhada', date, is_deleted: false, created_at: date + 'T10:00', ...o });

describe('Keep (só consulta)', () => {
  it('formatos de número como na nota', () => {
    expect(keepVal(4015)).toBe('40,15'); expect(keepVal(300)).toBe('3'); expect(keepVal(2050)).toBe('20,50'); expect(keepVal(150)).toBe('1,50');
    expect(keepTotal(127092)).toBe('1.270,92'); expect(keepTotal(102513, ' ')).toBe('1 025,13'); expect(keepTotal(24581)).toBe('245,81');
    expect(keepMonth('2026-10')).toBe('Outubro 2026');
  });
  it('texto no formato da nota: tudo a metade, receitas no bloco de quem recebeu, quem deve a quem no fim', () => {
    const exps = [E(8030, 'Mercadona', 'a', '2026-10-01'), E(1830, 'Mercadona', 'b', '2026-10-02'), E(300, 'Action', 'a', '2026-10-03'), E(2300, 'portagens', 'b', '2026-10-04'), E(245524, 'Casa 🏠', 'a', '2026-10-05')];
    const incs = [I(8954, 'b', '2026-10-08', 'abono')];
    expect(keepText(exps, [A, B], '2026-10', 'Bruno', incs)).toBe(['Outubro 2026', '', 'Ana', '40,15 Mercadona', '1,50 Action', '1227,62 Casa 🏠', '44,77 abono', '', '1.314,04', '', 'Bruno', '9,15 Mercadona', '11,50 portagens', '', '20,65 €', '1.314,04-20,65=1 293,39 euros', '', 'Ana deve 1 293,39 € a Bruno.'].join('\n'));
  });
  it('só partilhadas do mês; pessoais, retiradas, extrato e outros meses ficam de fora', () => {
    const exps = [E(1000, 'ok', 'a', '2026-10-10'), E(1000, 'pessoal', 'a', '2026-10-10', { type: 'pessoal' }), E(1000, 'apagada', 'a', '2026-10-10', { is_deleted: true }),
      E(1000, 'extrato', 'a', '2026-10-10', { review: 'por_rever' }), E(1000, 'nov', 'a', '2026-11-01')];
    const [ana, bruno] = keepBlocks(exps, [A, B], '2026-10');
    expect(bruno.lines).toEqual([]); expect(ana.lines.map((l) => [l.v, l.d])).toEqual([[500, 'ok']]); expect(bruno.label).toBe('Bruno');
    expect(keepBlocks(exps, [A, B], '2026-10', 'Tó')[1].label).toBe('Tó');
  });
  it('diferença negativa e mês vazio', () => {
    const t = keepText([E(1000, 'x', 'b', '2026-10-01')], [A, B], '2026-10').split('\n');
    expect(t.slice(-3)).toEqual(['0,00-5,00=-5,00 euros', '', 'Bruno deve 5,00 € a Ana.']);
    expect(keepText([], [A, B], '2026-10').split('\n').pop()).toBe('Contas certas: ninguém deve nada.');
  });
  it('ecrã sem nada editável (sem inputs, sem gravar)', () => {
    expect(listaSrc).not.toMatch(/<input|<textarea|contentEditable|mutate\(|supabase/);
  });
});

// fs-v48 — a nota Keep tem de dar exatamente o acerto do mês da app (motor lib/settle.ts).
describe('Keep = acerto do mês', () => {
  const ids = [A.id, B.id];
  const check = (exps: any[], incs: any[], ym = '2026-10') => {
    const bs = keepBlocks(exps, [A, B], ym, 'Bruno', incs);
    const c = monthSettlement(ids, exps.filter((e) => !e.review), ym, incs);
    const d = bs[0].total - bs[1].total; // bloco da Ana − bloco do outro
    expect(Math.abs(d)).toBe(c.diff);
    expect(d > 0 ? bs[0].m.id : d < 0 ? bs[1].m.id : null).toBe(c.debtor);
    return { bs, c };
  };
  it('exemplo pequeno: a Ana recebeu o abono, o Bruno pagou mais → a Ana deve ao Bruno', () => {
    const exps = [E(20000, 'Mercadona', 'a', '2026-10-02'), E(6000, 'seguro', 'a', '2026-10-05'), E(4000, 'farmácia', 'b', '2026-10-06'),
      E(9999, 'pessoal', 'a', '2026-10-07', { type: 'pessoal', shares: {} }), E(5000, 'retirada', 'b', '2026-10-07', { is_deleted: true })];
    const incs = [I(8954, 'b', '2026-10-08', 'abono'), I(8954, 'b', '2026-10-20', 'abono'), I(null, 'b', '2026-10-21', 'IRS')];
    const { bs, c } = check(exps, incs);
    expect(bs[0].lines.map((l) => [l.v, l.d])).toEqual([[10000, 'Mercadona'], [3000, 'seguro'], [4477, 'abono'], [4477, 'abono']]);
    expect(bs[1].lines.map((l) => [l.v, l.d])).toEqual([[2000, 'farmácia']]);
    expect(c.debtor).toBe('b'); expect(c.diff).toBe(19954);
    expect(keepText(exps, [A, B], '2026-10', 'Bruno', incs).split('\n').slice(-3)).toEqual(['219,54-20,00=199,54 euros', '', 'Ana deve 199,54 € a Bruno.']);
  });
  it('divisões não 50/50 e receitas com % usam a parte certa (como o acerto)', () => {
    check([E(10000, 'x', 'a', '2026-10-01', { shares: { a: 3000, b: 7000 } }), E(999, 'ímpar', 'b', '2026-10-02', { shares: null })], [I(1001, 'a', '2026-10-03', 'reembolso', { receiver_pct: 100 }), I(1001, 'b', '2026-10-04', 'IRS', { receiver_pct: 30 })]);
  });
  it('transferências (acertos) não entram — tal como no acerto do mês', () => {
    const src = keepSrc; expect(src).not.toMatch(/settlements|from_member/);
  });
  it('aleatório: 300 meses inventados dão sempre o mesmo valor e sentido que o acerto', () => {
    let seed = 7; const r = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let k = 0; k < 300; k++) {
      const exps = Array.from({ length: r(12) }, (_, j) => { const v = 1 + r(50000); const by = r(2) ? 'a' : 'b'; const kind = r(10);
        return E(v, 'd' + j, by, `2026-${r(5) ? '10' : '09'}-${String(1 + r(28)).padStart(2, '0')}`, kind === 0 ? { type: 'pessoal', shares: {} } : kind === 1 ? { is_deleted: true } : kind === 2 ? { shares: { a: Math.floor(v / 3), b: v - Math.floor(v / 3) } } : kind === 3 ? { review: 'por_rever' } : {}); });
      const incs = Array.from({ length: r(3) }, (_, j) => I(r(4) ? 1 + r(20000) : null, r(2) ? 'a' : 'b', `2026-10-${String(1 + r(28)).padStart(2, '0')}`, 'i' + j, { receiver_pct: [50, 50, 100, 0, 30][r(5)] }));
      check(exps, incs);
    }
  });
});
