// Viagens: ficha da viagem, reservas já pagas (informativas), orçamento a bordo e gastos da viagem (fora do mês normal). Carregado a pedido.
import { useMemo, useState } from 'react';
import { IcShip, IcPlus, IcCheck } from './Icons';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { tripShares, tripSummary, type Trip, type TripItem } from './lib/trips';
import { uuid } from './lib/outbox';
import { nameOf } from './lib/view';
import { type Ctx, Mark } from './App';

const range = (t: Trip) => t.start_date ? `${ptDate(t.start_date).slice(0, 5)}${t.end_date ? '–' + ptDate(t.end_date) : ''}` : 'datas por definir';

function TripForm({ t, data, mutate, done }: Pick<Ctx, 'data' | 'mutate'> & { t?: Trip; done: (id?: string) => void }) {
  const [f, setF] = useState({ name: t?.name ?? '', start: t?.start_date ?? '', end: t?.end_date ?? '', budget: t?.budget_cents != null ? centsToInput(t.budget_cents) : '' });
  const [err, setErr] = useState('');
  const save = async () => {
    setErr(''); if (!f.name.trim()) return setErr('falta o nome');
    const b = f.budget.trim() ? parseCents(f.budget) : null; if (f.budget.trim() && b == null) return setErr('orçamento inválido');
    if (f.start && f.end && f.end < f.start) return setErr('o fim é antes do início');
    const row = { name: f.name.trim(), start_date: f.start || null, end_date: f.end || null, budget_cents: b };
    const id = t?.id ?? uuid();
    const ok = t ? await mutate('Viagem atualizada.', 'trips', 'patch', id, row) : await mutate('Viagem criada.', 'trips', 'create', id, { id, family_id: data.me!.family_id, default_split: '50/50', note: null, is_deleted: false, created_at: new Date().toISOString(), ...row });
    if (ok) done(id);
  };
  return <div className="card form">
    <label className="fld"><span>nome</span><input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
    <div className="row2"><label className="fld"><span>início</span><input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
      <label className="fld"><span>fim</span><input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label></div>
    <label className="fld"><span>orçamento a bordo / no destino (€)</span><input className="num" inputMode="decimal" placeholder="por definir" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></label>
    {err && <p className="err small" role="alert">{err}</p>}
    <div className="acts two"><button className="act pri" onClick={save}>Guardar</button><button className="act" onClick={() => done()}>Cancelar</button></div>
  </div>;
}

function SpendForm({ t, data, mutate, done }: Pick<Ctx, 'data' | 'mutate'> & { t: Trip; done: () => void }) {
  const me = data.me!; const other = data.members.find((m) => m.id !== me.id) ?? null;
  const [f, setF] = useState({ amount: '', desc: '', payer: me.id, split: t.default_split ?? '50/50', mine: '', date: todayIso() });
  const [err, setErr] = useState('');
  const c = parseCents(f.amount); const payerShare = f.split === 'personalizada' ? parseCents(f.mine || '') : null;
  const otherOf = (id: string) => data.members.find((m) => m.id !== id)?.id ?? null;
  const shares = c ? tripShares(c, f.payer, otherOf(f.payer), payerShare) : null;
  const save = async () => {
    setErr('');
    if (!c || c <= 0) return setErr('indica um valor maior que zero');
    if (!f.desc.trim()) return setErr('escreve o que foi');
    if (f.split === 'personalizada' && (payerShare == null || payerShare > c)) return setErr(`a parte de quem pagou tem de estar entre 0 e ${eur(c)}`);
    const id = uuid();
    const ok = await mutate('Gasto da viagem registado.', 'expenses', 'create', id, { id, family_id: me.family_id, amount_cents: c, description: f.desc.trim(), category: 'Viagem', paid_by: f.payer, type: other ? 'partilhada' : 'pessoal', split_mode: f.split, shares: shares ?? {}, date: f.date || todayIso(), extraordinary: false, reason: null, trip_id: t.id, is_deleted: false, created_at: new Date().toISOString() });
    if (ok) done();
  };
  return <div className="card form">
    <div className="row2"><label className="fld"><span>quanto (€)</span><input className="num" inputMode="decimal" value={f.amount} placeholder="0,00" autoFocus onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label className="fld"><span>data</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label></div>
    <label className="fld"><span>o quê</span><input value={f.desc} maxLength={120} placeholder="ex.: excursão em Florença" onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
    <span className="lab">quem pagou</span>
    <div className="seg" role="radiogroup" aria-label="Quem pagou">{data.members.map((m) => <button key={m.id} role="radio" aria-checked={f.payer === m.id} className={f.payer === m.id ? 'pri' : ''} onClick={() => setF({ ...f, payer: m.id })}>{m.display_name}</button>)}</div>
    {other && <><span className="lab">divisão</span>
      <div className="seg" role="radiogroup" aria-label="Divisão"><button role="radio" aria-checked={f.split === '50/50'} className={f.split === '50/50' ? 'pri' : ''} onClick={() => setF({ ...f, split: '50/50' })}>50/50</button>
        <button role="radio" aria-checked={f.split === 'personalizada'} className={f.split === 'personalizada' ? 'pri' : ''} onClick={() => setF({ ...f, split: 'personalizada' })}>Outra</button></div>
      {f.split === 'personalizada' && <label className="fld"><span>parte de {nameOf(data.members, f.payer)} (€)</span><input className="num" inputMode="decimal" value={f.mine} onChange={(e) => setF({ ...f, mine: e.target.value })} /></label>}
      {shares && <p className="dim small">{data.members.map((m) => `${m.display_name} ${eur(shares[m.id] ?? 0)}`).join(' · ')} · entra no acerto</p>}</>}
    {err && <p className="err small" role="alert">{err}</p>}
    <div className="acts two"><button className="act pri" onClick={save}>Guardar</button><button className="act" onClick={done}>Cancelar</button></div>
  </div>;
}

