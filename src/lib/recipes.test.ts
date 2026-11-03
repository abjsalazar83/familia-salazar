import { describe, expect, it } from 'vitest';
import { RECIPES, macros, doses, DEFAULT_FAMILY, scaleQty, scaled, rank, mergeIntoList, byId, hasTag, listName } from './recipes';
import type { Item } from './types';

describe('receitas', () => {
  it('45 receitas, ids únicos, todas com passos e ingredientes conhecidos', () => {
    expect(RECIPES).toHaveLength(45);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(45);
    for (const r of RECIPES) { expect(r.s.length).toBeGreaterThan(1); expect(r.ing.length).toBeGreaterThan(2); }
  });
  it('doses: 2 adultos + 2 crianças a meia dose = 3; marmitas somam', () => {
    expect(doses(DEFAULT_FAMILY)).toBe(3);
    expect(doses(DEFAULT_FAMILY, 2)).toBe(5);
    expect(doses({ adults: 2, kids: 2, kidDose: 0.6 })).toBe(3.2);
  });
  it('escala e arredonda (ovos inteiros/meios, gramas a 5/10)', () => {
    expect(scaleQty(150, 'g', 3)).toBe(450);
    expect(scaleQty(1, 'un', 3)).toBe(3);
    expect(scaleQty(0.5, 'un', 3)).toBe(1.5);
    expect(scaleQty(12, 'ml', 3)).toBe(35);
    const s = scaled(byId('gomes-sa')!, 3); expect(s.find((i) => i.key === 'bacalhau')!.qty).toBe(450);
  });
  it('kcal: soma por gramas com a tabela; sopas leves, cozido pesado', () => {
    const m = macros(byId('omelete')!); expect(m.kcal).toBeGreaterThan(200); expect(m.kcal).toBeLessThan(400); expect(m.p).toBeGreaterThan(15);
    expect(hasTag(byId('caldo-verde')!, 'leve')).toBe(true);
    expect(macros(byId('cozido')!).kcal).toBeGreaterThan(500);
  });
  it('variedade: não repete receita (10 dias) nem proteína de ontem', () => {
    const hist = [{ recipe_id: 'gomes-sa', on_date: '2026-11-02' }, { recipe_id: 'panados', on_date: '2026-10-25' }];
    const r = rank('2026-11-03', hist, 'jantar');
    expect(r.map((x) => x.id)).not.toContain('gomes-sa');
    expect(r.map((x) => x.id)).not.toContain('panados');
    expect(r[0].p).not.toBe('bacalhau');
    expect(rank('2026-11-20', hist, 'jantar').map((x) => x.id)).toContain('gomes-sa');
  });
  it('variedade: almoço evita sopa; noite leve prefere sopa/leve; outra refeição do dia muda proteína', () => {
    expect(rank('2026-11-03', [], 'almoco')[0].t).not.toContain('sopa');
    const l = rank('2026-11-03', [], 'jantar', { light: true })[0]; expect(hasTag(l, 'leve') || l.t.includes('sopa')).toBe(true);
    const a = rank('2026-11-03', [], 'almoco')[0]; expect(rank('2026-11-03', [], 'jantar', {}, [a.id])[0].p).not.toBe(a.p);
  });
  it('variedade: nunca devolve lista vazia', () => {
    const hist = RECIPES.map((r) => ({ recipe_id: r.id, on_date: '2026-11-03' }));
    expect(rank('2026-11-03', hist, 'almoco').length).toBeGreaterThan(0);
  });
  it('lista: soma ao que já está por comprar, sem duplicar; ignora despensa e q.b.', () => {
    const items = [{ id: 'x1', name: 'Batata', bought: false, qty: 500, unit: 'g' }, { id: 'x2', name: 'Ovos', bought: false, qty: 12, unit: 'un' }, { id: 'x3', name: 'Cebola', bought: true, qty: 1, unit: 'kg' }] as Item[];
    const ops = mergeIntoList(scaled(byId('gomes-sa')!, 3), items);
    expect(ops.find((o) => o.name === 'Batata')).toEqual({ kind: 'patch', id: 'x1', name: 'Batata', qty: 1100, unit: 'g' });
    expect(ops.filter((o) => o.kind === 'create').map((o) => o.name)).toContain('Cebola');
    expect(ops.find((o) => o.name === 'Ovos')).toEqual({ kind: 'patch', id: 'x2', name: 'Ovos', qty: 15, unit: 'un' });
    expect(ops.map((o) => o.name)).not.toContain('Azeite');
    expect(ops.map((o) => o.name)).not.toContain('Salsa picada');
    expect(new Set(ops.map((o) => o.name)).size).toBe(ops.length);
  });
  it('nome para a lista sem notas de preparação', () => {
    expect(listName('Bacalhau desfiado demolhado')).toBe('Bacalhau');
    expect(listName('Batata (puré)')).toBe('Batata');
  });
});
