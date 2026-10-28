import { eur } from './money';
import type { HistoryMonth } from './types';

/** Meses fechados (não provisórios), do mais antigo ao mais recente. */
export const closed = (ms: HistoryMonth[]) => ms.filter((m) => !m.provisional).sort((a, b) => a.ym.localeCompare(b.ym));

/** Médias mensais dos últimos n meses fechados. */
export function averages(ms: HistoryMonth[], n = 12) {
  const last = closed(ms).slice(-n);
  if (!last.length) return null;
  const k = last.length;
  const total = last.reduce((s, m) => s + m.total_cents, 0);
  const extra = last.reduce((s, m) => s + m.extra_cents, 0);
  const cats: Record<string, number> = {};
  for (const m of last) for (const [c, v] of Object.entries(m.cats || {})) cats[c] = (cats[c] ?? 0) + v;
  const byCat = Object.entries(cats).map(([c, v]) => [c, Math.round(v / k)] as [string, number]).sort((a, b) => b[1] - a[1]);
  return { months: k, from: last[0].ym, to: last[k - 1].ym, total: Math.round(total / k), noExtra: Math.round((total - extra) / k), byCat };
}

/** Média mensal por ano (meses fechados). */
export function yearly(ms: HistoryMonth[]) {
  const y: Record<string, { s: number; n: number }> = {};
  for (const m of closed(ms)) { const k = m.ym.slice(0, 4); (y[k] ??= { s: 0, n: 0 }); y[k].s += m.total_cents; y[k].n++; }
  return Object.entries(y).map(([year, v]) => ({ year, avg: Math.round(v.s / v.n), n: v.n }));
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const ymLabel = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

/** Custo mensal equivalente de uma conta recorrente. */
export function monthly(cents: number | null, period: string) {
  if (cents == null) return null;
  const d = { mensal: 1, bimestral: 2, trimestral: 3, anual: 12 }[period as 'mensal'] ?? 1;
  return Math.round(cents / d);
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const catAvg = (ms: HistoryMonth[]) => {
  const t: Record<string, number> = {};
  for (const m of ms) for (const [c, v] of Object.entries(m.cats || {})) t[c] = (t[c] ?? 0) + v;
  for (const c in t) t[c] = Math.round(t[c] / Math.max(1, ms.length));
  return t;
};

export type CatCost = { cat: string; month: number; year: number; pct: number; trend: number | null };
/** Custo real por categoria nos últimos n meses fechados, com tendência face aos n meses anteriores. */
export function costByCategory(ms: HistoryMonth[], n = 12): CatCost[] {
  const c = closed(ms); const cur = c.slice(-n), prev = c.slice(-2 * n, -n);
  if (!cur.length) return [];
  const a = catAvg(cur), p = prev.length ? catAvg(prev) : null;
  const tot = sum(Object.values(a)) || 1;
  return Object.entries(a).filter(([, v]) => v > 0).map(([cat, v]) => ({
    cat, month: v, year: v * 12, pct: Math.round((v / tot) * 1000) / 10,
    trend: p && p[cat] ? Math.round(((v - p[cat]) / p[cat]) * 1000) / 10 : null,
  })).sort((x, y) => y.month - x.month);
}

type BillLike = { name: string; amount_cents: number | null; period: string; estimate?: boolean };
/** Fixas = contas recorrentes não variáveis com valor (por mês). Variáveis = média mensal − fixas. */
export function fixedVsVariable(bills: BillLike[], avgMonth: number) {
  const known = bills.filter((b) => b.period !== 'variável' && b.amount_cents != null);
  const fixed = sum(known.map((b) => monthly(b.amount_cents, b.period)!));
  return { fixed, variable: Math.max(0, avgMonth - fixed), unknown: bills.filter((b) => b.amount_cents == null).length, estimated: known.some((b) => b.estimate) };
}

export type Tip = { kind: 'acima' | 'subida' | 'pico' | 'subscricoes' | 'extra'; title: string; detail: string; saving: number | null; estimate: boolean };
const SUBS = /photos|dropbox|netflix|spotify|grok|google play|icloud|disney|hbo|prime|youtube|fitness|gin[aá]sio/i;
/** Sugestões de poupança calculadas só a partir dos dados. Poupança = estimativa €/mês. */
export function savingTips(ms: HistoryMonth[], bills: BillLike[], n = 12): Tip[] {
  const c = closed(ms); const cur = c.slice(-n); if (cur.length < 3) return [];
  const tips: Tip[] = [];
  const avg = catAvg(cur), last3 = catAvg(cur.slice(-3));
  for (const [cat, v] of Object.entries(last3)) {
    const base = avg[cat] ?? 0;
    if (base > 0 && v > base * 1.1 && v - base >= 1000)
      tips.push({ kind: 'acima', title: `${cat} acima da média`, detail: `últimos 3 meses ${eur(v)} vs média ${eur(base)}`, saving: v - base, estimate: true });
  }
  for (const t of costByCategory(ms, n)) if (t.trend != null && t.trend >= 10 && !tips.some((x) => x.title.startsWith(t.cat))) {
    const prevV = Math.round(t.month / (1 + t.trend / 100));
    if (t.month - prevV >= 1000) tips.push({ kind: 'subida', title: `${t.cat} subiu ${t.trend}%`, detail: `face aos ${n} meses anteriores`, saving: t.month - prevV, estimate: true });
  }
  const tot = cur.map((m) => m.total_cents), mean = sum(tot) / tot.length;
  const sd = Math.sqrt(sum(tot.map((x) => (x - mean) ** 2)) / tot.length);
  for (const m of cur) if (m.total_cents > mean + 1.5 * sd) {
    const why = Object.entries(m.cats).map(([k, v]) => [k, v - (avg[k] ?? 0)] as [string, number]).sort((x, y) => y[1] - x[1])[0];
    tips.push({ kind: 'pico', title: `Pico em ${ymLabel(m.ym)}`, detail: why ? `sobretudo ${why[0]} (+${eur(why[1])})` : '', saving: null, estimate: false });
  }
  const subs = bills.filter((b) => SUBS.test(b.name));
  const subsM = sum(subs.map((b) => monthly(b.amount_cents, b.period) ?? 0));
  if (subs.length) tips.push({ kind: 'subscricoes', title: `Subscrições: ${subs.length}`, detail: (subsM ? `${eur(subsM)}/mês` : 'sem valor registado') + (subsM && subs.some((b) => b.amount_cents == null) ? ' · algumas sem valor' : '') + ' · rever as que não usam', saving: subsM || null, estimate: false });
  const extra = Math.round(sum(cur.map((m) => m.extra_cents)) / cur.length);
  if (extra > 0) tips.push({ kind: 'extra', title: 'Extraordinários', detail: `média por mês`, saving: extra, estimate: true });
  return tips.sort((a, b) => (b.saving ?? 0) - (a.saving ?? 0));
}

/** Supermercado por loja, a partir das despesas registadas na app (descrição). */
export function byStore(exps: { description: string; category: string; amount_cents: number; date: string; is_deleted: boolean }[], since: string) {
  const t: Record<string, number> = {};
  for (const e of exps) if (!e.is_deleted && e.category === 'Supermercado' && e.date >= since) {
    const k = (e.description.trim().split(/\s+/)[0] || '?').toLowerCase(); t[k] = (t[k] ?? 0) + e.amount_cents;
  }
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

export type PaceRow = { cat: string; spent: number; avg: number | null; proj: number; ratio: number | null; flag: boolean };
/** Mês corrente (em curso) vs média dos últimos n meses fechados: gasto até hoje, projeção ao ritmo atual. */
export function currentPace(ms: HistoryMonth[], exps: { category: string; amount_cents: number; date: string; is_deleted: boolean; type?: string }[], today: string, n = 12) {
  const ym = today.slice(0, 7), day = Number(today.slice(8, 10));
  const dim = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const last = closed(ms).filter((m) => m.ym < ym).slice(-n);
  const avgOf = (f: (m: HistoryMonth) => number) => (last.length ? Math.round(last.reduce((s, m) => s + f(m), 0) / last.length) : null);
  const by: Record<string, number> = {};
  for (const e of exps) if (!e.is_deleted && e.type !== 'pessoal' && e.date.startsWith(ym)) by[e.category] = (by[e.category] ?? 0) + e.amount_cents;
  const proj = (v: number) => Math.round((v / Math.max(1, day)) * dim);
  const row = (cat: string, spent: number, avg: number | null): PaceRow => {
    const p = proj(spent); const ratio = avg ? p / avg : null;
    return { cat, spent, avg, proj: p, ratio, flag: ratio != null && ratio > 1.2 && p - (avg ?? 0) >= 2000 };
  };
  const spent = Object.values(by).reduce((s, v) => s + v, 0);
  const total = row('total', spent, avgOf((m) => m.total_cents));
  const cats = Object.entries(by).map(([c, v]) => row(c, v, last.some((m) => c in m.cats) ? avgOf((m) => m.cats[c] ?? 0) : null))
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0) || b.spent - a.spent);
  return { ym, day, dim, total, cats };
}
