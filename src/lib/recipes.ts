// Receitas: doses da família, calorias (≈, TCA INSA), regra de variedade e passagem para a lista de compras.
import { RECIPES, type Recipe, type Ing } from '../data/recipes';
import { NUT, UNIT_G, PANTRY } from '../data/nutri';
import { keyOf } from './shop';
import type { Item, Unit } from './types';

export type Family = { adults: number; kids: number; kidDose: number };
export const DEFAULT_FAMILY: Family = { adults: 2, kids: 2, kidDose: 0.5 };
/** Doses totais (adulto = 1) incluindo marmitas extra. */
export const doses = (f: Family, marmitas = 0) => Math.round((f.adults + f.kids * f.kidDose + Math.max(0, marmitas)) * 100) / 100;

const grams = ([, q, u, k]: Ing) => u === 'g' || u === 'ml' ? q : u === 'un' ? q * (UNIT_G[k] ?? 0) : 0;
export type Macro = { kcal: number; p: number; h: number; g: number };
/** Calorias e macros de 1 dose de adulto (estimativa). */
export function macros(r: Recipe): Macro {
  const m = { kcal: 0, p: 0, h: 0, g: 0 };
  for (const i of r.ing) { const n = NUT[i[3]]; if (!n) continue; const f = grams(i) / 100; m.kcal += n[0] * f; m.p += n[1] * f; m.h += n[2] * f; m.g += n[3] * f; }
  return { kcal: Math.round(m.kcal / 10) * 10, p: Math.round(m.p), h: Math.round(m.h), g: Math.round(m.g) };
}
export const LIGHT_KCAL = 500;
export const isLight = (r: Recipe) => macros(r).kcal <= LIGHT_KCAL;

/** Quantidade escalada, arredondada a algo que se compra/mede. */
export function scaleQty(q: number, u: Ing[2], d: number): number {
  const v = q * d;
  if (u === 'un') return Math.max(0.5, Math.ceil(v * 2) / 2);
  if (u === 'qb') return 0;
  return v >= 100 ? Math.round(v / 10) * 10 : Math.round(v / 5) * 5 || Math.ceil(v);
}
export const qtyLabel = (q: number, u: Ing[2]) => u === 'qb' ? 'q.b.' : u === 'un' ? String(q).replace('.', ',') : q >= 1000 ? `${String(Math.round(q / 100) / 10).replace('.', ',')} ${u === 'g' ? 'kg' : 'L'}` : `${q} ${u}`;
export const scaled = (r: Recipe, d: number) => r.ing.map((i) => ({ label: i[0], key: i[3], unit: i[2], qty: scaleQty(i[1], i[2], d) }));

// ——— Variedade ———
export type Cooked = { recipe_id: string; on_date: string; kind?: 'cozinhei' | 'plano'; meal?: string };
const DAY = 864e5;
const dayN = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + 'T12:00:00Z') / DAY);
export const RECIPE_DAYS = 10, PROTEIN_DAYS = 2;
export type Slot = 'almoco' | 'jantar';
export type Pref = { light?: boolean; marmita?: boolean };
/** Candidatas por ordem: sem repetir receita (10 dias) nem proteína (2 dias, e penaliza a semana). Nunca fica vazio. */
export function rank(today: string, hist: Cooked[], slot: Slot, pref: Pref = {}, exclude: string[] = [], all = RECIPES): Recipe[] {
  const t = dayN(today);
  const past = hist.filter((h) => (h.kind ?? 'cozinhei') === 'cozinhei' && dayN(h.on_date) <= t && t - dayN(h.on_date) < RECIPE_DAYS);
  const byId = new Map(all.map((r) => [r.id, r]));
  const recent = new Set(past.map((h) => h.recipe_id));
  const protNear = new Set(past.filter((h) => t - dayN(h.on_date) < PROTEIN_DAYS).map((h) => byId.get(h.recipe_id)?.p).filter(Boolean));
  for (const id of exclude) { const p = byId.get(id)?.p; if (p) protNear.add(p); }
  const week = (p: string) => past.filter((h) => t - dayN(h.on_date) < 7 && byId.get(h.recipe_id)?.p === p).length;
  const seed = (s: string) => { let h = t * 31 + (slot === 'jantar' ? 7 : 0); for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h % 997; };
  const score = (r: Recipe) => {
    let s = seed(r.id) / 997;
    s -= week(r.p) * 0.6;
    if (slot === 'almoco' && r.t.includes('sopa')) s -= 1.5;           // almoço: prato principal
    if (pref.light) s += (r.t.includes('sopa') || isLight(r) ? 2 : -1);
    if (pref.marmita) s += r.t.includes('marmita') ? 1 : -2;
    if (r.epoca && !inSeason(r, today)) s -= 3;
    if (r.min > 90 && slot === 'almoco') s -= 0.5;
    return s;
  };
  const tiers = [(r: Recipe) => !recent.has(r.id) && !protNear.has(r.p), (r: Recipe) => !recent.has(r.id), () => true];
  for (const ok of tiers) { const c = all.filter((r) => ok(r) && !exclude.includes(r.id)); if (c.length) return c.sort((a, b) => score(b) - score(a)); }
  return all.slice();
}
export const inSeason = (r: Recipe, iso: string) => !r.epoca || (+iso.slice(5, 7) >= 6 && +iso.slice(5, 7) <= 9);

