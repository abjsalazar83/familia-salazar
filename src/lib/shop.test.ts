import { describe, it, expect } from 'vitest';
import { classify, keyOf, suggest, step, parseList, matchReceiptLines, estimate, sectionRank } from './shop';
describe('shop', () => {
  it('classify', () => {
    expect(classify('Leite meio gordo')).toBe('Lacticínios');
    expect(classify('Bananas')).toBe('Fruta e legumes');
    expect(classify('Fraldas 4')).toBe('Bebé e miúdas');
    expect(classify('Detergente roupa')).toBe('Limpeza');
    expect(classify('Peito de frango')).toBe('Talho e peixe');
    expect(classify('Pão de forma')).toBe('Padaria');
    expect(classify('Arroz')).toBe('Mercearia');
    expect(classify('Coisa estranha')).toBe('Outros');
    expect(classify('Bananas', { [keyOf('Bananas')]: 'Outros' })).toBe('Outros');
    expect(sectionRank('Fruta e legumes')).toBeLessThan(sectionRank('Limpeza'));
  });
  it('keyOf singular', () => { expect(keyOf('Limões')).toBe(keyOf('limão')); expect(keyOf('Ovos')).toBe('ovo'); });
  it('suggest', () => {
    const now = Date.parse('2026-10-30');
    const ps = [{ key: 'leite', name: 'Leite', uses: 9, last_used: '2026-10-29' }, { key: 'lexivia', name: 'Lixívia', uses: 1, last_used: '2026-01-01' }, { key: 'pao', name: 'Pão', uses: 3, last_used: '2026-10-28' }];
    expect(suggest(ps, 'le', new Set(), now).map((p) => p.name)).toEqual(['Leite']);
    expect(suggest(ps, '', new Set(['leite']), now).map((p) => p.name)).toEqual(['Pão', 'Lixívia']);
  });
  it('step', () => { expect(step(null, 'un', 1)).toBe(1); expect(step(1, 'un', -1)).toBeNull(); expect(step(1, 'kg', 1)).toBe(1.5); expect(step(200, 'g', 1)).toBe(300); });
  it('parseList', () => {
    expect(parseList('leite, ovos e fraldas').map((x) => x.name)).toEqual(['Leite', 'Ovos', 'Fraldas']);
    expect(parseList('2 litros de leite e uma dúzia de ovos')).toEqual([{ name: 'Leite', qty: 2, unit: 'L' }, { name: 'Ovos', qty: 12, unit: 'un' }]);
    expect(parseList('três bananas')[0]).toEqual({ name: 'Bananas', qty: 3, unit: 'un' });
  });
  it('matchReceiptLines', () => {
    expect(matchReceiptLines('LEITE M/GORDO 1L  0,89 A\nOVOS CLASSE M 2,49 A\nTOTAL 3,38', ['Leite', 'Ovos', 'Fraldas'])).toEqual({ Leite: 89, Ovos: 249 });
    expect(matchReceiptLines('BANANA KG 1,29\n', ['Bananas'])).toEqual({ Bananas: 129 });
  });
  it('estimate', () => {
    expect(estimate([{ name: 'Leite', qty: 6, unit: 'un' }, { name: 'X' }], { leite: 89 })).toEqual({ total: 534, known: 1, missing: 1 });
  });
});
