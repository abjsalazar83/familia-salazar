// Receitas partilhadas (abono, reembolsos, IRS…): quem recebe deve a parte do outro. Cêntimos inteiros, sem rede.
export const INCOME_CATS = ['Abono', 'Reembolso', 'IRS', 'Outro'] as const;
export type IncomeCat = typeof INCOME_CATS[number];
export type SharedIncome = {
  id: string; family_id: string; amount_cents: number | null; received_by: string; category: IncomeCat; date: string;
  note: string | null; receiver_pct: number; rule_id: string | null; ym: string | null;
  confirmed_by: string | null; confirmed_at: string | null; is_deleted: boolean; created_at: string;
};
export type IncomeRule = {
  id: string; family_id: string; name: string; category: IncomeCat; received_by: string; receiver_pct: number;
  day: number; active: boolean; is_deleted: boolean; created_at: string;
};
type IncomeLike = Pick<SharedIncome, 'amount_cents' | 'received_by' | 'receiver_pct' | 'is_deleted'>;

/** Quanto o recebedor deve ao outro (parte do outro). Sem valor ou retirada → 0. */
export function otherShare(i: IncomeLike): number {
  if (i.is_deleted || i.amount_cents == null || i.amount_cents <= 0) return 0;
  const pct = Math.min(100, Math.max(0, Number.isFinite(i.receiver_pct) ? i.receiver_pct : 50));
  return i.amount_cents - Math.round((i.amount_cents * pct) / 100);
}
/** Efeito no acerto do ponto de vista de `me`: + o outro deve-me, − eu devo. */
export function incomeEffect(i: IncomeLike, me: string): number {
  const s = otherShare(i); return i.received_by === me ? -s : s;
}
/** Soma ao `net` (positivo = tem a receber): o recebedor deve, o outro recebe. Só para 2 pessoas. */
export function applyIncomes(net: Record<string, number>, incomes: IncomeLike[]) {
  const ids = Object.keys(net);
  for (const i of incomes) {
    const s = otherShare(i); if (!s || !(i.received_by in net) || ids.length !== 2) continue;
    const other = ids.find((m) => m !== i.received_by)!;
    net[i.received_by] -= s; net[other] += s;
  }
  return net;
}
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
/** Entradas pendentes (sem valor) que faltam criar este mês para as receitas fixas ativas. Idempotente por (regra, mês). */
export function dueIncomeEntries(rules: IncomeRule[], incomes: Pick<SharedIncome, 'rule_id' | 'ym'>[], ym: string): Omit<SharedIncome, 'id' | 'created_at'>[] {
  const have = new Set(incomes.filter((i) => i.rule_id).map((i) => i.rule_id + '|' + i.ym));
  return rules.filter((r) => r.active && !r.is_deleted && !have.has(r.id + '|' + ym)).map((r) => ({
    family_id: r.family_id, amount_cents: null, received_by: r.received_by, category: r.category,
    date: `${ym}-${pad(Math.min(Math.max(1, r.day || 1), lastDay(ym)))}`, note: r.name, receiver_pct: r.receiver_pct,
    rule_id: r.id, ym, confirmed_by: null, confirmed_at: null, is_deleted: false,
  }));
}
/** Total do mês e a parte que passa para o outro (para o resumo). */
export function incomeMonth(incomes: SharedIncome[], ym: string) {
  let total = 0, owed = 0, pending = 0;
  for (const i of incomes) {
    if (i.is_deleted || !i.date.startsWith(ym)) continue;
    if (i.amount_cents == null) { pending++; continue; }
    total += i.amount_cents; owed += otherShare(i);
  }
  return { total, owed, pending };
}
