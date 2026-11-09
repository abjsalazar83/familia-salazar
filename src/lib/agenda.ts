// Calendário de pagamentos (próximos N dias) e inventário de subscrições. Lógica pura; nunca inventa valores nem datas.
import { addDays, addMonths, daysBetween, lastValue, monthlyEq, termsAt, type Payment, type Period } from './payments';

const STEP: Record<Period, number> = { mensal: 1, bimestral: 2, trimestral: 3, anual: 12 };
type Exp = Parameters<typeof lastValue>[1][number];

export type AgendaItem = {
  p: Payment; date: string; days: number;
  amount: number | null;   // valor esperado (null = por definir)
  approx: boolean;         // variável: último valor lançado, marcado «≈»
  priceChange: boolean;    // nesta data entra um preço novo
};
export type Agenda = { items: AgendaItem[]; undated: { p: Payment; missing: ('data' | 'valor')[] }[] };

/** Ocorrências entre hoje e hoje+horizon (inclusive), por ordem de data. Pagamentos sem data vão para «undated». */
export function agenda(ps: Payment[], exps: Exp[], today: string, horizon = 60): Agenda {
  const end = addDays(today, horizon); const items: AgendaItem[] = []; const undated: Agenda['undated'] = [];
  for (const p of ps) {
    if (!p || p.is_deleted) continue;
    if (!p.next_date) { const missing: ('data' | 'valor')[] = ['data']; if (p.amount_cents == null && !p.variable) missing.push('valor'); undated.push({ p, missing }); continue; }
    let d = p.next_date; let g = 0;
    while (d < today && g++ < 600) d = addMonths(d, STEP[termsAt(p, d).period]);
    g = 0;
    while (d <= end && g++ < 100) {
      const t = termsAt(p, d);
      const hint = p.variable ? lastValue(p, exps) : null;
      items.push({ p, date: d, days: daysBetween(today, d), amount: p.variable ? hint : t.amount, approx: !!p.variable && hint != null, priceChange: !!p.new_from && d === p.new_from });
      d = addMonths(d, STEP[t.period]);
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.p.name.localeCompare(b.p.name, 'pt'));
  undated.sort((a, b) => a.p.name.localeCompare(b.p.name, 'pt'));
  return { items, undated };
}

/** Lembretes na app: o que vence nos próximos `days` dias (0 = hoje). */
export const reminders = (a: Agenda, days: number) => a.items.filter((x) => x.days >= 0 && x.days <= days);

/** Soma do que tem valor conhecido; conta o que fica por definir. */
export function agendaTotal(items: AgendaItem[]) {
  let known = 0, unknown = 0, approx = false;
  for (const x of items) { if (x.amount == null) unknown++; else { known += x.amount; if (x.approx) approx = true; } }
  return { known, unknown, approx };
}

export type SubRow = { p: Payment; amount: number | null; period: Period; monthly: number | null; renewal: string | null; rise: { from: string; amount: number | null; period: Period; monthly: number | null } | null };
/** Inventário de subscrições: valor e periodicidade em vigor hoje, equivalente mensal, próxima renovação e aviso de preço novo. */
export function subscriptions(ps: Payment[], today: string): { rows: SubRow[]; monthly: number; unknown: number } {
  const rows = ps.filter((p) => p && !p.is_deleted && p.subscription).map((p): SubRow => {
    const t = termsAt(p, today);
    let renewal: string | null = null;
    if (p.next_date) { let d = p.next_date, g = 0; while (d < today && g++ < 600) d = addMonths(d, STEP[termsAt(p, d).period]); renewal = d; }
    const rise = p.new_from && p.new_from >= today && (p.new_amount_cents != null || p.new_period)
      ? { from: p.new_from, amount: p.new_amount_cents ?? p.amount_cents, period: p.new_period ?? p.period, monthly: monthlyEq(p, p.new_from) } : null;
    return { p, amount: t.amount, period: t.period, monthly: monthlyEq(p, today), renewal, rise };
  }).sort((a, b) => (b.monthly ?? -1) - (a.monthly ?? -1) || a.p.name.localeCompare(b.p.name, 'pt'));
  return { rows, monthly: rows.reduce((s, r) => s + (r.monthly ?? 0), 0), unknown: rows.filter((r) => r.monthly == null).length };
}
