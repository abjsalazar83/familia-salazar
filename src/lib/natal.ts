// «Natal 🎄»: época de Natal (compras de set. a jan.) e orçamento antigo por época. O cartão é o de Eventos (lib/events.ts, fs-v46).
// As despesas Natal são despesas normais: entram no mês e no acerto como as outras.
export const NATAL = 'Natal';
export type Season = { year: number; from: string; to: string };

/** Época de Natal do dia `today` (AAAA-MM-DD): set.–dez. → esse ano; janeiro → ano anterior; fev.–ago. → nenhuma. */
export function seasonOf(today: string): Season | null {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const year = m >= 9 ? y : m === 1 ? y - 1 : null;
  return year == null ? null : { year, from: `${year}-09-01`, to: `${year + 1}-01-31` };
}
/** Janela de destaque: 1/nov a 15/jan. */
export const inWindow = (today: string) => { const md = today.slice(5, 10); return md >= '11-01' || md <= '01-15'; };

/** Orçamento da época (só conta se foi definido para esta época). */
export function seasonBudget(st: { natal_budget_cents?: number | null; natal_budget_year?: number | null } | null | undefined, s: Season): number | null {
  return st && st.natal_budget_year === s.year && st.natal_budget_cents != null && st.natal_budget_cents > 0 ? Number(st.natal_budget_cents) : null;
}
