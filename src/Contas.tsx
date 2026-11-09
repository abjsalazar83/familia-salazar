// Calendário de pagamentos (próximos 60 dias) e Subscrições. Carregado a pedido.
import { useMemo, useState } from 'react';
import { IcBell, IcCard, IcCat, IcPlus, IcCalendar } from './Icons';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { agenda, agendaTotal, subscriptions, type AgendaItem } from './lib/agenda';
import { mesNome } from './lib/monthclose';
import type { Payment, Period } from './lib/payments';
import { paymentsOf } from './Plan';
import { uuid } from './lib/outbox';
import { type Ctx, Mark } from './App';

const PER: Record<Period, string> = { mensal: '/mês', bimestral: '/2 meses', trimestral: '/3 meses', anual: '/ano' };
const PERN: Record<Period, string> = { mensal: 'mensal', bimestral: 'bimestral', trimestral: 'trimestral', anual: 'anual' };
const when = (d: number) => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `${d} dias`;
const dm = (iso: string) => ({ d: iso.slice(8, 10), m: mesNome(iso.slice(0, 7)).slice(0, 3) });

/** Mini formulário: data e valor (e periodicidade). Nunca preenche nada sozinho. */
function QuickEdit({ p, mutate, done, sub }: { p: Payment; mutate: Ctx['mutate']; done: () => void; sub?: boolean }) {
  const [f, setF] = useState({ date: p.next_date ?? '', amount: p.amount_cents != null ? centsToInput(p.amount_cents) : '', period: p.period, account: p.account ?? '' });
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    const a = f.amount.trim() ? parseCents(f.amount) : null;
    if (f.amount.trim() && a == null) return setErr('valor inválido (ex.: 12,50)');
    const row: Record<string, unknown> = { next_date: f.date || null, amount_cents: a, period: f.period };
    if (sub) row.account = f.account.trim() || null;
    if (await mutate(`«${p.name}» atualizado.`, 'payments', 'patch', p.id, row)) done();
  };
  return <div className="form qe">
    <div className="row2"><label className="fld"><span>{sub ? 'renovação' : 'próxima data'}</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      <label className="fld"><span>valor (€)</span><input className="num" inputMode="decimal" placeholder="por definir" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label></div>
    <label className="fld"><span>periodicidade</span><select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value as Period })}>{(Object.keys(PERN) as Period[]).map((k) => <option key={k} value={k}>{PERN[k]}</option>)}</select></label>
    {sub && <label className="fld"><span>cartão</span><input value={f.account} placeholder="ex.: Visa …1234" onChange={(e) => setF({ ...f, account: e.target.value })} /></label>}
    {err && <p className="err small" role="alert">{err}</p>}
    <div className="acts two"><button className="act pri" onClick={save}>Guardar</button><button className="act" onClick={done}>Cancelar</button></div>
    {!sub && p.variable && <p className="dim small">Valor variável: o valor do mês confirma-se no Mês, em «por confirmar». Aqui fica só a referência.</p>}
  </div>;
}

