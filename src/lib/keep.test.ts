import { describe, it, expect } from 'vitest';
import { keepBlocks, keepText, keepTotal, keepVal, keepMonth } from './keep';
import listaSrc from '../Lista.tsx?raw';

const A = { id: 'a', display_name: 'António' }, B = { id: 'b', display_name: 'Ana' };
const E = (v: number, d: string, by: string, date: string, o: Record<string, unknown> = {}) => ({ amount_cents: v, description: d, paid_by: by, type: 'partilhada', date, is_deleted: false, created_at: date + 'T10:00', ...o });

describe('Lista estilo Keep (só consulta)', () => {
  it('formatos de número como na nota', () => {
    expect(keepVal(4015)).toBe('40,15'); expect(keepVal(300)).toBe('3'); expect(keepVal(2050)).toBe('20,50'); expect(keepVal(150)).toBe('1,50');
    expect(keepTotal(127092)).toBe('1.270,92'); expect(keepTotal(102513, ' ')).toBe('1 025,13'); expect(keepTotal(24581)).toBe('245,81');
    expect(keepMonth('2026-10')).toBe('Outubro 2026');
  });
  it('texto exatamente no formato da nota da Ana (Ana primeiro, depois «Bruno»)', () => {
    const exps = [E(4015, 'Mercadona', 'b', '2026-10-01'), E(915, 'Mercadona', 'a', '2026-10-02'), E(150, 'Action', 'b', '2026-10-03'), E(1150, 'portagens', 'a', '2026-10-04'), E(122762, 'Casa 🏠', 'b', '2026-10-05')];
    expect(keepText(exps, [A, B], '2026-10')).toBe(['Outubro 2026', '', 'Ana', '40,15 Mercadona', '1,50 Action', '1227,62 Casa 🏠', '', '1.269,27', '', 'Bruno', '9,15 Mercadona', '11,50 portagens', '', '20,65 €', '1.269,27-20,65=1 248,62 euros'].join('\n'));
  });
  it('só partilhadas do mês; pessoais, retiradas, extrato e outros meses ficam de fora', () => {
    const exps = [E(1000, 'ok', 'a', '2026-10-10'), E(1000, 'pessoal', 'a', '2026-10-10', { type: 'pessoal' }), E(1000, 'apagada', 'a', '2026-10-10', { is_deleted: true }),
      E(1000, 'extrato', 'a', '2026-10-10', { review: 'por_rever' }), E(1000, 'nov', 'a', '2026-11-01')];
    const [ana, bruno] = keepBlocks(exps, [A, B], '2026-10');
    expect(ana.lines).toEqual([]); expect(bruno.lines.map((l) => l.d)).toEqual(['ok']); expect(bruno.label).toBe('Bruno');
    expect(keepBlocks(exps, [A, B], '2026-10', 'Tó')[1].label).toBe('Tó');
  });
  it('diferença negativa e mês vazio', () => {
    expect(keepText([E(500, 'x', 'a', '2026-10-01')], [A, B], '2026-10').split('\n').pop()).toBe('0,00-5,00=-5,00 euros');
  });
  it('ecrã sem nada editável (sem inputs, sem gravar)', () => {
    expect(listaSrc).not.toMatch(/<input|<textarea|contentEditable|mutate\(|supabase/);
  });
});
