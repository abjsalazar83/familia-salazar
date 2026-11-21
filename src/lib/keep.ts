// fs-v48 — «Keep»: a nota do mês como no Google Keep da família. SÓ CONSULTA: texto gerado, nunca editável.
// Regra (igual ao acerto da app, lib/settle.ts): cada bloco tem o nome de quem DEVE aquelas linhas ao outro, já a METADE.
//  · despesa partilhada paga pelo outro → linha no meu bloco com a minha parte (metade; ou a parte definida na divisão);
//  · receita partilhada que EU recebi (abono, reembolso…) → linha no meu bloco com a parte do outro (metade, ou conforme a %).
//  · total do bloco da Ana − total do bloco do outro = o que a Ana deve (se positivo) ou tem a receber (se negativo).
// Fica de fora o mesmo que no acerto: pessoais, retiradas, do extrato por rever, receitas sem valor e transferências (acertos).
import { otherShare } from './income';
import { owedToPayer, type SettleExpense } from './settle';
const prevYm = (ym: string) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
type Exp = { id?: string; amount_cents: number; description: string; paid_by: string; type: string; date: string; is_deleted: boolean; review?: string | null; created_at?: string; shares?: Record<string, number> | null };
type Inc = { amount_cents: number | null; received_by: string; receiver_pct: number; is_deleted: boolean; date: string; note?: string | null; category?: string; created_at?: string };
type Close = { ym: string; creditor: string | null; carry_cents: number; is_deleted?: boolean };
type Mem = { id: string; display_name: string };

export const keepMonth = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const parts = (c: number) => { const a = Math.abs(Math.round(c)); return { neg: c < 0, int: Math.floor(a / 100), dec: a % 100 }; };
/** Linha: «40,15» · «3» (inteiro sem casas) · «20,50». */
export const keepVal = (c: number) => { const p = parts(c); return (p.neg ? '-' : '') + p.int + (p.dec ? ',' + String(p.dec).padStart(2, '0') : ''); };
const grp = (n: number, sep: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
/** Totais: «1.270,92» (ponto nos milhares) ou «1 025,13» (espaço), sempre com 2 casas. */
export const keepTotal = (c: number, sep = '.') => { const p = parts(c); return (p.neg ? '-' : '') + grp(p.int, sep) + ',' + String(p.dec).padStart(2, '0'); };

export const keepIncluded = (e: Exp, ym: string) => !!e && !e.is_deleted && !e.review && e.type === 'partilhada' && (e.date ?? '').slice(0, 7) === ym;

/** Ordem dos blocos: a Ana primeiro (como na nota dela), depois o outro. */
export function keepOrder(ms: Mem[]): Mem[] { return [...ms].sort((a, b) => Number(!/^ana\b/i.test(a.display_name)) - Number(!/^ana\b/i.test(b.display_name))); }
/** Nome no bloco: o da Ana fica «Ana»; o outro usa a alcunha da nota Keep (por omissão «Bruno»). */
export const keepLabel = (m: Mem, alias: string) => /^ana\b/i.test(m.display_name) ? m.display_name : (alias.trim() || m.display_name);

export type KeepLine = { v: number; d: string; date: string; at: string };
export type KeepBlock = { m: Mem; label: string; lines: KeepLine[]; total: number };
/** Blocos a metade. Usa owedToPayer/otherShare do motor do acerto, por isso a diferença é exatamente o acerto do mês. */
export function keepBlocks(exps: Exp[], ms: Mem[], ym: string, alias = 'Bruno', incomes: Inc[] = [], closes: Close[] = []): KeepBlock[] {
  const ids = ms.map((m) => m.id); const two = ids.length === 2;
  const lines: Record<string, KeepLine[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const e of exps) {
    if (!keepIncluded(e, ym) || !ids.includes(e.paid_by)) continue;
    for (const [who, c] of Object.entries(owedToPayer(e as SettleExpense, ids))) if (c && lines[who]) lines[who].push({ v: c, d: e.description.trim(), date: e.date, at: e.created_at ?? '' });
  }
  if (two) for (const i of incomes) {
    if (i.is_deleted || !(i.date ?? '').startsWith(ym) || !ids.includes(i.received_by)) continue;
    const c = otherShare(i as never); if (c) lines[i.received_by].push({ v: c, d: (i.note?.trim() || (i.category ?? 'receita').toLowerCase()), date: i.date, at: i.created_at ?? '' });
  }
  // Restos antigos de um fecho anterior (o fecho atual paga sempre a totalidade, por isso hoje é sempre 0) — como no «Saldar mês».
  const carry = closes.find((c) => !c.is_deleted && c.ym === prevYm(ym) && c.carry_cents > 0 && c.creditor && ids.includes(c.creditor));
  if (carry && two) { const debtor = ids.find((x) => x !== carry.creditor)!; lines[debtor].unshift({ v: carry.carry_cents, d: `mês ${MESES[Number(prevYm(ym).slice(5, 7)) - 1].toLowerCase()}`, date: ym + '-01', at: '' }); }
  return keepOrder(ms).map((m) => { const ls = lines[m.id].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at)); return { m, label: keepLabel(m, alias), lines: ls, total: ls.reduce((s, l) => s + l.v, 0) }; });
}
/** Última linha, em palavras: quem deve a quem. */
export function keepVerdict(bs: KeepBlock[]): string {
  if (bs.length < 2) return '';
  const d = bs[0].total - bs[1].total; if (!d) return 'Contas certas: ninguém deve nada.';
  const [from, to] = d > 0 ? [bs[0], bs[1]] : [bs[1], bs[0]];
  return `${from.label} deve ${keepTotal(Math.abs(d), ' ')} € a ${to.label}.`;
}
/** Texto no formato da nota: título, bloco da Ana + total, bloco do outro + total com «€», conta da diferença e, por fim, quem deve a quem. */
export function keepText(exps: Exp[], ms: Mem[], ym: string, alias = 'Bruno', incomes: Inc[] = [], closes: Close[] = []): string {
  const bs = keepBlocks(exps, ms, ym, alias, incomes, closes); const out: string[] = [keepMonth(ym), ''];
  bs.forEach((b, i) => { out.push(b.label, ...b.lines.map((l) => `${keepVal(l.v)} ${l.d}`), '', i === 0 ? keepTotal(b.total) : `${keepTotal(b.total)} €`); if (i < bs.length - 1) out.push(''); });
  if (bs.length >= 2) out.push(`${keepTotal(bs[0].total)}-${keepTotal(bs[1].total)}=${keepTotal(bs[0].total - bs[1].total, ' ')} euros`, '', keepVerdict(bs));
  return out.join('\n');
}
export const KEEP_ALIAS_KEY = 'fs-lista-alcunha';
export const keepAlias = () => { try { return localStorage.getItem(KEEP_ALIAS_KEY) ?? 'Bruno'; } catch { return 'Bruno'; } };
