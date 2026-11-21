// fs-v46 — «Eventos»: o Natal passa a ser um tipo de evento. Aniversários, Páscoa, batizados… criados pela família (vivem no Supabase).
// As despesas de um evento são despesas normais: entram no mês e no acerto como as outras.
// Compatibilidade: as despesas com categoria «Natal» contam no evento Natal da época (como na v43), e o orçamento
// de Natal continua também em family_settings.natal_budget_cents/_year (mesmo significado).
import { NATAL, inWindow, seasonBudget, seasonOf } from './natal';

export type FamEvent = {
  id: string; family_id: string; name: string; emoji: string | null; kind: 'natal' | 'outro';
  start_date: string; end_date: string; budget_cents: number | null; is_deleted: boolean; created_at?: string;
  virtual?: boolean; // Natal sem linha na tabela (época atual, orçamento antigo)
};
type Exp = { category: string; amount_cents: number; date: string; is_deleted: boolean; type: 'pessoal' | 'partilhada'; paid_by: string; event_id?: string | null; review?: string | null };
type NatalSt = { natal_budget_cents?: number | null; natal_budget_year?: number | null } | null | undefined;

const addDays = (s: string, n: number) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/** Natal da época de `today` sem linha na tabela: usa as datas da época (set.–jan.) e o orçamento antigo. */
export function natalVirtual(today: string, st: NatalSt): FamEvent | null {
  const s = seasonOf(today); if (!s) return null;
  return { id: 'natal-' + s.year, family_id: '', name: 'Natal', emoji: '🎄', kind: 'natal', start_date: s.from, end_date: s.to, budget_cents: seasonBudget(st, s), is_deleted: false, virtual: true };
}
/** Eventos ativos na família + o Natal virtual quando ainda não há um Natal real nesta época. */
export function allEvents(evs: FamEvent[] | undefined, today: string, st: NatalSt): FamEvent[] {
  // Natal real sem orçamento próprio: usa o de family_settings dessa época (compatível com a v43)
  const real = (evs ?? []).filter((e) => e && !e.is_deleted).map((e) => e.kind === 'natal' && e.budget_cents == null
    ? { ...e, budget_cents: seasonBudget(st, { year: Number(e.start_date.slice(0, 4)), from: e.start_date, to: e.end_date }) } : e);
  const v = natalVirtual(today, st);
  const hasNatal = v && real.some((e) => e.kind === 'natal' && e.start_date <= v.end_date && e.end_date >= v.start_date);
  return [...real, ...(v && !hasNatal ? [v] : [])].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name, 'pt'));
}
/** A despesa conta neste evento? Ligação direta (event_id) ou, no Natal, a categoria «Natal» dentro da época. */
export const inEvent = (ev: FamEvent, e: Exp) => !!e && !e.is_deleted && !e.review && (
  (!!e.event_id && e.event_id === ev.id) || (ev.kind === 'natal' && !e.event_id && e.category === NATAL && e.date >= ev.start_date && e.date <= ev.end_date));

export type EventSum = { ev: FamEvent; total: number; shared: number; personal: number; count: number; paid: Record<string, number>; budget: number | null; left: number | null; ratio: number | null };
export function eventSummary(ev: FamEvent, exps: Exp[], budget: number | null = ev.budget_cents ?? null): EventSum {
  const xs = exps.filter((e) => inEvent(ev, e)); const paid: Record<string, number> = {}; let shared = 0, personal = 0;
  for (const e of xs) { const v = Number(e.amount_cents) || 0; paid[e.paid_by] = (paid[e.paid_by] ?? 0) + v; if (e.type === 'partilhada') shared += v; else personal += v; }
  const total = shared + personal; const b = budget != null && budget > 0 ? Number(budget) : null;
  return { ev, total, shared, personal, count: xs.length, paid, budget: b, left: b == null ? null : b - total, ratio: b ? total / b : null };
}
/** Atalho no lançamento: durante o evento. Natal: 1/nov–15/jan, como antes. */
export const isActive = (ev: FamEvent, today: string) => today >= ev.start_date && today <= ev.end_date && (ev.kind !== 'natal' || inWindow(today));
/** Cartão no Resumo: durante o evento, ou com despesas até 30 dias depois do fim. */
export const showCard = (s: EventSum, today: string) => isActive(s.ev, today) || (s.count > 0 && today >= s.ev.start_date && today <= addDays(s.ev.end_date, 30));
/** Chips para «O quê?»: eventos a decorrer (o Natal mexe na categoria; os outros ligam a despesa ao evento). */
export const activeChips = (evs: FamEvent[], today: string) => evs.filter((e) => isActive(e, today));
export const yearLabel = (ev: FamEvent) => ev.kind === 'natal' ? `${ev.start_date.slice(0, 4)}/${String(Number(ev.start_date.slice(0, 4)) + 1).slice(2)}` : '';
/** Modelos rápidos (sem datas nem nomes reais: a família escolhe). */
export const TEMPLATES: { name: string; emoji: string }[] = [
  { name: 'Aniversário', emoji: '🎂' }, { name: 'Páscoa', emoji: '🐣' }, { name: 'Batizado', emoji: '🕊️' }, { name: 'Casamento', emoji: '💍' }, { name: 'Festa', emoji: '🎉' },
];
export const EMOJIS = ['🎂', '🎉', '🐣', '🕊️', '💍', '🎁', '🎈', '⛪', '🎓', '🎄'];
export function validEvent(f: { name: string; start: string; end: string }): string {
  if (!f.name.trim()) return 'Dá um nome ao evento (ex.: Aniversário da Laura).';
  if (f.name.trim().length > 60) return 'Nome demasiado comprido (máx. 60).';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.start) || !/^\d{4}-\d{2}-\d{2}$/.test(f.end)) return 'Indica as datas de início e fim.';
  if (f.end < f.start) return 'A data de fim tem de ser depois do início.';
  return '';
}
