// Fecho de mês: nomes dos meses e mensagem. O cálculo vive em lib/settle.ts.
import { addMonths } from './payments';
export type MonthClose = {
  id: string; family_id: string; ym: string; creditor: string | null; debtor: string | null; lists: Record<string, unknown>;
  diff_cents: number; paid_cents: number; carry_cents: number; settlement_id: string | null; is_deleted: boolean; closed_at: string;
};
export { MBWAY_MAX } from './settle';
/** Listas do mês e acerto: delegados no motor único (lib/settle.ts). */
export { monthLists as halvedLists, closeOf as closeCalc, type CloseCalc } from './settle';
import type { CloseCalc } from './settle';
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