export function Agenda({ data, extra, mutate, state }: Ctx) {
  const today = todayIso(); const pays = paymentsOf(data, extra);
  const a = useMemo(() => agenda(pays, data.expenses, today, 60), [pays, data.expenses, today]);
  const days = extra.settings?.notify_days ?? 3;
  const tot = agendaTotal(a.items);
  const [edit, setEdit] = useState<string | null>(null);
  const names = Object.fromEntries(data.members.map((m) => [m.id, m.display_name]));
  const months: [string, AgendaItem[]][] = [];
  for (const x of a.items) { const k = x.date.slice(0, 7); const g = months.find((m) => m[0] === k); if (g) g[1].push(x); else months.push([k, [x]]); }
  const who = (p: Payment) => p.kind === 'pessoal' ? names[p.owner_member ?? ''] ?? 'pessoal' : p.split === 'outro100' ? '100% do outro' : 'conjunta';
  return (<>
    <section className="ag-hero">
      <span className="ag-hi" aria-hidden="true"><IcCalendar /></span>
      <div className="grow"><div className="ag-h">Próximos 60 dias</div>
        <div className="num big2">{tot.approx ? '≈ ' : ''}{eur(tot.known)}</div>
        <div className="dim small">{a.items.length} pagamento{a.items.length === 1 ? '' : 's'}{tot.unknown ? ` · ${tot.unknown} sem valor` : ''} · ≈ = último valor</div></div>
    </section>
    <p className="dim small ag-note"><IcBell size={14} /> Aviso na app {days} dia{days > 1 ? 's' : ''} antes · muda em Definições</p>
    {months.map(([ym, xs]) => <section key={ym}><h3>{mesNome(ym)}</h3>
      <ul className="list ag">{xs.map((x) => { const k = x.p.id + x.date; const soon = x.days <= days; const { d, m } = dm(x.date);
        return <li key={k} className={'li col' + (soon ? ' soon-ag' : '')}>
          <button className="row-btn ag-row" aria-expanded={edit === k} onClick={() => setEdit(edit === k ? null : k)}>
            <span className={'ag-d' + (soon ? ' on' : '')}><b>{d}</b><small>{m}</small></span>
            <span className="grow ag-t"><span className="ag-n"><span className="cb-i" aria-hidden="true"><IcCat cat={x.p.category ?? 'Casa'} /></span>{x.p.name} <Mark s={state[x.p.id]} /></span>
              <span className="dim small block">{[who(x.p), x.p.account, x.priceChange ? 'preço novo' : ''].filter(Boolean).join(' · ')}</span></span>
            <span className="r ag-r">{x.amount != null ? <span className="num">{x.approx ? '≈ ' : ''}{eur(x.amount)}</span> : <span className="warn small">definir valor</span>}
              <span className={'small block ' + (soon ? 'warn' : 'dim')}>{when(x.days)}</span></span>
          </button>
          {edit === k && <QuickEdit p={x.p} mutate={mutate} done={() => setEdit(null)} />}
        </li>; })}</ul></section>)}
    {!a.items.length && <p className="dim small">Nada a pagar nos próximos 60 dias com data definida.</p>}
    {a.undated.length > 0 && <><h3>sem data · {a.undated.length}</h3>
      <ul className="list ag">{a.undated.map(({ p, missing }) => <li key={p.id} className="li col">
        <button className="row-btn ag-row" aria-expanded={edit === p.id} onClick={() => setEdit(edit === p.id ? null : p.id)}>
          <span className="ag-d none" aria-hidden="true"><b>?</b></span>
          <span className="grow ag-t"><span className="ag-n"><span className="cb-i" aria-hidden="true"><IcCat cat={p.category ?? 'Casa'} /></span>{p.name}</span>
            <span className="dim small block">{[who(p), p.subscription ? 'subscrição' : '', p.amount_cents != null ? eur(p.amount_cents) + PER[p.period] : ''].filter(Boolean).join(' · ')}</span></span>
          <span className="warn small ag-r">definir<span className="block">{missing.join(' e ')}</span></span>
        </button>
        {edit === p.id && <QuickEdit p={p} mutate={mutate} done={() => setEdit(null)} />}
      </li>)}</ul>
      <p className="dim small">Sem data, a app não avisa nem lança. Toca para definir; nada é preenchido sozinho.</p></>}
  </>);
}

