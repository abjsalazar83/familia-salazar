import { useMemo, useState } from 'react';
import { IcCheck, IcInbox, IcX } from './Icons';
import { eur, parseCents, centsToInput, ptDate } from './lib/money';
import { inboxItems, type InboxItem } from './lib/inbox';
import type { Mutate } from './lib/outbox';
import type { FamilyData } from './lib/useFamily';
import { nameOf, payerTone } from './lib/view';

const LABEL: Record<InboxItem['kind'], string> = { extrato: 'do extrato', receita: '+ receita fixa por preencher', confirmar: 'confirmar valor' };

/** Aviso «N por confirmar»: uma só lista para o extrato, receitas por preencher, confirmações ○. Tudo pela fila local. */
export function Inbox({ data, mutate, open, toggle }: { data: FamilyData; mutate: Mutate; open: boolean; toggle: () => void }) {
  const me = data.me!.id; const now = () => new Date().toISOString();
  const items = useMemo(() => inboxItems(data, me), [data, me]);
  const [vals, setVals] = useState<Record<string, string>>({}); const [err, setErr] = useState('');
  if (!items.length) return null;
  const val = (x: InboxItem, def: number | null) => { const v = vals[x.id]; return v != null && v.trim() !== '' ? parseCents(v) : def; };
  const act = async (x: InboxItem) => {
    setErr('');
    if (x.kind === 'extrato') return mutate('Despesa aceite: já conta no saldo.', 'expenses', 'patch', x.id, { review: null, confirmed_by: me, confirmed_at: now() });
    if (x.kind === 'confirmar') return mutate('Valor confirmado.', 'expenses', 'patch', x.id, { confirmed_by: me, confirmed_at: now() });
    const c = val(x, null); if (!c || c <= 0) return setErr('Indica o valor da receita (ex.: 120,00).'); return mutate('Receita preenchida.', 'shared_incomes', 'patch', x.id, { amount_cents: c });
  };
  const dismiss = (x: InboxItem) => { if (x.kind === 'extrato') return mutate('Descartada (fica no histórico).', 'expenses', 'patch', x.id, { review: 'descartada' }); };
  const who = (x: InboxItem) => x.kind === 'receita' ? x.i.received_by : x.e.paid_by;
  const title = (x: InboxItem) => x.kind === 'receita' ? x.i.note || x.i.category : x.e.description;
  const date = (x: InboxItem) => x.kind === 'receita' ? x.i.date : x.e.date;
  const amount = (x: InboxItem) => x.kind === 'receita' ? null : x.e.amount_cents;
  const n = (k: InboxItem['kind']) => items.filter((x) => x.kind === k).length;
  return (
    <section className={'inbox' + (open ? ' card' : '')} aria-label="Por confirmar">
      <button className="banner row between wide" aria-expanded={open} onClick={toggle}>
        <span className="row"><span className="ic" aria-hidden><IcInbox /></span><b>{items.length} por confirmar</b></span><span className="dim small">{open ? 'fechar' : 'rever ›'}</span></button>
      {open && <p className="dim small">{[n('extrato') && `${n('extrato')} do extrato (não contam)`, n('receita') && `${n('receita')} receitas por preencher`, n('confirmar') && `${n('confirmar')} por confirmar`].filter(Boolean).join(' · ')}</p>}
      {open && <ul className="list">{items.map((x) => {
        const needsVal = x.kind === 'receita';
        return <li key={x.kind + x.id} className={'li pay-' + payerTone(data.members, who(x))}>
          <div className="grow"><div>{title(x)}</div> <div className="dim small">{LABEL[x.kind]} · {ptDate(date(x))} · {nameOf(data.members, who(x))}{x.kind === 'extrato' && x.e.reason ? ' · ' + x.e.reason : ''}</div></div>
          {needsVal ? <input className="num amt" inputMode="decimal" aria-label={`Valor de ${title(x)}`} placeholder="valor" value={vals[x.id] ?? (amount(x) != null ? centsToInput(amount(x)!) : '')} onChange={(e) => setVals({ ...vals, [x.id]: e.target.value })} />
            : <span className="num">{eur(amount(x) ?? 0)}</span>}
          <button className="pri small" aria-label={x.kind === 'receita' ? 'Guardar' : x.kind === 'extrato' ? 'Aceitar' : 'Confirmar'} onClick={() => act(x)}><IcCheck /></button>
          {x.kind === 'extrato' && <button className="dim small" aria-label="Descartar" onClick={() => dismiss(x)}><IcX /></button>}
        </li>; })}</ul>}
      {err && <p className="err small" role="alert">{err}</p>}
    </section>
  );
}