function ReservaRow({ it, data, mutate, state }: Pick<Ctx, 'data' | 'mutate' | 'state'> & { it: TripItem }) {
  const [open, setOpen] = useState(false);
  const e = it.expense_id ? data.expenses.find((x) => x.id === it.expense_id) : null;
  const ms = data.members;
  const info = e ? `no Mês a ${ptDate(e.date)} · pagou ${nameOf(ms, e.paid_by)} · ${e.split_mode === '50/50' ? '50/50' : 'divisão própria'}` : it.paid_by ? `pagou ${nameOf(ms, it.paid_by)}${it.split ? ' · ' + it.split : ''}` : 'quem pagou: por confirmar';
  const setPaid = (pb: string | null) => mutate('Reserva atualizada.', 'trip_items', 'patch', it.id, { paid_by: pb });
  return <li className="li col">
    <button className="row-btn ag-row" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="cb-i sub-i" aria-hidden="true">{e ? <IcCheck /> : <IcShip size={16} />}</span>
      <span className="grow ag-t"><span className="ag-n">{it.description} <Mark s={state[it.id]} /></span><span className={'small block ' + (e || it.paid_by ? 'dim' : 'warn')}>{info}</span></span>
      <span className="r ag-r">{it.amount_cents != null ? <span className="num">{eur(it.amount_cents)}</span> : <span className="warn small">valor?</span>}</span>
    </button>
    {open && <div className="sub small">
      {e ? <p className="dim">Já está lançada no Mês e conta no acerto uma só vez. Aqui é só informativa.</p>
        : <><p className="dim">Informativa: não entra no acerto.</p>
          <div className="seg" role="radiogroup" aria-label="Quem pagou">{[...ms.map((m) => [m.id, m.display_name] as [string | null, string]), [null, 'por confirmar'] as [string | null, string]].map(([k, l]) => <button key={l} role="radio" aria-checked={it.paid_by === k} className={it.paid_by === k ? 'pri' : ''} onClick={() => setPaid(k)}>{l}</button>)}</div></>}
    </div>}
  </li>;
}