// ——— Lista de compras ———
const toList = (q: number, u: Ing[2]): { qty: number; unit: Unit } => u === 'un' ? { qty: q, unit: 'un' } : u === 'ml' ? { qty: Math.round(q / 10) / 100, unit: 'L' } : { qty: q, unit: 'g' };
export type ListOp = { kind: 'create'; name: string; qty: number; unit: Unit } | { kind: 'patch'; id: string; name: string; qty: number; unit: Unit } | { kind: 'skip'; name: string };
/** Junta ingredientes à lista: soma quando o item já está por comprar (mesma unidade), não duplica. */
export function mergeIntoList(ings: ReturnType<typeof scaled>, items: Item[], pantry = false): ListOp[] {
  const open = items.filter((i) => !i.bought && !i.archived_at);
  const ops: ListOp[] = []; const acc = new Map<string, ListOp>();
  for (const i of ings) {
    if (i.unit === 'qb' || !i.qty || (!pantry && PANTRY.has(i.key))) continue;
    const name = listName(i.label); const k = keyOf(name); const v = toList(i.qty, i.unit);
    const prev = acc.get(k);
    if (prev && prev.kind !== 'skip' && prev.unit === v.unit) { prev.qty = Math.round((prev.qty + v.qty) * 100) / 100; continue; }
    if (prev) continue;
    const ex = open.find((x) => keyOf(x.name) === k);
    const op: ListOp = !ex ? { kind: 'create', name, ...v } : (ex.unit ?? null) === v.unit || ex.qty == null ? { kind: 'patch', id: ex.id, name: ex.name, qty: Math.round(((ex.qty ?? 0) + v.qty) * 100) / 100, unit: v.unit } : { kind: 'skip', name: ex.name };
    acc.set(k, op); ops.push(op);
  }
  return ops;
}
/** «Batata (puré)» → «Batata»; «Lombo de bacalhau demolhado» → «Lombo de bacalhau». */
export const listName = (l: string) => l.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\b(demolhad[oa]|aos? (pedaços|cubos)|às rodelas|em juliana|laminados|picad[oa]|ralad[oa]|cozid[oa]|desfiad[oa])\b/gi, '').replace(/\s+/g, ' ').trim();

export const byId = (id: string) => RECIPES.find((r) => r.id === id);
export const TAGS: [string, string][] = [['bacalhau', 'Bacalhau'], ['norte', 'Norte'], ['frango', 'Frango'], ['peixe', 'Peixe'], ['leguminosas', 'Leguminosas'], ['sopa', 'Sopas'], ['leve', 'Leve'], ['marmita', 'Marmita'], ['rapida', 'Rápida'], ['forno', 'Forno']];
/** 'leve' também quando ≤ 500 kcal. */
export const hasTag = (r: Recipe, t: string) => r.t.includes(t as never) || (t === 'leve' && isLight(r));
export { RECIPES };
