// Lista de compras: secções (ordem de um percurso Mercadona), classificador PT-PT, sugestões, quantidades, voz e preços.
import type { Unit } from './types';

export const SECTIONS = ['Fruta e legumes', 'Padaria', 'Talho e peixe', 'Lacticínios', 'Mercearia', 'Bebidas', 'Congelados', 'Limpeza', 'Higiene', 'Bebé e miúdas', 'Outros'] as const;
export type Section = typeof SECTIONS[number];
export const UNITS: Unit[] = ['un', 'kg', 'g', 'L', 'pack'];

export const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Chave estável por item (singular aproximado). */
export const keyOf = (s: string) => norm(s).split(' ').map((w) => w.length > 3 ? w.replace(/(oes|aes|ns|s)$/, (m) => m === 'oes' ? 'ao' : m === 'aes' ? 'ao' : m === 'ns' ? 'm' : '') : w).join(' ');

const KW: [Section, RegExp][] = [
  ['Bebé e miúdas', /\b(fralda|toalhita|papa|biberao|chupeta|leite (de )?(transicao|crescimento|infantil)|pure (de )?bebe|bebe|nestum|cerelac)/],
  ['Higiene', /\b(champo|shampoo|gel (de )?banho|sabonete|pasta (de )?dentes|escova (de )?dentes|desodorizante|papel higienico|algodao|cotonete|penso|tampao|creme|lamina|gilete|protetor solar|elixir)/],
  ['Limpeza', /\b(detergente|lixivia|amaciador|esfregao|esponja|guardanapo|rolo (de )?cozinha|papel (de )?cozinha|saco(s)? (do )?lixo|limpa|pastilhas maquina|sabao|lava loica|vinagre de limpeza|ambientador)/],
  ['Congelados', /\b(congelad|gelado|ervilhas congeladas|pizza|douradinhos|nuggets|batata(s)? fritas congeladas|gelo)\b/],
  ['Bebidas', /\b(agua|sumo|refrigerante|cola|cerveja|vinho|cafe|cha\b|ice tea|compal|sumol|bebida)/],
  ['Lacticínios', /\b(leite|iogurte|queijo|manteiga|natas|requeijao|kefir|ovo|ovos|skyr|mozzarella|fiambre|presunto)/],
  ['Padaria', /\b(pao|paes|carcaca|baguete|broa|tosta|bolo|croissant|pao de forma|tortilha|wrap|bolacha maria)/],
  ['Talho e peixe', /\b(frango|peru|carne|bife|porco|vaca|novilho|picada|hamburguer|salsicha|chourico|bacon|entrecosto|costeleta|peixe|pescada|salmao|bacalhau|atum fresco|dourada|robalo|camarao|lula|polvo|sardinha)/],
  ['Fruta e legumes', /\b(banana|maca|pera|laranja|limao|uva|morango|kiwi|melao|melancia|abacate|ananas|manga|tomate|alface|cebola|alho|batata|cenoura|curgete|pepino|pimento|brocolos|espinafre|couve|cogumelo|salsa|coentros|legume|fruta|abobora|nabo|alho frances|rucula)/],
  ['Mercearia', /\b(arroz|massa|esparguete|farinha|acucar|sal\b|azeite|oleo|vinagre|atum|salsichas lata|grao|feijao|lentilha|cereais|aveia|bolacha|chocolate|mel|compota|ketchup|maionese|mostarda|molho|especiaria|caldo|cafe soluvel|tremoco|bolachas|snack|batata frita|pipoca|conserva|tomate pelado|polpa)/],
];
/** Secção por palavras-chave; `learned` (escolhas da família) tem prioridade. */
export function classify(name: string, learned?: Record<string, string | null | undefined>): Section {
  const l = learned?.[keyOf(name)]; if (l && (SECTIONS as readonly string[]).includes(l)) return l as Section;
  const n = ' ' + norm(name) + ' ';
  return KW.find(([, r]) => r.test(n))?.[0] ?? 'Outros';
}
export const sectionRank = (s: string | null | undefined) => { const i = (SECTIONS as readonly string[]).indexOf(s ?? 'Outros'); return i < 0 ? SECTIONS.length : i; };

