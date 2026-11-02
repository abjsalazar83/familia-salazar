// Revisão das linhas lidas do talão: cada linha → item da lista, «adicionar como novo» ou «ignorar». Nada é gravado aqui.
import { useState } from 'react';
import { eur } from './lib/money';
import { qtyText } from './lib/shop';
import type { RLine } from './lib/receiptLines';

export type Pick = Record<number, string>; // índice da linha → id do item | 'add' | ''
export function ReceiptReview({ lines, items, initial, onConfirm, onSkip }: { lines: RLine[]; items: { id: string; name: string }[]; initial: Pick; onConfirm: (p: Pick) => void; onSkip: () => void }) {
  const [pick, setPick] = useState<Pick>(() => Object.fromEntries(lines.map((_, k) => [k, initial[k] ?? ''])));
  const taken = (id: string, k: number) => Object.entries(pick).some(([j, v]) => v === id && Number(j) !== k);
  const nMatch = Object.values(pick).filter((v) => v && v !== 'add').length, nAdd = Object.values(pick).filter((v) => v === 'add').length;
  return (
    <div className="form sheet rrev">
      <h3>Linhas do talão</h3>
      <p className="muted small">Confere cada produto. Só é gravado depois de confirmares a despesa.</p>
      <ul className="rl">
        {lines.map((l, k) => (
          <li key={k} className={pick[k] ? 'on' : ''}>
            <div className="rl-t"><span className="rl-n">{l.name}</span><b className="num">{eur(l.total)}</b></div>
            {l.qty != null && <div className="muted small">{qtyText(l.qty, l.unit)}{l.unitPrice != null ? ` × ${eur(l.unitPrice)}${l.unit && l.unit !== 'un' ? '/' + l.unit : ''}` : ''}</div>}
            <select aria-label={`Linha ${l.name}`} value={pick[k]} onChange={(e) => setPick({ ...pick, [k]: e.target.value })}>
              <option value="">Ignorar</option>
              {items.map((it) => <option key={it.id} value={it.id} disabled={taken(it.id, k)}>= {it.name}</option>)}
              <option value="add">+ Adicionar «{l.name.slice(0, 28)}»</option>
            </select>
          </li>
        ))}
      </ul>
      <div className="acts">
        <button className="act pri" onClick={() => onConfirm(pick)}>Usar {nMatch + nAdd} {nMatch + nAdd === 1 ? 'linha' : 'linhas'}</button>
        <button className="act" onClick={onSkip}>Sem linhas</button>
      </div>
    </div>
  );
}
