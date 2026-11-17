// «Natal 🎄»: época de Natal (compras de set. a jan.), total, conjunta vs pessoal, quem pagou e orçamento opcional.
// As despesas Natal são despesas normais: entram no mês e no acerto como as outras.
export const NATAL = 'Natal';
type Exp = { category: string; amount_cents: number; date: string; is_deleted: boolean; type: 'pessoal' | 'partilhada'; paid_by: string };
export type Season = { year: number; from: string; to: string };
export type NatalSum = { season: Season; total: number; shared: number; personal: number; count: number; paid: Record<string, number>; budget: number | null; left: number | null; ratio: number | null };

/** Época de Natal do dia `today` (AAAA-MM-DD): set.–dez. → esse ano; janeiro → ano anterior; fev.–ago. → nenhuma. */
export function seasonOf(today: string): Season | null {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const year = m >= 9 ? y : m === 1 ? y - 1 : null;
  return year == null ? null : { year, from: `${year}-09-01`, to: `${year + 1}-01-31` };
}
/** Janela de destaque: 1/nov a 15/jan. */
export const inWindow = (today: string) => { const md = today.slice(5, 10); return md >= '11-01' || md <= '01-15'; };

export const isNatal = (e: Pick<Exp, 'category'>) => e.category === NATAL;

/** Orçamento da época (só conta se foi definido para esta época). */
export function seasonBudget(st: { natal_budget_cents?: number | null; natal_budget_year?: number | null } | null | undefined, s: Season): number | null {
  return st && st.natal_budget_year === s.year && st.natal_budget_cents != null && st.natal_budget_cents > 0 ? Number(st.natal_budget_cents) : null;
}

export function natalSummary(exps: Exp[], today: string, budget: number | null): NatalSum | null {
  const season = seasonOf(today); if (!season) return null;
  const xs = exps.filter((e) => e && !e.is_deleted && isNatal(e) && e.date >= season.from && e.date <= season.to);
  const paid: Record<string, number> = {}; let shared = 0, personal = 0;
  for (const e of xs) { const v = Number(e.amount_cents) || 0; paid[e.paid_by] = (paid[e.paid_by] ?? 0) + v; if (e.type === 'partilhada') shared += v; else personal += v; }
  const total = shared + personal;
  return { season, total, shared, personal, count: xs.length, paid, budget, left: budget == null ? null : budget - total, ratio: budget ? total / budget : null };
}

/** O cartão aparece de 1/nov a 15/jan, ou fora disso quando a época tem despesas Natal. */
export const showNatal = (s: NatalSum | null, today: string) => !!s && (inWindow(today) || s.count > 0);
