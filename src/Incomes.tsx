import { useEffect, useRef, useState } from 'react';
import { IcIn } from './Icons';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { uuid, type Mutate } from './lib/outbox';
import type { FamilyData } from './lib/useFamily';
import { nameOf, payerTone } from './lib/view';
import { INCOME_CATS, dueIncomeEntries, incomeEffect, otherShare, type IncomeCat, type IncomeRule, type SharedIncome } from './lib/income';

const nm = (d: FamilyData, id: string) => nameOf(d.members, id);

/** Cria (uma vez por mês) as entradas por preencher das receitas fixas. O valor fica vazio: nunca inventado. */
export function useAutoIncome(data: FamilyData, mutate: Mutate) {
  const done = useRef('');
  useEffect(() => {
    if (!data.me || !data.incomeRules?.length) return;
    const ym = todayIso().slice(0, 7);
    const due = dueIncomeEntries(data.incomeRules, data.incomes ?? [], ym);
    const key = ym + due.map((d) => d.rule_id).join();
    if (!due.length || done.current === key) return;
    done.current = key;
    // id determinístico por (regra, mês) não é possível em uuid v4; o servidor impede duplicados com índice único (rule_id, ym).
    for (const d of due) { const id = uuid(); mutate(`Receita fixa «${d.note}» por preencher.`, 'shared_incomes', 'create', id, { id, ...d, created_at: new Date().toISOString() }); }
  }, [data.incomeRules, data.incomes, data.me, mutate]);
}

export function IncomeForm({ data, mutate, editing, close }: { data: FamilyData; mutate: Mutate; editing: SharedIncome | null; close: () => void }) {
  const me = data.me!; const ms = data.members;
  const [f, setF] = useState(() => ({
    amount: editing?.amount_cents != null ? centsToInput(editing.amount_cents) : '', by: editing?.received_by ?? ms.find((m) => payerTone(ms, m.id) === 'pink')?.id ?? me.id,
    cat: (editing?.category ?? 'Abono') as IncomeCat, date: editing?.date ?? todayIso(), note: editing?.note ?? '', pct: String(editing?.receiver_pct ?? 50), fixed: false, day: '1',
  }));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const cents = parseCents(f.amount); const pct = Number(f.pct);
  const other = ms.find((m) => m.id !== f.by);
  const save = async () => {
    setErr('');
    if (!cents || cents <= 0) return setErr('Indica o valor recebido (ex.: 120,00).');
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) return setErr('A parte de quem recebe tem de ser entre 0 e 100 %.');
    setBusy(true);
    const row = { amount_cents: cents, received_by: f.by, category: f.cat, date: f.date || todayIso(), note: f.note.trim() || null, receiver_pct: pct };
    let ok: boolean;
    if (editing) ok = await mutate('Receita atualizada.', 'shared_incomes', 'patch', editing.id, row);
    else {
      let rule: string | null = null;
      if (f.fixed) {
        rule = uuid();
        await mutate('Receita fixa criada.', 'income_rules', 'create', rule, { id: rule, family_id: me.family_id, name: f.note.trim() || f.cat, category: f.cat, received_by: f.by, receiver_pct: pct, day: Math.min(28, Math.max(1, Number(f.day) || 1)), active: true, is_deleted: false, created_at: new Date().toISOString() });
      }
      const id = uuid();
      ok = await mutate('Receita partilhada registada.', 'shared_incomes', 'create', id, { id, family_id: me.family_id, ...row, rule_id: rule, ym: rule ? row.date.slice(0, 7) : null, confirmed_by: null, confirmed_at: null, is_deleted: false, created_at: new Date().toISOString() });
    }
    setBusy(false); if (ok) close(); else setErr('Não foi guardada. Tenta de novo.');
  };
  const remove = async () => {
    if (!editing || !confirm('Retirar esta receita do saldo? Fica no histórico como retirada.')) return;
    if (await mutate('Receita retirada do saldo.', 'shared_incomes', 'patch', editing.id, { is_deleted: true })) close();
  };
  const share = cents && other ? otherShare({ amount_cents: cents, received_by: f.by, receiver_pct: pct, is_deleted: false }) : 0;
  return (
    <div className="form">
      <h2>{editing ? (editing.amount_cents == null ? 'Preencher receita fixa' : 'Editar receita') : 'Receita partilhada'}</h2>
      <label className="field"><span className="lab">Quanto entrou? (€)</span><input className="num" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" autoFocus /></label>
      <span className="lab">Quem recebeu?</span>
      <div className="seg" role="radiogroup" aria-label="Quem recebeu?">{ms.map((m) => <button key={m.id} role="radio" aria-checked={f.by === m.id} className={(f.by === m.id ? 'pri ' : '') + 'tone-' + payerTone(ms, m.id)} onClick={() => setF({ ...f, by: m.id })}>{m.display_name}</button>)}</div>
      <span className="lab">Tipo</span>
      <div className="seg" role="radiogroup" aria-label="Tipo">{INCOME_CATS.map((c) => <button key={c} role="radio" aria-checked={f.cat === c} className={f.cat === c ? 'pri' : ''} onClick={() => setF({ ...f, cat: c })}>{c}</button>)}</div>
      <details>
        <summary>Mais opções (data, nota, divisão{editing ? '' : ', todos os meses'})</summary>
        <label className="field"><span className="lab">Data</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="field"><span className="lab">Nota</span><input value={f.note} maxLength={120} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="ex.: abono das meninas" /></label>
        <label className="field"><span className="lab">Parte de quem recebe (%)</span><input className="num" inputMode="numeric" value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} /></label>
        {!editing && <label className="check small"><input type="checkbox" checked={f.fixed} onChange={(e) => setF({ ...f, fixed: e.target.checked })} /> repete todos os meses (receita fixa)</label>}
        {!editing && f.fixed && <label className="field"><span className="lab">Dia do mês</span><input className="num" inputMode="numeric" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></label>}
      </details>
      {share > 0 && other && <p className="dim small">{nm(data, f.by)} deve {eur(share)} a {other.display_name} · entra no acerto do mês</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button className="pri" disabled={busy} onClick={save}>{busy ? 'A guardar…' : 'Guardar'}</button><button onClick={close} disabled={busy}>Cancelar</button>{editing && <button className="danger" onClick={remove}>Retirar</button>}</div>
    </div>
  );
}

