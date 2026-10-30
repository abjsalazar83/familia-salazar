// Lógica pura: pagamentos recorrentes, fecho de mês e poupança. Sem rede, testável.
export type Period = 'mensal' | 'bimestral' | 'trimestral' | 'anual';
export type Payment = {
  id: string; family_id: string; name: string; amount_cents: number | null; period: Period; next_date: string | null;
  payer: string | null; account: string | null; note: string | null;
  new_amount_cents: number | null; new_period: Period | null; new_from: string | null; is_deleted: boolean;
  // v7 (opcionais: a app funciona antes da migração)
  kind?: 'conjunta' | 'pessoal'; split?: '50/50'; category?: string; owner_member?: string | null; last_posted?: string | null; expense_id?: string | null;
};
export type Income = { id: string; family_id: string; member_id: string; ym: string; amount_cents: number; note: string | null; is_deleted: boolean };
export type MonthClose = {
  id: string; family_id: string; ym: string; creditor: string | null; debtor: string | null; lists: Record<string, unknown>;
  diff_cents: number; paid_cents: number; carry_cents: number; settlement_id: string | null; is_deleted: boolean; closed_at: string;
};
export type Settings = { family_id: string; savings_goal_cents: number; notify_days: number };

export const MBWAY_MAX = 75000;
const STEP: Record<Period, number> = { mensal: 1, bimestral: 2, trimestral: 3, anual: 12 };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addMonths = (s: string, n: number) => {
  const d = parse(s); const day = d.getDate(); const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate())); return iso(r);
};
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

/** Preço e periodicidade em vigor numa data (com mudança de preço a partir de new_from). */
export function termsAt(p: Payment, date: string): { amount: number | null; period: Period } {
  if (p.new_from && date >= p.new_from) return { amount: p.new_amount_cents ?? p.amount_cents, period: p.new_period ?? p.period };
  return { amount: p.amount_cents, period: p.period };
}
/** Próxima data ≥ hoje (avança pela periodicidade). */
export function nextDue(p: Payment, today: string): string | null {
  if (!p.next_date) return null;
  let d = p.next_date; let guard = 0;
  while (d < today && guard++ < 600) d = addMonths(d, STEP[termsAt(p, d).period]);
  return d;
}
export type Upcoming = { p: Payment; date: string | null; days: number | null; amount: number | null; soon: boolean; changes: boolean };
export function upcoming(ps: Payment[], today: string, soonDays = 7): Upcoming[] {
  return ps.filter((p) => p && !p.is_deleted).map((p) => {
    const date = nextDue(p, today); const days = date ? daysBetween(today, date) : null;
    const t = date ? termsAt(p, date) : { amount: p.amount_cents };
    return { p, date, days, amount: t.amount, soon: days != null && days <= soonDays, changes: !!(p.new_from && date && date <= p.new_from && daysBetween(date, p.new_from) <= 100) };
  }).sort((a, b) => (a.date == null ? 1 : 0) - (b.date == null ? 1 : 0) || (a.date ?? '').localeCompare(b.date ?? '') || a.p.name.localeCompare(b.p.name));
}
/** Custo mensal equivalente (ao preço em vigor hoje). */
export const monthlyEq = (p: Payment, today: string) => { const t = termsAt(p, today); return t.amount == null ? null : Math.round(t.amount / STEP[t.period]); };

/** Lista (já a metade) de cada pessoa: o que pagou por conta dos outros nas despesas partilhadas do mês. */
export function halvedLists(members: string[], exps: { paid_by: string; amount_cents: number; shares: Record<string, number> | null; date: string; is_deleted: boolean; type?: string }[], ym: string, incomes: { amount_cents: number | null; received_by: string; receiver_pct: number; is_deleted: boolean; date: string }[] = []) {
  const out: Record<string, number> = Object.fromEntries(members.map((m) => [m, 0]));
  // Receita partilhada: a parte do outro entra na lista de quem tem a receber (o não-recebedor).
  for (const i of incomes) {
    if (!i || i.is_deleted || i.amount_cents == null || !i.date?.startsWith(ym) || members.length !== 2 || !(i.received_by in out)) continue;
    const other = members.find((m) => m !== i.received_by)!;
    out[other] += i.amount_cents - Math.round((i.amount_cents * (i.receiver_pct ?? 50)) / 100);
  }
  for (const e of exps) {
    if (!e || e.is_deleted || e.type === 'pessoal' || typeof e.date !== 'string' || !e.date.startsWith(ym) || !(e.paid_by in out)) continue;
    const own = e.shares?.[e.paid_by] ?? Math.round(e.amount_cents / 2);
    out[e.paid_by] += (Number(e.amount_cents) || 0) - own;
  }
  return out;
}
export type CloseCalc = { creditor: string | null; debtor: string | null; diff: number; paid: number; carry: number };
/** Acerto = diferença das listas; MB WAY máx. 750 € por transferência; o resto passa como «mês X» na lista do credor. */
export function closeCalc(lists: Record<string, number>): CloseCalc {
  const ids = Object.keys(lists); if (ids.length < 2) return { creditor: null, debtor: null, diff: 0, paid: 0, carry: 0 };
  const [a, b] = ids; const d = lists[a] - lists[b];
  if (d === 0) return { creditor: null, debtor: null, diff: 0, paid: 0, carry: 0 };
  const diff = Math.abs(d); const paid = Math.min(diff, MBWAY_MAX);
  return { creditor: d > 0 ? a : b, debtor: d > 0 ? b : a, diff, paid, carry: diff - paid };
}
export const prevYm = (ym: string) => addMonths(ym + '-01', -1).slice(0, 7);
export const nextYm = (ym: string) => addMonths(ym + '-01', 1).slice(0, 7);
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesNome = (ym: string) => MES[Number(ym.slice(5, 7)) - 1];

