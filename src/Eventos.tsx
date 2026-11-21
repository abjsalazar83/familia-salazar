// fs-v46 — Resumo: cartões dos eventos (Natal, aniversários, Páscoa…) e «Eventos» para criar/alterar/retirar.
// Cada cartão: total, conjunta vs pessoal, quem pagou, n.º de compras e orçamento opcional (80% laranja, acima vermelho).
import { useMemo, useState } from 'react';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { supabase } from './lib/supabase';
import { allEvents, eventSummary, showCard, validEvent, yearLabel, EMOJIS, TEMPLATES, type FamEvent } from './lib/events';
import { uuid, type Mutate } from './lib/outbox';
import { payerTone } from './lib/view';
import type { Expense, Member } from './lib/types';
import type { Extra } from './Plan';

export function EventCard({ ev, exps, members, extra, online, mutate }: { ev: FamEvent; exps: Expense[]; members: Member[]; extra: Extra; online: boolean; mutate?: Mutate }) {
  const [local, setLocal] = useState<number | null | undefined>(undefined);
  const s = useMemo(() => eventSummary(ev, exps, local !== undefined ? local : ev.budget_cents), [ev, exps, local]);
  const [edit, setEdit] = useState(false); const [v, setV] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const fid = members[0]?.family_id; const natal = ev.kind === 'natal';
  const save = async (cents: number | null) => {
    setErr(''); if (!fid) return; setBusy(true);
    let ok = true;
    if (!ev.virtual && mutate) ok = await mutate('Orçamento guardado.', 'events', 'patch', ev.id, { budget_cents: cents });
    // Natal: o orçamento continua também em family_settings (mesmo significado da v43)
    if (ok && natal) { const { error } = await supabase.from('family_settings').upsert({ family_id: fid, natal_budget_cents: cents, natal_budget_year: cents == null ? null : Number(ev.start_date.slice(0, 4)) }, { onConflict: 'family_id' }); if (error) { ok = false; setErr('Não foi possível guardar: ' + error.message); } }
    setBusy(false); if (!ok) return;
    setLocal(cents); setEdit(false); if (natal) extra.reload();
  };
  const submit = () => { const t = v.trim(); if (!t) return save(null); const c = parseCents(t); if (c == null || c <= 0) return setErr('Valor inválido (ex.: 400).'); save(c); };
  const pctShared = s.total ? Math.round((s.shared / s.total) * 100) : 0;
  const over = s.left != null && s.left < 0;
  const who = members.map((m) => ({ m, v: s.paid[m.id] ?? 0 }));
  const when = natal ? 'set.–jan.' : ev.start_date === ev.end_date ? ptDate(ev.start_date) : `${ptDate(ev.start_date)}–${ptDate(ev.end_date)}`;
  const nm = natal ? 'Natal' : ev.name;
  return <section className="card natal fade" aria-label={nm}>
    <div className="kv"><b><span className="natal-e" aria-hidden="true">{ev.emoji || '🎉'}</span> {nm} {natal && <span className="dim small" style={{ fontWeight: 400 }}>{yearLabel(ev)}</span>}</b><span className="num natal-t">{eur(s.total)}</span></div>
    {s.count === 0 ? <p className="dim small">{natal ? '' : when + ' · '}Ainda sem compras. Ao lançar, escolhe «{ev.emoji || '🎉'} {nm}» por baixo de «O quê?» — conta no acerto como as outras despesas.</p> : <>
      <div className="dim small">{s.count} compra{s.count > 1 ? 's' : ''} · {when}</div>
      <div className="natal-sp" role="img" aria-label={`Conjunta ${eur(s.shared)}, pessoal ${eur(s.personal)}`}><i className="sh" style={{ flex: s.shared || 0 }} /><i className="pe" style={{ flex: s.personal || 0 }} /></div>
      <ul className="natal-l">
        <li><i className="dotc sh" />conjunta 50/50<span className="num">{eur(s.shared)}</span><small className="dim">{pctShared}%</small></li>
        <li><i className="dotc pe" />pessoal<span className="num">{eur(s.personal)}</span><small className="dim">{100 - pctShared}%</small></li>
      </ul>
      <div className="natal-w">{who.map(({ m, v }) => <div key={m.id} className={'natal-p pay-' + payerTone(members, m.id)}><span className="small dim">pagou {m.display_name}</span><b className="num">{eur(v)}</b></div>)}</div>
    </>}
    {edit ? <div className="natal-ed">
      <label className="fld"><span>orçamento (€) · vazio = sem orçamento</span><input className="num" inputMode="decimal" autoFocus value={v} placeholder="ex.: 400" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} /></label>
      <div className="row"><button className="pri" disabled={busy || (!online && natal)} onClick={submit}>{busy ? 'A guardar…' : 'Guardar'}</button>
        {s.budget != null && <button disabled={busy || (!online && natal)} onClick={() => save(null)}>Sem orçamento</button>}
        <button className="link" onClick={() => { setEdit(false); setErr(''); }}>Cancelar</button></div>
      {err && <p className="err small" role="alert">{err}</p>}
    </div>
    : s.budget != null ? <button className="natal-b" onClick={() => { setV(centsToInput(s.budget!)); setEdit(true); }} aria-label={`Alterar orçamento de ${nm}`}>
      <div className="kv small"><span>{eur(s.total)} de {eur(s.budget)}</span><span className={'num ' + (over ? 'bad' : s.ratio! >= 0.8 ? 'warn' : 'ok')}>{over ? `+${eur(-s.left!)} acima` : `sobram ${eur(s.left!)}`}</span></div>
      <div className="bar"><i className={over ? 'over' : s.ratio! >= 0.8 ? 'warn' : ''} style={{ width: Math.min(100, Math.round(s.ratio! * 100)) + '%' }} /></div>
    </button>
    : <button className="link small" onClick={() => { setV(''); setEdit(true); }}>+ definir orçamento (opcional)</button>}
  </section>;
}

