// Ecrã «Mês»: saldo, aviso «por confirmar», adicionar e uma só lista de movimentos (− despesas, + receitas).
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IcList, IcPen, IcCat, IcSwap } from './Icons';
import { IncomeForm, IncomeRows, useAutoIncome } from './Incomes';
import type { SharedIncome } from './lib/income';
import { matchExpense, matchIncome, monthIncomes } from './lib/search';
import { payerTone, groupByCategory, nameOf } from './lib/view';
import { confirmCount } from './lib/anomaly';
import type { } from '@supabase/supabase-js';
import { eur, ptDate, todayIso } from './lib/money';
import { type Expense } from './lib/types';
import { CloseMonth, paymentsOf } from './Plan';
import { openFrom } from './lib/monthclose';
import { DayOne } from './DayOne';
import { MonthCards } from './Remind';
import { Inbox } from './Inbox';
import { Faltam } from './Faltam';
import { Lista } from './Lista';
import { pendentes, type Pendente } from './lib/payments';
import { EventAlerts } from './Eventos';
import { VoiceButton } from './Voice';
import type { VoiceGuess } from './lib/voice';
import { ReceiptButton, type ReceiptResult } from './Receipt';
import { type Ctx, type PanelProps, BalanceCard, SettleForm, ExpenseForm, ExpenseRow, Effect, Mark } from './App';
export function Month(p: Ctx & PanelProps) {
  const { data, panel, setPanel, mutate } = p; const me = data.me!.id;
  const [rc, setRc] = useState<ReceiptResult | null>(null); const [vc, setVc] = useState<VoiceGuess | null>(null); const [fx, setFx] = useState<Pendente | null>(null);
  const [showGone, setShowGone] = useState(false); const [who, setWho] = useState<'tudo' | 'eu' | 'outro'>('tudo');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState(''); const [incEdit, setIncEdit] = useState<SharedIncome | null>(null);
  const ym = todayIso().slice(0, 7); const incList = monthIncomes(data.incomes ?? [], ym).filter((i) => matchIncome(i, q)); const incN = incList.length;
  const from = openFrom([...(data.closes ?? []), ...(p.extra?.closes ?? [])]); const openE = data.expenses.filter((e) => q || !from || e.date >= from);
  const list = openE.filter((e) => (showGone || !e.is_deleted) && (who === 'tudo' || (who === 'eu' ? e.paid_by === me : e.paid_by !== me)) && matchExpense(e, q));
  const confirmS = (id: string) => mutate('Liquidação confirmada.', 'settlements', 'patch', id, { confirmed: true, confirmed_at: new Date().toISOString() });
  const confirmE = (e: Expense) => mutate(e.confirmed_by ? 'Confirmação retirada.' : 'Valor confirmado.', 'expenses', 'patch', e.id, e.confirmed_by ? { confirmed_by: null, confirmed_at: null } : { confirmed_by: me, confirmed_at: new Date().toISOString() });
  const otherM = data.members.find((m) => m.id !== me); const otherN = otherM?.display_name ?? 'Outro';
  const groups = groupByCategory(list, me);
  const cc = confirmCount(data.expenses, ym);
  const closes = [...(data.closes ?? []), ...(p.extra?.closes ?? [])]; const pays = paymentsOf(data, p.extra);
  const pendS = data.settlements.filter((s) => !s.is_deleted && !s.confirmed);
  const fixasP = useMemo(() => pendentes(pays, data.expenses as never, todayIso()), [pays, data.expenses]);
  const launch = (x: Pendente) => { setRc(null); setVc(null); setFx(x); p.openExpense(null); };
  // fs-v47: um só sítio para avisos; o título conta o que está lá dentro
  const avRef = useRef<HTMLElement>(null); const [avN, setAvN] = useState(0);
  useLayoutEffect(() => { const n = avRef.current?.children.length ?? 0; if (n !== avN) setAvN(n); });
  useAutoIncome(data, mutate); // fs-v44: despesas fixas nunca são lançadas sozinhas (ver «Faltam lançar»)
  return (
    <>
      <BalanceCard data={data} state={p.state} panel={panel} setPanel={setPanel} closes={closes} />
      <h3 className={'av-h' + (avN ? '' : ' hide')}>avisos · {avN}</h3>
      <section className="avisos" ref={avRef} aria-label="Avisos">
        <DayOne data={data} closes={closes} open={() => setPanel('fechar')} />
        {pendS.map((s) => <div key={s.id} className="av-row" role="status">
          <span className="av-i bad" aria-hidden="true"><IcSwap /></span>
          <span className="grow">Acerto por confirmar · {eur(s.amount_cents)}<span className="dim small block">{nameOf(data.members, s.from_member)} → {nameOf(data.members, s.to_member)} · {ptDate(s.date)}{s.method ? ' · ' + s.method : ''} · ainda não conta</span></span>
          {s.to_member === me ? <button className="link" onClick={() => confirmS(s.id)}>Confirmar</button> : <span className="dim small">à espera</span>}
        </div>)}
        {!panel && <Faltam data={data} payments={pays} mutate={mutate} launch={launch} />}
        <Inbox data={data} mutate={mutate} open={panel === 'rever'} toggle={() => setPanel(panel === 'rever' ? '' : 'rever')} />
        {!panel && <MonthCards data={data} extra={p.extra} go={(v) => (v === 'resumo' ? p.goResumo?.() : p.goFix?.(v))} />}
        {!panel && <EventAlerts data={data} extra={p.extra} go={() => p.goResumo?.()} />}
      </section>
      {panel === 'saldar' && <SettleForm {...p} close={() => setPanel('')} />}
      {panel === 'despesa' && !p.editing ? <ExpenseForm key={rc ? 'rc' : vc ? 'v' + vc.text : fx ? 'fx' + fx.p.id + fx.date : 'n'} {...p} receipt={rc} voice={vc} fixa={fx} close={() => { setRc(null); setVc(null); setFx(null); setPanel(''); }} />
        : panel === 'receita' ? <div className="card sheet"><IncomeForm key={incEdit?.id ?? 'n'} data={data} mutate={mutate} editing={incEdit} close={() => { setIncEdit(null); setPanel(''); }} toExpense={incEdit ? undefined : () => setPanel('mais')} /></div>
        : (panel === 'mais' || panel === 'talao' || panel === 'voz') && <AddSheet panel={panel} close={() => setPanel('')} income={() => { setIncEdit(null); setPanel('receita'); }}
            write={() => { setRc(null); setVc(null); setFx(null); p.openExpense(null); }} receipt={(r) => { setRc(r); setVc(null); setFx(null); p.openExpense(null); }}
            voice={(g) => { setRc(null); setVc(g); setFx(null); p.openExpense(null); }} fromList={data.items.some((i) => i.bought && !i.archived_at) ? p.goList : undefined}
            fixas={fixasP} launch={launch} />}
      {panel === 'fechar' && <CloseMonth data={data} extra={p.extra} mutate={mutate} online={p.online} close={() => setPanel('')} />}
      {panel === 'lista' && <Lista exps={data.expenses} members={data.members} incomes={data.incomes ?? []} closes={closes as never} close={() => setPanel('')} />}
      <div className="segc" role="radiogroup" aria-label="Quem pagou">{([['tudo', 'Tudo'], ['eu', 'Eu'], ['outro', otherN]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={who === k} className={who === k ? 'on' : ''} onClick={() => setWho(k)}>{l}</button>)}</div>
      {panel === 'despesa' && p.editing && <div ref={(el) => { if (el && el.dataset.id !== p.editing!.id) { el.dataset.id = p.editing!.id; el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }}><ExpenseForm key={p.editing.id} {...p} close={() => setPanel('')} /></div>}
      <input className="search" type="search" inputMode="search" aria-label="Procurar movimento" placeholder="Procurar (ex.: mercadona, 80)" value={q} onChange={(e) => setQ(e.target.value)} />
      <h3>movimentos{from && !q ? ` desde ${from.slice(8)}/${from.slice(5,7)}` : ''} · {list.length + incN}{q && ` de ${data.expenses.filter((e) => !e.is_deleted).length}`}</h3>
      {cc.total > 0 && <p className="small"><span className={cc.done === cc.total ? 'ok' : 'warn'}>{cc.done} de {cc.total} confirmadas</span><span className="dim"> este mês</span></p>}
      {list.length || incN ? <div className="groups">{groups.map((g) => {
        const isOpen = !!q.trim() || !!open[g.category] || (!!p.editing && g.items.some((e) => e.id === p.editing!.id));
        return <section key={g.category} className={'grp' + (isOpen ? ' open' : '')}>
          <button className={'grp-h' + (g.payers.length === 1 ? ' pay-' + payerTone(data.members, g.payers[0]) : ' pay-mix')} aria-expanded={isOpen} onClick={() => setOpen({ ...open, [g.category]: !open[g.category] })}>
            <span className="chev" aria-hidden>›</span><span className="grow grp-t"><span><span className="cb-i" aria-hidden="true"><IcCat cat={g.category} /></span>{g.category}</span><span className="dim num"><span className="grp-n"> · {g.items.length}</span> · {eur(g.total)}</span></span><Effect c={g.effect} />
          </button>
          <div className="grp-b"><div><ul className="list">{g.items.map((e) => <ExpenseRow key={e.id} e={e} ms={data.members} s={p.state[e.id]} me={me} onConfirm={confirmE} onEdit={() => p.openExpense(e)} />)}</ul></div></div>
        </section>; })}
        {incN > 0 && <section className={'grp' + ((open['+'] || q.trim()) ? ' open' : '')}>
          <button className="grp-h pay-mix" aria-expanded={!!open['+']} onClick={() => setOpen({ ...open, '+': !open['+'] })}><span className="chev" aria-hidden>›</span><span className="grow grp-t"><span>+ Receitas partilhadas</span><span className="dim num"><span className="grp-n"> · {incN}</span> · +{eur(incList.reduce((a, i) => a + (i.amount_cents ?? 0), 0))}</span></span></button>
          <div className="grp-b"><div><ul className="list"><IncomeRows list={incList} data={data} mutate={mutate} state={p.state} me={me} onEdit={(i) => { setIncEdit(i); setPanel('receita'); }} /></ul></div></div>
        </section>}</div> : <p className="dim">Sem movimentos.</p>}
      <label className="check small dim"><input type="checkbox" checked={showGone} onChange={(e) => setShowGone(e.target.checked)} /> mostrar retiradas</label>
      {data.settlements.length > 0 && <details className="grp-d"><summary><h3 style={{ display: 'inline' }}>histórico de acertos · {data.settlements.length}</h3></summary><ul className="list">{data.settlements.map((s) => (
        <li key={s.id} className={'li pay-' + payerTone(data.members, s.from_member)}>
          <div className="grow"><div>{nameOf(data.members, s.from_member)} → {nameOf(data.members, s.to_member)} <Mark s={p.state[s.id]} /></div>
            <div className="dim small">{ptDate(s.date)}{s.method ? ` · ${s.method}` : ''} · <span className={s.confirmed ? 'okt' : 'warn'}>{s.confirmed ? `confirmada${s.confirmed_at ? ' ' + ptDate(s.confirmed_at) : ''}` : 'por confirmar (não conta)'}</span></div></div>
          <span className="num">{eur(s.amount_cents)}</span>
          {!s.confirmed && s.to_member === me && <button onClick={() => confirmS(s.id)}>Confirmar recebido</button>}
        </li>))}</ul></details>}
    </>
  );
}

/** Folha «Adicionar» (fs-v47: folha de baixo, aberta pelo «+»): − despesa (Escrever, Voz, Talão, Da lista) ou + receita; e as fixas por lançar como atalho. Nada é gravado sem confirmares. */
function AddSheet({ panel, close, write, receipt, voice, fromList, income, fixas, launch }: { panel: string; close: () => void; write: () => void; receipt: (r: ReceiptResult) => void; voice: (g: VoiceGuess) => void; fromList?: () => void; income: () => void; fixas: Pendente[]; launch: (x: Pendente) => void }) {
  return (<>
    <div className="scrim" onClick={close} aria-hidden="true" />
    <div className="bsheet add-sheet" role="dialog" aria-label="Adicionar movimento">
      <div className="grab" aria-hidden="true" />
      <div className="row between"><h2>Adicionar</h2><button className="link" onClick={close}>cancelar</button></div>
      <div className="segc sign" role="radiogroup" aria-label="Despesa ou receita">
        <button role="radio" aria-checked className="on">− Despesa</button>
        <button role="radio" aria-checked={false} onClick={income}>+ Receita</button></div>
      <div className="acts two big4">
        <button className="act" onClick={write}><span className="ic"><IcPen /></span>Escrever</button>
        <VoiceButton key={panel} auto={panel === 'voz'} big={panel === 'voz'} aria="Despesa por voz" onResult={voice} />
        <ReceiptButton big={panel === 'talao'} onResult={receipt} />
        <button className="act" disabled={!fromList} onClick={fromList} title={fromList ? '' : 'sem nada no carrinho'}><span className="ic"><IcList /></span>Da lista</button>
      </div>
      {!fromList && <p className="dim small">«Da lista» fica ativo quando houver artigos no carrinho das compras.</p>}
      {fixas.length > 0 && <><h4 className="as-h">ou lança uma fixa que já saiu da conta</h4>
        <div className="fxs no-swipe">{fixas.map((x) => <button key={x.p.id + x.date} className="chip" onClick={() => launch(x)}>{x.p.name}{x.amount != null ? ' ' + eur(x.amount) : ''}</button>)}</div></>}
    </div>
  </>);
}
