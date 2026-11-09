// «Meninas & escola»: custo mensal por subcategoria (refeições, material, atividades, roupa).
export const KIDS = 'Meninas & escola';
export const SUBCATS = ['refeições', 'material', 'atividades', 'roupa'] as const;
export type Subcat = typeof SUBCATS[number];
/** Categorias antigas que contam como «Meninas & escola» (histórico e lançamentos anteriores). */
export const KIDS_ALIASES = [KIDS, 'Escola', 'Filhos/escola'];
export const isKids = (cat?: string | null) => !!cat && KIDS_ALIASES.includes(cat);

type Exp = { category: string; subcat?: string | null; amount_cents: number; date: string; is_deleted: boolean; type?: string; trip_id?: string | null };
export type KidsMonth = { ym: string; total: number; by: Record<Subcat | 'sem subcategoria', number>; fromHistory?: boolean };
type Hist = { ym: string; cats: Record<string, number>; provisional?: boolean };

/** Últimos `n` meses (até `ym`, inclusive) com o total e a divisão por subcategoria. Inclui despesas pessoais (custos das meninas). */
/** Meses sem lançamentos na app usam o histórico (categoria «Filhos/escola»), sem subcategoria. */
export function kidsMonths(exps: Exp[], ym: string, n = 6, hist: Hist[] = []): KidsMonth[] {
  const yms: string[] = []; const [y, m] = ym.split('-').map(Number);
  for (let k = n - 1; k >= 0; k--) { const d = new Date(Date.UTC(y, m - 1 - k, 1)); yms.push(d.toISOString().slice(0, 7)); }
  return yms.map((x) => {
    const by = { 'refeições': 0, material: 0, atividades: 0, roupa: 0, 'sem subcategoria': 0 } as KidsMonth['by'];
    let total = 0;
    for (const e of exps) {
      if (!e || e.is_deleted || e.trip_id || !isKids(e.category) || !e.date?.startsWith(x)) continue;
      const k = (SUBCATS as readonly string[]).includes(e.subcat ?? '') ? (e.subcat as Subcat) : 'sem subcategoria';
      by[k] += e.amount_cents; total += e.amount_cents;
    }
    const h = hist.find((m) => m && m.ym === x);
    const hv = h ? KIDS_ALIASES.reduce((s2, c) => s2 + (Number(h.cats?.[c]) || 0), 0) : 0;
    if (!total && hv > 0) return { ym: x, total: hv, by: { ...by, 'sem subcategoria': hv }, fromHistory: true };
    return { ym: x, total, by };
  });
}
/** Média mensal dos meses com gastos (para comparar o mês corrente). */
export const kidsAvg = (ms: KidsMonth[]) => { const xs = ms.filter((m) => m.total > 0); return xs.length ? Math.round(xs.reduce((s, m) => s + m.total, 0) / xs.length) : null; };
