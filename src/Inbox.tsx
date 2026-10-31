import { useMemo, useState } from 'react';
import { IcCheck, IcInbox, IcX } from './Icons';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { inboxItems, type InboxItem } from './lib/inbox';
import { postExpense, type Payment } from './lib/plan';
import { uuid, type Op, type Table } from './lib/outbox';
import type { FamilyData } from './lib/useFamily';
import { nameOf, payerTone } from './lib/view';

type Mutate = (label: string, table: Table, kind: Op['kind'], id: string, row?: Record<string, unknown>) => Promise<boolean>;
const LABEL: Record<InboxItem['kind'], string> = { extrato: 'do extrato', receita: 'receita sem valor', lancar: 'pagamento fixo por lançar', confirmar: 'confirmar valor' };

/** «Por rever»: uma só caixa para o extrato, receitas por preencher, fixas por lançar e confirmações ○. Tudo pela fila local. */
export function Inbox({ data, payments, mutate }: { data: FamilyData; payments: Payment[]; mutate: Mutate }) {
  const me = data.me!.id; const today = todayIso(); const now = () => new Date().toISOString();
  const items = useMemo(() => inboxItems(data, payments, me, today), [data, payments, me, today]);
  const [vals, setVals] = useState<Record<string, string>>({}); const [err, setErr] = useState(''); const [open, setOpen] = useState(true);
  if (!items.length) return null;
  const val = (x: InboxItem, def: number | null) => { const v = vals[x.id]; return v != null && v.trim() !== '' ? parseCents(v) : def; };
  const act = async (x: InboxItem) => {
    setErr('');
    if (x.kind === 'extrato') return mutate('Despesa aceite: já conta no saldo.', 'expenses', 'patch', x.id, { review: null, confirmed_by: me, confirmed_at: now() });
    if (x.kind === 'confirmar') return mutate('Valor confirmado.', 'expenses', 'patch', x.id, { confirmed_by: me, confirmed_at: now() });
    if (x.kind === 'receita') { const c = val(x, null); if (!c || c <= 0) return setErr('Indica o valor da receita (ex.: 120,00).'); return mutate('Receita preenchida.', 'shared_incomes', 'patch', x.id, { amount_cents: c }); }
    const c = val(x, x.amount); if (!c || c <= 0) return setErr(`Indica o valor de ${x.p.name}.`);
    const id = uuid(); const row = postExpense(x.p, x.date, c, data.members.map((m) => m.id), me);
    if (await mutate(`${x.p.name} lançado.`, 'expenses', 'create', id, { id, family_id: data.me!.family_id, ...row, is_deleted: false, created_at: now() }))
      await mutate('Pagamento marcado.', 'payments', 'patch', x.p.id, { last_posted: x.date, expense_id: id });
  };
  const dismiss = (x: InboxItem) => {
    if (x.kind === 'extrato') return mutate('Descartada (fica no histórico).', 'expenses', 'patch', x.id, { review: 'descartada' });
    if (x.kind === 'lancar' && confirm(`Marcar ${x.p.name} de ${ptDate(x.date)} como já registado (sem criar despesa)?`)) return mutate('Marcado como já registado.', 'payments', 'patch', x.p.id, { last_posted: x.date });
  };
  const who = (x: InboxItem) => x.kind === 'receita' ? x.i.received_by : x.kind === 'lancar' ? x.p.owner_member ?? me : x.e.paid_by;
  const title = (x: InboxItem) => x.kind === 'receita' ? x.i.note || x.i.category : x.kind === 'lancar' ? x.p.name : x.e.description;
  const date = (x: InboxItem) => x.kind === 'receita' ? x.i.date : x.kind === 'lancar' ? x.date : x.e.date;
  const amount = (x: InboxItem) => x.kind === 'receita' ? null : x.kind === 'lancar' ? x.amount : x.e.amount_cents;
  const n = (k: InboxItem['kind']) => items.filter((x) => x.kind === k).length;
  return (
    <section className="card inbox" aria-label="Por rever">
      <button className="row between plain wide" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="row"><span className="ic" aria-hidden><IcInbox /></span><h2 style={{ margin: 0 }}>Por rever · {items.length}</h2></span><span className="chev" aria-hidden>{open ? '⌃' : '⌄'}</span></button>
      <p className="dim small">{[n('extrato') && `${n('extrato')} do extrato (não contam)`, n('lancar') && `${n('lancar')} por lançar`, n('receita') && `${n('receita')} receitas sem valor`, n('confirmar') && `${n('confirmar')} por confirmar`].filter(Boolean).join(' · ')}</p>
      {open && <ul className="list">{items.map((x) => {
        const needsVal = x.kind === 'receita' || x.kind === 'lancar';
        return <li key={x.kind + x.id} className={'li pay-' + payerTone(data.members, who(x))}>
          <div className="grow"><div>{title(x)}</div><div className="dim small">{LABEL[x.kind]} · {ptDate(date(x))} · {nameOf(data.members, who(x))}{x.kind === 'extrato' && x.e.reason ? ' · ' + x.e.reason : ''}</div></div>
          {needsVal ? <input className="num amt" inputMode="decimal" aria-label={`Valor de ${title(x)}`} placeholder="valor" value={vals[x.id] ?? (amount(x) != null ? centsToInput(amount(x)!) : '')} onChange={(e) => setVals({ ...vals, [x.id]: e.target.value })} />
            : <span className="num">{eur(amount(x) ?? 0)}</span>}
          <button className="pri small" aria-label={x.kind === 'lancar' ? 'Lançar' : x.kind === 'receita' ? 'Guardar' : x.kind === 'extrato' ? 'Aceitar' : 'Confirmar'} onClick={() => act(x)}><IcCheck /></button>
          {(x.kind === 'extrato' || x.kind === 'lancar') && <button className="dim small" aria-label={x.kind === 'extrato' ? 'Descartar' : 'Já registado'} onClick={() => dismiss(x)}><IcX /></button>}
        </li>; })}</ul>}
      {err && <p className="err small" role="alert">{err}</p>}
    </section>
  );
}
