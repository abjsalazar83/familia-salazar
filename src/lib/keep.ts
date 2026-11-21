// fs-v45 — «Lista» ao estilo da nota do Google Keep da Ana. SÓ CONSULTA: texto gerado das despesas, nunca editável.
// Escolha: por mês, as despesas PARTILHADAS (as que entram no acerto) com o valor total de cada uma, no bloco de quem pagou.
// Pessoais, retiradas, do extrato por rever/descartadas e acertos (transferências) ficam de fora.
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
type Exp = { id?: string; amount_cents: number; description: string; paid_by: string; type: string; date: string; is_deleted: boolean; review?: string | null; created_at?: string };
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
/** Nome no bloco: o da Ana fica «Ana»; o outro usa a alcunha das listas dela (por omissão «Bruno»). */
export const keepLabel = (m: Mem, alias: string) => /^ana\b/i.test(m.display_name) ? m.display_name : (alias.trim() || m.display_name);

export type KeepBlock = { m: Mem; label: string; lines: { v: number; d: string }[]; total: number };
export function keepBlocks(exps: Exp[], ms: Mem[], ym: string, alias = 'Bruno'): KeepBlock[] {
  const xs = exps.filter((e) => keepIncluded(e, ym)).sort((a, b) => a.date.localeCompare(b.date) || (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  return keepOrder(ms).map((m) => { const lines = xs.filter((e) => e.paid_by === m.id).map((e) => ({ v: e.amount_cents, d: e.description.trim() })); return { m, label: keepLabel(m, alias), lines, total: lines.reduce((s, l) => s + l.v, 0) }; });
}
/** Texto exatamente no formato da nota: título, bloco da Ana + total, bloco do outro + total com «€», conta da diferença. */
export function keepText(exps: Exp[], ms: Mem[], ym: string, alias = 'Bruno'): string {
  const bs = keepBlocks(exps, ms, ym, alias); const out: string[] = [keepMonth(ym), ''];
  bs.forEach((b, i) => { out.push(b.label, ...b.lines.map((l) => `${keepVal(l.v)} ${l.d}`), '', i === 0 ? keepTotal(b.total) : `${keepTotal(b.total)} €`); if (i < bs.length - 1) out.push(''); });
  if (bs.length >= 2) out.push(`${keepTotal(bs[0].total)}-${keepTotal(bs[1].total)}=${keepTotal(bs[0].total - bs[1].total, ' ')} euros`);
  return out.join('\n');
}
export const KEEP_ALIAS_KEY = 'fs-lista-alcunha';
export const keepAlias = () => { try { return localStorage.getItem(KEEP_ALIAS_KEY) ?? 'Bruno'; } catch { return 'Bruno'; } };
