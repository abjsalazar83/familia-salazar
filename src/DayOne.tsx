import { useEffect, useState } from 'react';
import { eur, todayIso } from './lib/money';
import { newMonthReminder, reminderText } from './lib/remind';
import type { FamilyData } from './lib/useFamily';
import type { MonthClose } from './lib/monthclose';
import { useBalance } from './App';
import { IcSwap } from './Icons';

/** Aviso do dia 1: «Novo mês: … — saldar tudo». Na app e, com permissão, notificação do sistema (uma por mês). Não move dinheiro. */
export function DayOne({ data, closes, open }: { data: FamilyData; closes: MonthClose[]; open: () => void }) {
  const bal = useBalance(data); const me = data.me!.id;
  const names = Object.fromEntries(data.members.map((m) => [m.id, m.display_name]));
  const r = newMonthReminder(todayIso(), closes, bal.debt);
  const text = r ? reminderText(r, me, names, eur) : '';
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  useEffect(() => {
    if (!r || perm !== 'granted' || localStorage.getItem(r.key) || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => reg?.showNotification(text, { body: 'Uma transferência MB WAY com a totalidade. Toca para saldar o mês.', tag: r.key, icon: './icon-192.png', data: { url: './?acao=fechar' } }))
      .then(() => localStorage.setItem(r.key, '1')).catch(() => {});
  }, [r?.key, perm, text]); // eslint-disable-line
  if (!r) return null;
  return <div className="av-row dayone" role="status">
    <span className="av-i bad" aria-hidden="true"><IcSwap /></span>
    <span className="grow"><b>{text}</b><span className="dim small block">Uma só transferência com a totalidade; depois o mês começa a zeros.
      {perm === 'default' && <> <button className="link small inl" onClick={async () => setPerm(await Notification.requestPermission())}>Ativar avisos</button></>}</span></span>
    <button className="link" onClick={open}>Saldar mês</button>
  </div>;
}
