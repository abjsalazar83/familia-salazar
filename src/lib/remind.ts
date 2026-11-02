// Aviso do dia 1: o mês anterior ainda não foi saldado e há saldo → quem deve paga tudo.
export type Reminder = { ym: string; debtor: string; creditor: string; cents: number; key: string } | null;
const prev = (ym: string) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export function newMonthReminder(today: string, closes: { ym: string; is_deleted?: boolean }[], debt: { from: string; to: string; cents: number } | null): Reminder {
  const ym = prev(today.slice(0, 7));
  if (!debt || debt.cents <= 0 || closes.some((c) => !c.is_deleted && c.ym === ym)) return null;
  return { ym, debtor: debt.from, creditor: debt.to, cents: debt.cents, key: `fs-dia1-${ym}` };
}
export function reminderText(r: NonNullable<Reminder>, me: string, names: Record<string, string>, fmt: (c: number) => string) {
  const who = r.debtor === me ? `Deves ${fmt(r.cents)} a ${names[r.creditor]}` : `${names[r.debtor]} deve-te ${fmt(r.cents)}`;
  return `Novo mês: ${who} — saldar tudo`;
}