export function Subscricoes({ data, extra, mutate, state }: Ctx) {
  const today = todayIso(); const pays = paymentsOf(data, extra);
  const s = useMemo(() => subscriptions(pays, today), [pays, today]);
  const [edit, setEdit] = useState<string | null>(null);
  const [add, setAdd] = useState(false); const [nf, setNf] = useState({ name: '', who: data.me!.id }); const [err, setErr] = useState('');
  const names = Object.fromEntries(data.members.map((m) => [m.id, m.display_name]));
  const rises = s.rows.filter((r) => r.rise);
  const create = async () => {
    setErr(''); if (!nf.name.trim()) return setErr('falta o nome');
    const id = uuid(); const casa = nf.who === 'casa';
    const ok = await mutate('Subscrição criada (valor por confirmar).', 'payments', 'create', id, { id, family_id: data.me!.family_id, name: nf.name.trim(), amount_cents: null, period: 'mensal', next_date: null, payer: casa ? null : names[nf.who], account: null, note: null, new_amount_cents: null, new_period: null, new_from: null, is_deleted: false, kind: casa ? 'conjunta' : 'pessoal', split: '50/50', category: 'Subscrições', owner_member: casa ? null : nf.who, variable: false, subscription: true });
    if (ok) { setAdd(false); setNf({ name: '', who: data.me!.id }); setEdit(id); }
  };
  return (<>
    <section className="ag-hero">
      <span className="ag-hi" aria-hidden="true"><IcCard size={20} /></span>
      <div className="grow"><div className="ag-h">Subscrições</div>
        <div className="num big2">{eur(s.monthly)}<span className="dim per">/mês</span></div>
        <div className="dim small">equivalente mensal · {s.rows.length} ativa{s.rows.length === 1 ? '' : 's'}{s.unknown ? ` · ${s.unknown} por confirmar (fora do total)` : ''}</div></div>
    </section>
    {rises.map((r) => <div key={r.p.id} className="card rise" role="note"><b>▲ {r.p.name} muda de preço</b>
      <div className="small">a {ptDate(r.rise!.from)}: {r.rise!.amount != null ? eur(r.rise!.amount) : '?'}{PER[r.rise!.period]}{r.monthly != null && r.rise!.monthly != null ? ` · +${eur(r.rise!.monthly - r.monthly)}/mês face a hoje` : ''}</div>
      <div className="dim small">hoje {r.amount != null ? eur(r.amount) + PER[r.period] : 'por confirmar'}{r.p.account ? ' · ' + r.p.account : ''}</div></div>)}
    <ul className="list ag">{s.rows.map((r) => <li key={r.p.id} className="li col">
      <button className="row-btn ag-row" aria-expanded={edit === r.p.id} onClick={() => setEdit(edit === r.p.id ? null : r.p.id)}>
        <span className="cb-i sub-i" aria-hidden="true"><IcCat cat={r.p.category === 'Saúde' ? 'Saúde' : 'Subscrições'} /></span>
        <span className="grow ag-t"><span className="ag-n">{r.p.name} <Mark s={state[r.p.id]} /></span>
          <span className="dim small block">{[r.p.kind === 'pessoal' ? names[r.p.owner_member ?? ''] : 'casa', r.p.account ?? 'cartão ?', r.renewal ? 'renova ' + ptDate(r.renewal) : 'renovação ?'].filter(Boolean).join(' · ')}</span></span>
        <span className="r ag-r">{r.amount != null ? <><span className="num">{eur(r.amount)}<small className="dim">{PER[r.period]}</small></span>{r.period !== 'mensal' && r.monthly != null && <span className="dim small block">≈ {eur(r.monthly)}/mês</span>}</> : <span className="warn small">por confirmar</span>}</span>
      </button>
      {edit === r.p.id && <QuickEdit p={r.p} mutate={mutate} done={() => setEdit(null)} sub />}
    </li>)}</ul>
    {!s.rows.length && <p className="dim small">Sem subscrições marcadas.</p>}
    {add ? <div className="card form"><label className="fld"><span>nome</span><input value={nf.name} maxLength={60} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="ex.: Netflix" autoFocus /></label>
      <div className="seg" role="radiogroup" aria-label="De quem">{[...data.members.map((m) => [m.id, m.display_name]), ['casa', 'Casa']].map(([k, l]) => <button key={k} role="radio" aria-checked={nf.who === k} className={nf.who === k ? 'pri' : ''} onClick={() => setNf({ ...nf, who: k })}>{l}</button>)}</div>
      {err && <p className="err small">{err}</p>}
      <div className="acts two"><button className="act pri" onClick={create}>Criar</button><button className="act" onClick={() => setAdd(false)}>Cancelar</button></div>
      <p className="dim small">Valor, renovação e cartão ficam «por confirmar» até os indicares.</p></div>
      : <button className="act wide-act" onClick={() => setAdd(true)}><span className="ic"><IcPlus /></span>Adicionar subscrição</button>}
    <p className="dim small">Com renovação e valor definidos, o pagamento entra no calendário e é lançado como os outros fixos.</p>
  </>);
}

export default function Contas(p: Ctx & { view: 'agenda' | 'subs' }) {
  return p.view === 'agenda' ? <Agenda {...p} /> : <Subscricoes {...p} />;
}