/** Receitas partilhadas do mês como movimentos «+», na mesma lista das despesas. As por preencher vivem no aviso «por confirmar». */
export function IncomeRows({ data, mutate, state, me, onEdit }: { data: FamilyData; mutate: Mutate; state: Record<string, 'pending' | 'failed'>; me: string; onEdit: (i: SharedIncome) => void }) {
  const list = (data.incomes ?? []).filter((i) => !i.is_deleted && i.amount_cents != null);
  const confirmI = (i: SharedIncome) => mutate(i.confirmed_by ? 'Confirmação retirada.' : 'Valor confirmado.', 'shared_incomes', 'patch', i.id, i.confirmed_by ? { confirmed_by: null, confirmed_at: null } : { confirmed_by: me, confirmed_at: new Date().toISOString() });
  return <>{list.map((i) => {
    const eff = incomeEffect(i, me); const can = i.received_by !== me && (!i.confirmed_by || i.confirmed_by === me);
    return <li key={i.id} id={'i-' + i.id} className={'li inc pay-' + payerTone(data.members, i.received_by)}>
      <span className={'inc-ic tone-' + payerTone(data.members, i.received_by)} aria-hidden><IcIn /></span>
      <button className="grow plain" onClick={() => onEdit(i)}>
        <div>{i.note || i.category} <span className="dim small">· receita</span> {state[i.id] && <span className="tag warn">Por sincronizar</span>}</div>
        <div className="dim small">{ptDate(i.date)} · {i.category} · recebeu {nm(data, i.received_by)}{i.receiver_pct !== 50 ? ` · ${i.receiver_pct}/${100 - i.receiver_pct}` : ''}{i.rule_id ? ' · fixa' : ''}</div>
      </button>
      <span className={'num eff tone-' + payerTone(data.members, i.received_by)}><b>+{eur(i.amount_cents!)}</b><small className="dim">acerto {eff > 0 ? '+' : eff < 0 ? '−' : ''}{eur(Math.abs(eff))}</small></span>
      {i.received_by !== me && <button className="cf" aria-label={i.confirmed_by ? 'Confirmada' : 'Confirmar este valor'} disabled={!can} onClick={() => confirmI(i)}>{i.confirmed_by ? '✓' : '○'}</button>}
    </li>; })}</>;
}