export function closeMessage(ym: string, names: Record<string, string>, lists: Record<string, number>, c: CloseCalc, fmt: (c: number) => string) {
  const ls = Object.entries(lists).map(([k, v]) => `${names[k]}: ${fmt(v)}`).join(' · ');
  if (!c.debtor) return `Acerto de ${mesNome(ym)}: ${ls}. Estamos quites 🙂`;
  return `Acerto de ${mesNome(ym)}: ${ls}. ${names[c.debtor]} → ${names[c.creditor!]}: ${fmt(c.paid)} por MB WAY.` +
    (c.carry > 0 ? ` Os ${fmt(c.carry)} que sobram passam para ${mesNome(nextYm(ym))} (linha «mês ${mesNome(ym)}»).` : '');
}

export type SavingsState = { income: number; spent: number; projected: number; leftover: number; projectedLeftover: number; goal: number; ratio: number; status: 'ok' | 'risco' | 'sem-dados' };
export function savings(income: number, spent: number, projected: number, goal: number): SavingsState {
  if (!income) return { income, spent, projected, leftover: 0, projectedLeftover: 0, goal, ratio: 0, status: 'sem-dados' };
  const leftover = income - spent, projectedLeftover = income - projected;
  return { income, spent, projected, leftover, projectedLeftover, goal, ratio: goal > 0 ? Math.max(0, projectedLeftover) / goal : 1, status: projectedLeftover >= goal ? 'ok' : 'risco' };
}

/** A tabela já tem as colunas da v7? (antes da migração, «por lançar» fica escondido) */
export const hasV7 = (ps: Payment[]) => ps.length > 0 && ps.every((p) => 'kind' in p);

/** Ocorrências vencidas (≤ hoje) ainda não lançadas. Só olha para trás `lookback` dias, para não inundar ao ativar. */
export function duePosts(p: Payment, today: string, posted: Set<string>, lookback = 40): string[] {
  if (!p || p.is_deleted || !p.next_date) return [];
  const floor = addDays(today, -lookback); const out: string[] = [];
  // next_date = primeira ocorrência a seguir (as anteriores já estavam pagas antes de a app as seguir)
  let d = p.next_date; let g = 0;
  while (d <= today && g++ < 400) {
    if (d > floor && (!p.last_posted || d > p.last_posted) && !posted.has(p.id + '|' + d)) out.push(d);
    d = addMonths(d, STEP[termsAt(p, d).period]);
  }
  return out;
}
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

export type PostItem = { p: Payment; date: string; amount: number | null };
export function porLancar(ps: Payment[], exps: { payment_id?: string | null; payment_due?: string | null; is_deleted: boolean }[], today: string): PostItem[] {
  if (!hasV7(ps)) return [];
  const posted = new Set(exps.filter((e) => e && !e.is_deleted && e.payment_id).map((e) => e.payment_id + '|' + e.payment_due));
  return ps.flatMap((p) => duePosts(p, today, posted).map((date) => ({ p, date, amount: termsAt(p, date).amount })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.p.name.localeCompare(b.p.name));
}

/** Linha de despesa a criar a partir de uma ocorrência. Conjunta → partilhada 50/50 (entra no acerto); pessoal → só do dono. */
export function postExpense(p: Payment, date: string, amount: number, memberIds: string[], me: string) {
  const pessoal = p.kind === 'pessoal';
  const payer = (p.owner_member && memberIds.includes(p.owner_member)) ? p.owner_member : me;
  const other = memberIds.find((m) => m !== payer);
  const half = Math.round(amount / 2);
  const shares: Record<string, number> = pessoal || !other ? {} : { [payer]: amount - half, [other]: half };
  return { amount_cents: amount, description: p.name, category: p.category || 'Casa', paid_by: payer, type: pessoal || !other ? 'pessoal' as const : 'partilhada' as const,
    split_mode: '50/50' as const, shares, date, payment_id: p.id, payment_due: date };
}
/** Total mensal equivalente: conjunto e de cada pessoa (pessoais). */
export function monthlyTotals(ps: Payment[], today: string) {
  const t = { conjunta: 0, pessoal: {} as Record<string, number> };
  for (const p of ps) { if (p.is_deleted) continue; const m = monthlyEq(p, today) ?? 0;
    if (p.kind === 'pessoal' && p.owner_member) t.pessoal[p.owner_member] = (t.pessoal[p.owner_member] ?? 0) + m; else t.conjunta += m; }
  return t;
}
