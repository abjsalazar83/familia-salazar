import { describe, it, expect } from 'vitest';
import { webMatches, webShown, when, type WebPrice } from './webprice';
const w = (id: string, name: string, terms: string, unit: number | null, seen: string, base: any = 'kg'): WebPrice => ({ id, name, terms, store: 'Loja ' + id, city: null, price_cents: 199, base, unit_price_cents: unit, seen_on: seen, url: null });
const rows = [w('1', 'Bananas', 'bananas fruits', 119, '2026-09-29'), w('2', 'Banana chips', 'banana chips snacks', null, '2026-10-01', null), w('3', 'Leite meio gordo', 'leite meio gordo milks semi skimmed', 79, '2026-10-10', 'L'), w('4', 'H-Milch', 'h milch milks', 95, '2026-08-01', 'L')];
describe('preços da internet', () => {
  it('encontra por nome e sinónimo, com preço unitário primeiro', () => {
    expect(webMatches('Bananas', rows).map((r) => r.id)).toEqual(['1', '2']);
    expect(webMatches('Leite', rows).map((r) => r.id)).toEqual(['3', '4']);
  });
  it('sem correspondência → vazio (nunca inventa)', () => { expect(webMatches('Detergente da loiça', rows)).toEqual([]); expect(webMatches('', rows)).toEqual([]); });
  it('todas as palavras têm de bater', () => { expect(webMatches('Leite de coco', rows)).toEqual([]); });
  it('mostra unitário ou preço da embalagem', () => { expect(webShown(rows[0])).toEqual({ cents: 119, base: 'kg' }); expect(webShown(rows[1])).toEqual({ cents: 199, base: null }); });
  it('datas relativas', () => { const t = new Date('2026-11-02T12:00:00Z'); expect(when('2026-11-02', t)).toBe('hoje'); expect(when('2026-11-01', t)).toBe('ontem'); expect(when('2026-09-29', t)).toBe('29/09/2026'); });
});
