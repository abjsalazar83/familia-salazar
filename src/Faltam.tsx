// fs-v44 — «Faltam lançar»: as despesas fixas são só lembretes. Nada entra no mês sozinho:
// tocar numa fixa abre a despesa já preenchida; confirmas o valor real (depois de sair da conta) e guardas.
import { useMemo, useState } from 'react';
import { IcRepeat, IcX } from './Icons';
import { eur, ptDate, todayIso } from './lib/money';
import { pendentes, pendentesText, type Payment, type Pendente } from './lib/payments';
import type { Mutate } from './lib/outbox';
import type { FamilyData } from './lib/useFamily';
import { nameOf, payerTone } from './lib/view';

export function Faltam({ data, payments, mutate, launch }: { data: FamilyData; payments: Payment[]; mutate: Mutate; launch: (x: Pendente) => void }) {
  const today = todayIso(); const me = data.me!.id;
  const xs = useMemo(() => pendentes(payments, data.expenses as never, today), [payments, data.expenses, today]);
  const [open, setOpen] = useState(false);
  if (!xs.length) return null;
  const skip = (x: Pendente) => {
    if (!confirm(`${x.p.name}: já está registado ou não há este mês? Sai do lembrete (não cria despesa).`)) return;
    void mutate('Tirado do lembrete deste mês.', 'payments', 'patch', x.p.id, { last_posted: x.date });
  };
  return (
    <section className={'inbox faltam' + (open ? ' card' : '')} aria-label="Fixas por lançar">
      <button className="banner row between wide" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="row grow fl-t"><span className="ic" aria-hidden><IcRepeat /></span><b>{pendentesText(xs)}</b></span><span className="dim small">{open ? 'fechar' : 'ver ›'}</span></button>
      {open && <><p className="dim small">Nada é lançado sozinho. Toca numa fixa quando já tiver saído da conta: abre a despesa preenchida para confirmares o valor real.</p>
        <ul className="list">{xs.map((x) => {
          const who = x.p.owner_member ?? me;
          return <li key={x.p.id + x.date} className={'li pay-' + payerTone(data.members, who)}>
            <button className="row-btn plain grow fl-row" aria-label={`Lançar ${x.p.name}`} onClick={() => launch(x)}>
              <span className="grow"><span className="block">{x.p.name}</span><span className="dim small">{x.undated ? 'este mês · sem dia' : ptDate(x.date)} · {nameOf(data.members, who)}{x.p.kind === 'pessoal' ? ' · pessoal' : ''}</span></span>
              <span className="num">{x.amount != null ? eur(x.amount) : x.hint != null ? '≈ ' + eur(x.hint) : 'valor?'}</span>
            </button>
            <button className="dim small" aria-label={`${x.p.name}: já registado`} onClick={() => skip(x)}><IcX /></button>
          </li>; })}</ul></>}
    </section>
  );
}