/** Cartões dos eventos a decorrer (ou com despesas até 30 dias depois) + gestão dos eventos. */
export function EventCards({ events, exps, members, extra, online, mutate, today = todayIso() }: { events?: FamEvent[]; exps: Expense[]; members: Member[]; extra: Extra; online: boolean; mutate?: Mutate; today?: string }) {
  const evs = useMemo(() => allEvents(events, today, extra.settings), [events, today, extra.settings]);
  const shown = evs.filter((ev) => showCard(eventSummary(ev, exps), today));
  return <>
    {shown.map((ev) => <EventCard key={ev.id} ev={ev} exps={exps} members={members} extra={extra} online={online} mutate={mutate} />)}
    {mutate && <EventsManager events={(events ?? []).filter((e) => !e.is_deleted)} exps={exps} fid={members[0]?.family_id} mutate={mutate} today={today} />}
  </>;
}

type Form = { id: string | null; name: string; emoji: string; start: string; end: string; budget: string };
const blank = (today: string): Form => ({ id: null, name: '', emoji: '🎂', start: today, end: today, budget: '' });

function EventsManager({ events, exps, fid, mutate, today }: { events: FamEvent[]; exps: Expense[]; fid?: string; mutate: Mutate; today: string }) {
  const [open, setOpen] = useState(false); const [f, setF] = useState<Form | null>(null); const [err, setErr] = useState('');
  const list = [...events].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const soon = list.filter((e) => e.end_date >= today).length;
  const save = async () => {
    if (!f || !fid) return; const e = validEvent(f); if (e) return setErr(e);
    const b = f.budget.trim() ? parseCents(f.budget) : null; if (f.budget.trim() && (b == null || b <= 0)) return setErr('Orçamento inválido (ex.: 150).');
    const row = { name: f.name.trim(), emoji: f.emoji || null, start_date: f.start, end_date: f.end, budget_cents: b };
    const ok = f.id ? await mutate(`«${row.name}» atualizado.`, 'events', 'patch', f.id, row)
      : await (async () => { const id = uuid(); return mutate(`«${row.name}» criado.`, 'events', 'create', id, { id, family_id: fid, kind: 'outro', ...row, is_deleted: false, created_at: new Date().toISOString() }); })();
    if (ok) { setF(null); setErr(''); }
  };
  const remove = async (ev: FamEvent) => {
    if (!confirm(`Retirar «${ev.name}»? As despesas ficam como estão (só deixam de aparecer agrupadas). Fica no histórico.`)) return;
    if (await mutate(`«${ev.name}» retirado.`, 'events', 'patch', ev.id, { is_deleted: true })) setF(null);
  };
  return <section className="evm">
    <button className="banner row between wide evm-h" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span><span aria-hidden="true">🎉</span> <b>Eventos</b> <span className="dim small">{list.length ? `${list.length}${soon ? ` · ${soon} por vir/a decorrer` : ''}` : 'aniversários, Páscoa, batizados…'}</span></span><span className="dim small">{open ? 'fechar' : 'gerir ›'}</span></button>
    {open && <div className="card evm-b">
      {list.length > 0 && !f && <ul className="list">{list.map((ev) => { const n = eventSummary(ev, exps).count; return (
        <li key={ev.id} className="li"><button className="row-btn plain grow" onClick={() => { setErr(''); setF({ id: ev.id, name: ev.name, emoji: ev.emoji ?? '🎉', start: ev.start_date, end: ev.end_date, budget: ev.budget_cents ? centsToInput(ev.budget_cents) : '' }); }}>
          <span aria-hidden="true">{ev.emoji || '🎉'}</span><span className="grow"><span className="block">{ev.kind === 'natal' ? `Natal ${yearLabel(ev)}` : ev.name}</span><span className="dim small">{ptDate(ev.start_date)}{ev.end_date !== ev.start_date ? `–${ptDate(ev.end_date)}` : ''} · {n} compra{n === 1 ? '' : 's'}{ev.budget_cents ? ` · orç. ${eur(ev.budget_cents)}` : ''}</span></span></button></li>); })}</ul>}
      {!f ? <button className="link" onClick={() => { setErr(''); setF(blank(today)); }}>+ novo evento</button> : <div className="evm-f">
        <h3>{f.id ? 'alterar evento' : 'novo evento'}</h3>
        {!f.id && <div className="chips" role="group" aria-label="Modelos">{TEMPLATES.map((t) => <button key={t.name} type="button" className={'chip' + (f.name === t.name ? ' on' : '')} onClick={() => setF({ ...f, name: t.name, emoji: t.emoji })}>{t.emoji} {t.name}</button>)}</div>}
        <label className="fld"><span>nome</span><input value={f.name} maxLength={60} placeholder="ex.: Aniversário da Laura" onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="chips evm-em" role="radiogroup" aria-label="Emoji">{EMOJIS.map((x) => <button key={x} type="button" role="radio" aria-checked={f.emoji === x} className={'chip' + (f.emoji === x ? ' on' : '')} onClick={() => setF({ ...f, emoji: x })}>{x}</button>)}</div>
        <div className="row2"><label className="fld"><span>de</span><input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })} /></label>
          <label className="fld"><span>até</span><input type="date" value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} /></label></div>
        <label className="fld"><span>orçamento (€) · opcional</span><input className="num" inputMode="decimal" value={f.budget} placeholder="ex.: 150" onChange={(e) => setF({ ...f, budget: e.target.value })} /></label>
        <p className="dim small">Durante estas datas aparece «{f.emoji} {f.name.trim() || 'evento'}» ao lançar uma despesa.</p>
        {err && <p className="err small" role="alert">{err}</p>}
        <div className="row"><button className="pri" onClick={save}>Guardar</button><button onClick={() => { setF(null); setErr(''); }}>Cancelar</button>
          {f.id && events.find((e) => e.id === f.id)?.kind !== 'natal' && <button className="danger" onClick={() => remove(events.find((e) => e.id === f.id)!)}>Retirar</button>}</div>
      </div>}
    </div>}
  </section>;
}
