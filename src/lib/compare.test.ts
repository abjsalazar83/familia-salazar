import { describe, it, expect } from 'vitest';
import { chainOf, quotes, cheaper, cost, basket, type Shelf } from './compare';
import type { Buy } from './prices';
import type { WebPrice } from './webprice';

const buy = (store: string, at: string, paid: number, per: number | null, base: Buy['base']): Buy => ({ key: 'banana', at, paid, per, base, store });
const web = (id: string, name: string, chain: 'mercadona' | 'lidl' | null, cents: number, base: 'kg' | 'L' | null, seen = '2026-10-01'): WebPrice =>
  ({ id, name, terms: name.toLowerCase(), store: chain, city: null, country: 'PT', chain, price_cents: cents, base, unit_price_cents: base ? cents : null, seen_on: seen, url: null });
const shelf = (chain: 'mercadona' | 'lidl', cents: number, base: Shelf['base'], seen: string, created = seen + 'T10:00:00Z'): Shelf =>
  ({ id: chain + seen, key: 'banana', chain, source: 'manual', web_id: null, price_cents: cents, base, seen_on: seen, created_at: created });

describe('compare Mercadona × Lidl', () => {
  it('reconhece a cadeia pelo nome da loja', () => {
    expect(chainOf('MERCADONA Gaia')).toBe('mercadona'); expect(chainOf('Lidl & Cia')).toBe('lidl'); expect(chainOf('Continente')).toBeNull(); expect(chainOf(null)).toBeNull();
  });
  it('talão da família por loja; sem nada → null (nunca inventa)', () => {
    const q = quotes('Banana', [buy('Mercadona', '2026-10-02', 150, 125, 'kg'), buy('Lidl', '2026-10-09', 110, 99, 'kg')], [], []);
    expect(q.mercadona).toMatchObject({ cents: 125, base: 'kg', source: 'talão', at: '2026-10-02' });
    expect(q.lidl).toMatchObject({ cents: 99, source: 'talão' });
    expect(quotes('Banana', [], [], [])).toEqual({ mercadona: null, lidl: null });
  });
  it('o mais recente vence entre talão e prateleira', () => {
    const q = quotes('Banana', [buy('Mercadona', '2026-10-02', 150, 125, 'kg')], [shelf('mercadona', 139, 'kg', '2026-11-01')], []);
    expect(q.mercadona).toMatchObject({ cents: 139, source: 'manual' });
    const q2 = quotes('Banana', [buy('Mercadona', '2026-11-02', 150, 125, 'kg')], [shelf('mercadona', 139, 'kg', '2026-11-01')], []);
    expect(q2.mercadona?.source).toBe('talão');
  });
  it('internet só da própria cadeia e marcada como automática', () => {
    const w = [web('a', 'Banana', 'lidl', 119, 'kg'), web('b', 'Banana', null, 50, 'kg'), web('c', 'Banana', 'mercadona', 0 + 135, 'kg')];
    const q = quotes('Banana', [], [], w);
    expect(q.lidl).toMatchObject({ cents: 119, source: 'web', auto: true, name: 'Banana' });
    expect(q.mercadona).toMatchObject({ cents: 135 });
    expect(quotes('Banana', [], [], [w[1]])).toEqual({ mercadona: null, lidl: null });
  });
  it('mais barata só com a mesma base', () => {
    const k = (m: number, b1: any, l: number, b2: any) => cheaper({ mercadona: { chain: 'mercadona', cents: m, base: b1, source: 'manual', at: '' }, lidl: { chain: 'lidl', cents: l, base: b2, source: 'manual', at: '' } });
    expect(k(100, 'kg', 90, 'kg')).toBe('lidl'); expect(k(80, 'kg', 90, 'kg')).toBe('mercadona'); expect(k(90, 'L', 90, 'L')).toBe('igual');
    expect(k(100, 'kg', 90, null)).toBeNull(); expect(cheaper({ mercadona: null, lidl: null })).toBeNull();
  });
  it('custo pela quantidade; unidades incompatíveis → null', () => {
    const q = (cents: number, base: any) => ({ chain: 'lidl' as const, cents, base, source: 'manual' as const, at: '' });
    expect(cost(q(200, 'kg'), 500, 'g')).toBe(100); expect(cost(q(200, 'kg'), 2, 'kg')).toBe(400); expect(cost(q(200, 'kg'), null, null)).toBe(200);
    expect(cost(q(90, 'L'), 6, 'L')).toBe(540); expect(cost(q(90, 'L'), 6, 'un')).toBeNull();
    expect(cost(q(30, 'un'), 12, 'un')).toBe(360); expect(cost(q(30, 'un'), null, null)).toBe(30);
    expect(cost(q(250, null), 2, 'pack')).toBe(500); expect(cost(q(250, null), 1, 'kg')).toBeNull(); expect(cost(null, 1, 'un')).toBeNull();
  });
  it('cesto só com itens com preço nas duas', () => {
    const Q = (m: number | null, l: number | null) => ({ mercadona: m == null ? null : { chain: 'mercadona' as const, cents: m, base: null, source: 'manual' as const, at: '' }, lidl: l == null ? null : { chain: 'lidl' as const, cents: l, base: null, source: 'manual' as const, at: '' } });
    expect(basket([{ q: Q(100, 90) }, { q: Q(200, null) }, { q: Q(50, 60), qty: 2, unit: 'un' }])).toEqual({ mercadona: 100, lidl: 90, n: 1, of: 3 });
  });
});

import { cost as cost2, basket as basket2 } from './compare';
describe('cost v40', () => {
  const q = (cents: number, base: any) => ({ chain: 'lidl' as const, cents, base, source: 'manual' as const, at: '2026-10-01' });
  it('sem quantidade conta 1 de cada base', () => { expect(cost2(q(150, 'kg'), null, null)).toBe(150); });
  it('preço de embalagem não se multiplica por unidades soltas', () => { expect(cost2(q(229, null), 12, 'un')).toBeNull(); expect(cost2(q(229, null), 2, 'pack')).toBe(458); });
  it('gramas → kg', () => { expect(cost2(q(1000, 'kg'), 500, 'g')).toBe(500); });
  it('cesto ignora itens sem preço numa das lojas', () => { const b = basket2([{ q: { mercadona: q(100, 'kg'), lidl: null } }, { q: { mercadona: q(200, 'kg'), lidl: q(180, 'kg') } }]); expect(b).toEqual({ mercadona: 200, lidl: 180, n: 1, of: 2 }); });
});
