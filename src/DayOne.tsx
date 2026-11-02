import { useEffect, useState } from 'react';
import { eur, todayIso } from './lib/money';
import { newMonthReminder, reminderText } from './lib/remind';
import type { FamilyData } from './lib/useFamily';
import type { MonthClose } from './lib/monthclose';
import { useBalance } from './App';

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
  return <div className="card dayone" role="status">
    <b>{text}</b>
    <div className="dim small">Uma só transferência com a totalidade; depois o mês começa a zeros.</div>
    <div className="acts two"><button className="act pri" onClick={open}>Saldar mês</button>
      {perm === 'default' && <button className="act" onClick={async () => setPerm(await Notification.requestPermission())}>Ativar avisos</button>}</div>
  </div>;
}
