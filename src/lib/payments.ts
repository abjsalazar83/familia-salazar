// Pagamentos recorrentes: datas, preços em vigor, «por lançar». Lógica pura.
export type Period = 'mensal' | 'bimestral' | 'trimestral' | 'anual';
export type Payment = {
  id: string; family_id: string; name: string; amount_cents: number | null; period: Period; next_date: string | null;
  payer: string | null; account: string | null; note: string | null;
  new_amount_cents: number | null; new_period: Period | null; new_from: string | null; is_deleted: boolean;
  // v7 (opcionais: a app funciona antes da migração)
  kind?: 'conjunta' | 'pessoal'; split?: PaySplit; category?: string; owner_member?: string | null; last_posted?: string | null; expense_id?: string | null;
  // v16: valor muda todos os meses → fica sempre por confirmar
  variable?: boolean;
};
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

export type PostItem = { p: Payment; date: string; amount: number | null; hint?: number | null };
type PostedExp = { payment_id?: string | null; payment_due?: string | null; is_deleted: boolean; amount_cents?: number; date?: string; description?: string; review?: string | null };
/** Sugestão para um fixo variável: o último valor lançado desse pagamento; senão o valor do modelo. */
export function lastValue(p: Payment, exps: PostedExp[]): number | null {
  const own = exps.filter((e) => e && !e.is_deleted && e.payment_id === p.id && e.amount_cents != null).sort((a, b) => (b.payment_due ?? b.date ?? '').localeCompare(a.payment_due ?? a.date ?? ''));
  if (own[0]) return own[0].amount_cents!;
  // antes de ser lançado pela app: a última despesa com o mesmo nome (ex.: «SAD» de 31/10)
  const n = p.name.trim().toLowerCase();
  const same = exps.filter((e) => e && !e.is_deleted && !e.review && e.amount_cents != null && e.description?.trim().toLowerCase() === n).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return same[0]?.amount_cents ?? p.amount_cents;
}
/** Fixos de valor certo que este dispositivo lança sozinho: valor conhecido, não variável, e quem paga sou eu. */
export const autoPost = (x: PostItem, me: string) => !x.p.variable && x.amount != null && x.amount > 0 && x.p.owner_member === me;
export function porLancar(ps: Payment[], exps: PostedExp[], today: string): PostItem[] {
  if (!hasV7(ps)) return [];
  const posted = new Set(exps.filter((e) => e && !e.is_deleted && e.payment_id).map((e) => e.payment_id + '|' + e.payment_due));
  return ps.flatMap((p) => duePosts(p, today, posted).map((date) => p.variable ? { p, date, amount: null, hint: lastValue(p, exps) } : { p, date, amount: termsAt(p, date).amount }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.p.name.localeCompare(b.p.name));
}

/** Linha de despesa a criar a partir de uma ocorrência. Conjunta → partilhada 50/50 (entra no acerto); pessoal → só do dono. */
/** Divisão de um pagamento conjunto: metade cada, ou o outro paga tudo (ex.: despesa de saúde de um, paga pelo outro). */
export type PaySplit = '50/50' | 'outro100';
export function postExpense(p: Payment, date: string, amount: number, memberIds: string[], me: string) {
  const pessoal = p.kind === 'pessoal';
  const payer = (p.owner_member && memberIds.includes(p.owner_member)) ? p.owner_member : me;
  const other = memberIds.find((m) => m !== payer);
  const full = p.split === 'outro100';
  const half = full ? amount : Math.round(amount / 2);
  const shares: Record<string, number> = pessoal || !other ? {} : { [payer]: amount - half, [other]: half };
  return { amount_cents: amount, description: p.name, category: p.category || 'Casa', paid_by: payer, type: pessoal || !other ? 'pessoal' as const : 'partilhada' as const,
    split_mode: (full && !pessoal && other ? 'personalizada' : '50/50') as '50/50' | 'personalizada', shares, date, payment_id: p.id, payment_due: date };
}
/** Total mensal equivalente: conjunto e de cada pessoa (pessoais). */
export function monthlyTotals(ps: Payment[], today: string) {
  const t = { conjunta: 0, pessoal: {} as Record<string, number> };
  for (const p of ps) { if (p.is_deleted) continue; const m = monthlyEq(p, today) ?? 0;
    if (p.kind === 'pessoal' && p.owner_member) t.pessoal[p.owner_member] = (t.pessoal[p.owner_member] ?? 0) + m; else t.conjunta += m; }
  return t;
}
