// Mês: lembretes curtos — pagamentos dos próximos dias, viagem a chegar e aviso de meio do mês (meta de poupança).
import { useEffect, useMemo, useState } from 'react';
import { IcBell, IcShip, IcPiggy } from './Icons';
import { eur, todayIso } from './lib/money';
import { agenda, reminders } from './lib/agenda';
import { upcoming } from './lib/payments';
import { tripSummary, upcomingTrip } from './lib/trips';
import { goalForToday, midMonthWarning } from './lib/goal';
import { notifyDue, paymentsOf, type Extra } from './Plan';
import type { FamilyData } from './lib/useFamily';
import type { FixView } from './Fixas';

const when = (d: number) => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`;

export function MonthCards({ data, extra, go }: { data: FamilyData; extra: Extra; go?: (v: FixView | 'resumo') => void }) {
  const today = todayIso(); const pays = paymentsOf(data, extra); const days = extra.settings?.notify_days ?? 3;
  const due = useMemo(() => reminders(agenda(pays, data.expenses, today, days), days), [pays, data.expenses, today, days]);
  useEffect(() => { notifyDue(upcoming(pays, today), days).catch(() => {}); }, [pays, today, days]);
  const trip = upcomingTrip(data.trips ?? [], today);
  const ts = trip ? tripSummary(trip, data.tripItems ?? [], data.expenses, today) : null;
  const g = useMemo(() => goalForToday(data.months ?? [], data.expenses, today, extra.settings?.savings_goal_cents ?? 60000), [data.months, data.expenses, today, extra.settings]);
  const w = midMonthWarning(g, today.slice(0, 7));
  const [hid, setHid] = useState(() => (w ? !!localStorage.getItem(w.key) : false));
  return <>
    {due.length > 0 && <button className="card mc" onClick={() => go?.('agenda')}>
      <span className="mc-i warn" aria-hidden="true"><IcBell /></span>
      <span className="grow">{due.slice(0, 3).map((x) => <span key={x.p.id + x.date} className="mc-l"><b>{x.p.name}</b> <span className="dim">{when(x.days)}</span><span className="num">{x.amount != null ? (x.approx ? '≈ ' : '') + eur(x.amount) : 'valor?'}</span></span>)}
        {due.length > 3 && <span className="dim small block">+{due.length - 3} na agenda</span>}</span>
    </button>}
    {trip && ts && <button className="card mc" onClick={() => go?.('viagens')}>
      <span className="mc-i acc" aria-hidden="true"><IcShip /></span>
      <span className="grow"><b>{trip.name}</b><span className="dim small block">{ts.phase === 'durante' ? 'a decorrer' : `faltam ${ts.days} dias`} · {ts.budget == null ? 'orçamento a bordo por definir' : `a bordo ${eur(ts.spent)} de ${eur(ts.budget)}`}</span></span>
    </button>}
    {w && !hid && <div className="card mc" role="status">
      <span className="mc-i bad" aria-hidden="true"><IcPiggy /></span>
      <span className="grow"><b>Este mês vai ≈ {eur(w.over)} acima do habitual</b><span className="dim small block">a meta de {eur(g.goal)} de poupança fica em risco · estimativa, só despesas partilhadas</span></span>
      <button className="x" aria-label="Fechar aviso" onClick={() => { localStorage.setItem(w.key, '1'); setHid(true); }}>×</button>
    </div>}
  </>;
}