export type Pref = { key: string; name: string; section?: string | null; basic?: boolean; unit?: Unit | null; last_price_cents?: number | null; uses: number; last_used: string };
/** Sugestões: com texto → prefixo de palavra; sem texto → mais frequentes/recentes. Exclui o que já está na lista. */
export function suggest(prefs: Pref[], q: string, exclude: Set<string>, now = Date.now(), k = 6): Pref[] {
  const n = norm(q);
  const score = (p: Pref) => p.uses * 2 + Math.max(0, 30 - (now - Date.parse(p.last_used)) / 864e5) / 3;
  return prefs.filter((p) => !exclude.has(p.key) && (!n || norm(p.name).split(' ').some((w) => w.startsWith(n)) || norm(p.name).startsWith(n)))
    .sort((a, b) => (n ? Number(norm(b.name).startsWith(n)) - Number(norm(a.name).startsWith(n)) : 0) || score(b) - score(a)).slice(0, k);
}

/** Passo do stepper por unidade. */
export function step(qty: number | null | undefined, unit: Unit | null | undefined, dir: 1 | -1): number | null {
  const u = unit ?? 'un'; const d = u === 'g' ? 100 : u === 'kg' || u === 'L' ? 0.5 : 1;
  const v = Math.round(((qty ?? (dir > 0 ? 0 : d)) + dir * d) * 100) / 100;
  return v <= 0 ? null : v;
}
export const qtyText = (qty: number | null | undefined, unit: Unit | null | undefined) => qty == null ? '' : `${String(qty).replace('.', ',')} ${unit ?? 'un'}`;

const NUM: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12, meia: 0.5, meio: 0.5 };
const UNIT_W: [RegExp, Unit][] = [[/^(quilos?|kg|quilogramas?)$/, 'kg'], [/^(gramas?|g)$/, 'g'], [/^(litros?|l)$/, 'L'], [/^(packs?|embalagens?|pacotes?|caixas?|duzias?)$/, 'pack'], [/^(unidades?|un)$/, 'un']];
/** «leite, ovos e 2 pacotes de fraldas» → itens com quantidade/unidade se ditos. */
export function parseList(raw: string): { name: string; qty: number | null; unit: Unit | null }[] {
  return raw.split(/,|;|\s+e\s+|\s+mais\s+|\n/i).map((s) => s.trim()).filter(Boolean).map((s) => {
    const w = s.split(/\s+/); let qty: number | null = null, unit: Unit | null = null;
    const n0 = norm(w[0] ?? '');
    if (/^\d+([.,]\d+)?$/.test(w[0])) { qty = Number(w[0].replace(',', '.')); w.shift(); } else if (NUM[n0] != null) { qty = NUM[n0]; w.shift(); }
    if (qty != null && w.length > 1) { const u = UNIT_W.find(([r]) => r.test(norm(w[0]))); if (u) { unit = u[1]; if (/^duzias?$/.test(norm(w[0]))) { unit = 'un'; qty *= 12; } w.shift(); } }
    if (w.length > 1 && /^(de|do|da)$/i.test(w[0])) w.shift();
    const name = w.join(' ').replace(/^(de|do|da)\s+/i, '').trim();
    return { name: name ? name[0].toUpperCase() + name.slice(1) : '', qty, unit: qty != null ? unit ?? 'un' : null };
  }).filter((x) => x.name.length > 1);
}

/** Linhas do talão com preço → preço por item da lista (fuzzy: 1.ª palavra ≥4 letras). */
export function matchReceiptLines(text: string, names: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const lines = text.split('\n').map((l) => ({ n: norm(l), m: l.match(/(\d+)[.,](\d{2})\s*[A-Z€]?\s*$/) })).filter((l) => l.m);
  for (const name of names) {
    const ws = norm(name).split(' ').filter((w) => w.length >= 4); if (!ws.length) continue;
    const hit = lines.find((l) => ws.some((w) => l.n.includes(w.slice(0, Math.max(4, w.length - 1)))));
    if (hit) out[name] = Number(hit.m![1]) * 100 + Number(hit.m![2]);
  }
  return out;
}

/** Total estimado: preço habitual × quantidade (kg/L/un); itens sem preço contados à parte. */
export function estimate(items: { name: string; qty?: number | null; unit?: Unit | null; price_cents?: number | null }[], prices: Record<string, number | null | undefined>) {
  let total = 0, known = 0;
  for (const i of items) { const p = i.price_cents ?? prices[keyOf(i.name)]; if (p == null) continue; known++; const m = i.unit === 'g' ? 1 : (i.qty ?? 1); total += Math.round(p * (i.unit === 'g' ? 1 : m)); }
  return { total, known, missing: items.length - known };
}
