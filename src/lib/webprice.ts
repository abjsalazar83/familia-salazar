// Preços de referência da internet (Open Prices / Open Food Facts, dados abertos ODbL).
// Só sugere: o utilizador escolhe a correspondência certa por item. Sem correspondência → nada.
export type WebPrice = { id: string; name: string; terms: string; store: string | null; city: string | null; country?: string | null; chain?: 'mercadona' | 'lidl' | null; price_cents: number; base: 'kg' | 'L' | 'un' | null; unit_price_cents: number | null; seen_on: string | null; url: string | null };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
// Português → termos das categorias do Open Food Facts (em inglês) e nomes noutras línguas comuns nas lojas.
const SYN: Record<string, string[]> = {
  banana: ['banana'], leite: ['milk', 'leche', 'milch'], ovo: ['egg', 'huevo'], pao: ['bread', 'pan '], maca: ['apple', 'manzana'], arroz: ['rice'], massa: ['pasta'],
  azeite: ['olive oil'], oleo: ['oil'], frango: ['chicken', 'pollo'], batata: ['potato', 'patata'], tomate: ['tomato'], cebola: ['onion', 'cebolla'], queijo: ['cheese', 'queso'],
  iogurte: ['yogurt', 'yoghurt'], cafe: ['coffee'], acucar: ['sugar'], manteiga: ['butter'], cenoura: ['carrot'], laranja: ['orange'], agua: ['water'], atum: ['tuna'],
  fiambre: ['ham'], farinha: ['flour'], cha: ['tea'], chocolate: ['chocolate'], cereais: ['cereal'], bolacha: ['biscuit', 'cookie'], alface: ['lettuce'], pera: ['pear'],
  limao: ['lemon'], morango: ['strawberr'], sal: ['salt'], feijao: ['bean'], grao: ['chickpea'], sumo: ['juice'], vinho: ['wine'], cerveja: ['beer'], detergente: ['detergent'],
};
const STOP = new Set(['de', 'do', 'da', 'com', 'sem', 'e', 'a', 'o', 'para']);
const stem = (w: string) => (w.length > 3 ? w.replace(/(oes|aes|es|s)$/, (m) => (m === 'oes' ? 'ao' : m === 'aes' ? 'ao' : m === 'es' && /[rlz]es$/.test(w) ? '' : m === 's' ? '' : m)) : w);

/** Até `n` correspondências (todas as palavras do item têm de aparecer), mais recentes e com preço unitário primeiro. */
export function webMatches(itemName: string, rows: WebPrice[], n = 3): WebPrice[] {
  const ws = norm(itemName).split(' ').filter((w) => w && !STOP.has(w)).map(stem);
  if (!ws.length) return [];
  const alts = ws.map((w) => [w, ...(SYN[w] ?? [])]);
  const hit = (t: string, a: string) => new RegExp(`(^| )${a.trim()}`).test(t);
  return rows.filter((r) => alts.every((a) => a.some((x) => hit(r.terms, x))))
    .sort((a, b) => Number(b.unit_price_cents != null) - Number(a.unit_price_cents != null) || (b.seen_on ?? '').localeCompare(a.seen_on ?? ''))
    .slice(0, n);
}

/** Preço a mostrar: o unitário (€/kg, €/L, €/un) se a loja o indica; senão o preço da embalagem. */
export function webShown(r: WebPrice): { cents: number; base: 'kg' | 'L' | 'un' | null } {
  return r.unit_price_cents != null ? { cents: r.unit_price_cents, base: r.base } : { cents: r.price_cents, base: null };
}

/** «hoje», «ontem», «há 5 dias» ou dd/mm/aaaa. */
export function when(d: string | null, today = new Date()): string {
  if (!d) return '';
  const days = Math.round((Date.parse(today.toISOString().slice(0, 10)) - Date.parse(d)) / 864e5);
  return days <= 0 ? 'hoje' : days === 1 ? 'ontem' : days < 30 ? `há ${days} dias` : d.split('-').reverse().join('/');
}