export default function Viagens({ data, mutate, state }: Ctx) {
  const trips = data.trips ?? []; const today = todayIso();
  const [sel, setSel] = useState<string | null>(() => trips.find((t) => (t.end_date ?? t.start_date ?? '') >= today)?.id ?? trips[0]?.id ?? null);
  const [mode, setMode] = useState<'' | 'edit' | 'new' | 'spend' | 'budget'>('');
  const [bud, setBud] = useState(''); const [err, setErr] = useState('');
  const t = trips.find((x) => x.id === sel) ?? null;
  const items = (data.tripItems ?? []).filter((i) => t && i.trip_id === t.id);
  const sum = useMemo(() => t ? tripSummary(t, data.tripItems ?? [], data.expenses, today) : null, [t, data.tripItems, data.expenses, today]);
  const linked = new Set(items.map((i) => i.expense_id));
  const spends = t ? data.expenses.filter((e) => !e.is_deleted && e.trip_id === t.id && !linked.has(e.id)) : [];
  if (mode === 'new') return <TripForm data={data} mutate={mutate} done={(id) => { if (id) setSel(id); setMode(''); }} />;
  if (!t || !sum) return <><p className="dim">Sem viagens.</p><button className="act wide-act" onClick={() => setMode('new')}><span className="ic"><IcPlus /></span>Nova viagem</button></>;
  const saveBudget = async () => { setErr(''); const b = bud.trim() ? parseCents(bud) : null; if (bud.trim() && b == null) return setErr('valor inválido'); if (await mutate('Orçamento guardado.', 'trips', 'patch', t.id, { budget_cents: b })) setMode(''); };
  return (<>
    {trips.length > 1 && <div className="chips t44" role="radiogroup" aria-label="Viagem">{trips.map((x) => <button key={x.id} role="radio" aria-checked={x.id === t.id} className={'chip' + (x.id === t.id ? ' on' : '')} onClick={() => { setSel(x.id); setMode(''); }}>{x.name}</button>)}</div>}
    <section className="trip-hero">
      <span className="trip-i" aria-hidden="true"><IcShip size={26} /></span>
      <div className="grow"><div className="ag-h">{t.name} <Mark s={state[t.id]} /></div>
        <div className="dim small">{range(t)}{sum.nights != null ? ` · ${sum.nights} noites` : ''}</div>
        <div className="trip-when">{sum.phase === 'antes' ? `faltam ${sum.days} dia${sum.days === 1 ? '' : 's'}` : sum.phase === 'durante' ? 'a decorrer' : sum.phase === 'depois' ? 'terminou' : 'datas por definir'}</div></div>
      <button className="link" onClick={() => setMode(mode === 'edit' ? '' : 'edit')} aria-label="Editar viagem">editar</button>
    </section>
    {mode === 'edit' && <TripForm t={t} data={data} mutate={mutate} done={() => setMode('')} />}

    <div className="trip-kpis">
      <div><span className="dim small">já pago</span><b className="num">{eur(sum.reservas)}</b></div>
      <div><span className="dim small">na viagem</span><b className="num">{eur(sum.spent)}</b></div>
      <div><span className="dim small">total</span><b className="num">{eur(sum.total)}</b></div>
    </div>

    <h3>orçamento a bordo</h3>
    {mode === 'budget' ? <div className="card form"><label className="fld"><span>orçamento (€)</span><input className="num" inputMode="decimal" autoFocus value={bud} placeholder="por definir" onChange={(e) => setBud(e.target.value)} /></label>
      {err && <p className="err small">{err}</p>}
      <div className="acts two"><button className="act pri" onClick={saveBudget}>Guardar</button><button className="act" onClick={() => setMode('')}>Cancelar</button></div></div>
      : sum.budget == null ? <button className="card trip-bud empty" onClick={() => { setBud(''); setMode('budget'); }}><span className="warn">definir orçamento</span><span className="dim small block">para gastos a bordo, excursões e extras</span></button>
      : <button className="card trip-bud" onClick={() => { setBud(centsToInput(sum.budget!)); setMode('budget'); }} aria-label="Alterar orçamento">
        <div className="kv"><span>{eur(sum.spent)} de {eur(sum.budget)}</span><span className={'num ' + (sum.left! < 0 ? 'bad' : 'ok')}>{sum.left! < 0 ? `+${eur(-sum.left!)} acima` : `sobram ${eur(sum.left!)}`}</span></div>
        <div className="bar"><i style={{ width: Math.min(100, (sum.ratio ?? 0) * 100) + '%' }} className={sum.left! < 0 ? 'over' : ''} /></div></button>}

    <h3>reservas já pagas · {eur(sum.reservas)}</h3>
    <ul className="list ag">{items.map((it) => <ReservaRow key={it.id} it={it} data={data} mutate={mutate} state={state} />)}</ul>
    {!items.length && <p className="dim small">Sem reservas.</p>}

    <h3>gastos da viagem · {spends.length}</h3>
    {spends.length > 0 && <ul className="list ag">{spends.map((e) => <li key={e.id} className="li"><span className="grow">{e.description} <Mark s={state[e.id]} /><span className="dim small block">{ptDate(e.date)} · pagou {nameOf(data.members, e.paid_by)} · {e.split_mode === '50/50' ? '50/50' : 'outra divisão'}</span></span><span className="num">{eur(e.amount_cents)}</span></li>)}</ul>}
    {Object.keys(sum.byMember).length > 0 && <p className="dim small">{data.members.map((m) => `${m.display_name} pagou ${eur(sum.byMember[m.id] ?? 0)}`).join(' · ')}</p>}
    {mode === 'spend' ? <SpendForm t={t} data={data} mutate={mutate} done={() => setMode('')} />
      : <button className="act pri wide-act" onClick={() => setMode('spend')}><span className="ic"><IcPlus /></span>Gasto da viagem</button>}
    <p className="dim small">Os gastos da viagem entram no acerto (50/50 por omissão) mas ficam fora do mês normal no Resumo.</p>
    <button className="link inl" onClick={() => setMode('new')}><IcPlus /> nova viagem</button>
  </>);
}
