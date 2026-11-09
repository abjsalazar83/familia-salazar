// Viagens: reservas já pagas (informativas) + gastos da viagem (despesas com trip_id, entram no acerto) + orçamento a bordo.
import { daysBetween } from './payments';

export type Trip = { id: string; family_id: string; name: string; start_date: string | null; end_date: string | null; budget_cents: number | null; default_split: '50/50' | 'personalizada'; note: string | null; is_deleted: boolean; created_at?: string };
export type TripItem = { id: string; family_id: string; trip_id: string; description: string; amount_cents: number | null; paid_by: string | null; split: '50/50' | 'personalizada' | null; expense_id: string | null; note: string | null; is_deleted: boolean; created_at?: string };
type Exp = { id: string; trip_id?: string | null; amount_cents: number; paid_by: string; type?: string; shares?: Record<string, number>; is_deleted: boolean; split_mode?: string };

export type TripSummary = {
  reservas: number; reservasUnknown: number;
  spent: number;                    // gastos durante a viagem (despesas ligadas, sem as reservas já lançadas)
  budget: number | null; left: number | null; ratio: number | null;
  byMember: Record<string, number>; // quanto cada um pagou dos gastos da viagem
  total: number;                    // reservas + gastos
  phase: 'antes' | 'durante' | 'depois' | 'sem-data'; days: number | null; nights: number | null;
};

export function tripSummary(t: Trip, items: TripItem[], exps: Exp[], today: string): TripSummary {
  const its = items.filter((i) => i.trip_id === t.id && !i.is_deleted);
  const linked = new Set(its.map((i) => i.expense_id).filter(Boolean) as string[]);
  const reservas = its.reduce((s, i) => s + (i.amount_cents ?? 0), 0);
  const reservasUnknown = its.filter((i) => i.amount_cents == null).length;
  const trip = exps.filter((e) => e && !e.is_deleted && e.trip_id === t.id && !linked.has(e.id));
  const spent = trip.reduce((s, e) => s + e.amount_cents, 0);
  const byMember: Record<string, number> = {};
  for (const e of trip) byMember[e.paid_by] = (byMember[e.paid_by] ?? 0) + e.amount_cents;
  const budget = t.budget_cents ?? null;
  const phase = !t.start_date ? 'sem-data' : today < t.start_date ? 'antes' : t.end_date && today > t.end_date ? 'depois' : 'durante';
  return {
    reservas, reservasUnknown, spent, budget, left: budget == null ? null : budget - spent, ratio: budget ? spent / budget : null, byMember, total: reservas + spent,
    phase, days: t.start_date ? daysBetween(today, t.start_date) : null, nights: t.start_date && t.end_date ? daysBetween(t.start_date, t.end_date) : null,
  };
}

/** Partes de um gasto da viagem: 50/50 (cêntimo a mais para quem pagou) ou a parte indicada de quem pagou. */
export function tripShares(amount: number, payer: string, other: string | null, payerShare?: number | null): Record<string, number> {
  if (!other) return {};
  const mine = payerShare != null ? Math.max(0, Math.min(amount, payerShare)) : amount - Math.floor(amount / 2);
  return { [payer]: mine, [other]: amount - mine };
}

/** Viagem a mostrar no Mês: a próxima ou a que está a decorrer (até 60 dias antes). */
export function upcomingTrip(ts: Trip[], today: string, within = 60): Trip | null {
  return ts.filter((t) => !t.is_deleted && t.start_date && (t.end_date ?? t.start_date) >= today && daysBetween(today, t.start_date) <= within)
    .sort((a, b) => a.start_date!.localeCompare(b.start_date!))[0] ?? null;
}

/** Despesa que conta no mês normal (fora de viagens). */
export const inNormalMonth = (e: { trip_id?: string | null; category?: string }) => !e.trip_id && e.category !== 'Viagem';
