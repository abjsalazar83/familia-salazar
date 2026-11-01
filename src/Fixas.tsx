// Ecrã «Fixas»: só modelos (pagamentos e receitas fixas). O que vence aparece no Mês, em «por confirmar».
import { useState } from 'react';
import { IcIn } from './Icons';
import { type IncomeRule } from './lib/income';
import { payerTone, nameOf } from './lib/view';
import type { } from '@supabase/supabase-js';
import { eur, parseCents, centsToInput } from './lib/money';
import { type Bill } from './lib/types';
import { Upcoming, paymentsOf } from './Plan';
import { hasV7 } from './lib/plan';
import type { } from './lib/voice';
import { monthly } from './lib/history';
import { type Ctx, Mark } from './App';
export function Bills({ data, mutate, state, extra, online }: Ctx) {
  const [edit, setEdit] = useState<string | null>(null);
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const bills = data.bills;
  const total = bills.reduce((s, b) => s + (monthly(b.amount_cents, b.period) ?? 0), 0);
  const unknown = bills.filter((b) => b.amount_cents == null).length;
  const save = async (b: Bill) => {
    setErr('');
    const c = val.trim() === '' ? null : parseCents(val);
    if (val.trim() !== '' && c === null) return setErr('valor inválido (ex.: 12,50)');
    if (await mutate('Conta atualizada.', 'recurring_bills', 'patch', b.id, { amount_cents: c, estimate: false })) setEdit(null);
  };
  const [f, setF] = useState<'tudo' | 'pag' | 'rec'>('tudo');
  const v7 = hasV7(paymentsOf(data, extra)); const rules = (data.incomeRules ?? []);
  const showOld = !v7 && bills.length > 0;
  const toggleRule = (r: IncomeRule) => confirm(r.active ? `Parar a receita fixa «${r.name}»? As entradas antigas ficam no histórico.` : `Retomar a receita fixa «${r.name}»?`) && mutate(r.active ? 'Receita fixa parada.' : 'Receita fixa retomada.', 'income_rules', 'patch', r.id, { active: !r.active });
  return (
    <>
      <h2>Fixas</h2>
      <div className="segc" role="radiogroup" aria-label="Mostrar">{([['tudo', 'Tudo'], ['pag', 'Pagamentos'], ['rec', 'Receitas']] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={f === k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      {f !== 'rec' && <Upcoming data={data} extra={extra} mutate={mutate} />}
      {f !== 'pag' && <section className="group"><h3>receitas fixas · {rules.length}</h3>
        {rules.length ? <ul className="list">{rules.map((r) => <li key={r.id} className={'li inc pay-' + payerTone(data.members, r.received_by)}>
          <span className={'inc-ic tone-' + payerTone(data.members, r.received_by)} aria-hidden><IcIn /></span>
          <div className="grow"><div>{r.name} <Mark s={state[r.id]} /></div><div className="dim small">dia {r.day} · {r.category} · recebe {nameOf(data.members, r.received_by)}{r.receiver_pct !== 50 ? ` · ${r.receiver_pct}/${100 - r.receiver_pct}` : ''}</div></div>
          <span className={r.active ? 'okt small' : 'warn small'}>{r.active ? 'ativa' : 'parada'}</span>
          <button className="link small" onClick={() => toggleRule(r)}>{r.active ? 'parar' : 'retomar'}</button>
        </li>)}</ul> : <p className="dim small">Sem receitas fixas. Cria uma em Mês › Adicionar › + Receita, marcando «repete todos os meses».</p>}
        <p className="dim small">O valor de cada mês nunca é inventado: aparece no Mês, no aviso «por confirmar», para preencher.</p></section>}
      {f !== 'rec' && showOld && <>
      <h3>contas da casa (antigas)</h3>
      <div className="kpi"><div><span className="big num">{eur(total)}</span><span className="dim per">/mês</span></div>
        <div className="dim">{unknown ? `${unknown} por registar · ` : ''}≈ = estimativa</div></div>
      <ul className="list">{bills.map((b) => (
        <li key={b.id} className="li col">
          <button className="row-btn" aria-expanded={edit === b.id} onClick={() => { setEdit(edit === b.id ? null : b.id); setVal(b.amount_cents == null ? '' : centsToInput(b.amount_cents)); setErr(''); }}>
            <span className="grow">{b.name} <Mark s={state[b.id]} /></span>
            {b.amount_cents == null ? <span className="warn small">valor por registar</span>
              : <span className="num">{b.estimate ? '≈ ' : ''}{eur(b.amount_cents)}<span className="dim small">{PER[b.period]}</span></span>}
          </button>
          {(b.note || b.payer || b.method) && <div className="sub dim small">{[b.payer, b.method, b.note].filter(Boolean).join(' · ')}</div>}
          {edit === b.id && <div className="sub row">
            <input className="num" inputMode="decimal" aria-label={`Valor de ${b.name}`} value={val} onChange={(e) => setVal(e.target.value)} placeholder="0,00" autoFocus />
            <button className="pri" onClick={() => save(b)}>guardar</button>{err && <span className="err small">{err}</span>}</div>}
        </li>))}</ul></>}
    </>
  );
}

const PER: Record<Bill['period'], string> = { mensal: '/mês', bimestral: '/2 meses', trimestral: '/3 meses', anual: '/ano', 'variável': '/mês' };
