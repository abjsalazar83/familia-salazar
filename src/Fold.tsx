// fs-v47 — linha que abre com um toque (Resumo: «o essencial» e «mais»). O conteúdo aberto fica sem caixa dentro de caixa.
import { useState, type ReactNode } from 'react';

export function Fold({ ic, title, sub, value, children, open: start = false, id }: { ic: ReactNode; title: ReactNode; sub?: ReactNode; value?: ReactNode; children: ReactNode; open?: boolean; id?: string }) {
  const [open, setOpen] = useState(start);
  return <div className={'fold' + (open ? ' open' : '')} id={id}>
    <button className="fold-h" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="fold-i" aria-hidden="true">{ic}</span>
      <span className="fold-t"><span className="fold-n">{title}</span>{sub && <small>{sub}</small>}</span>
      {value != null && <span className="fold-v num">{value}</span>}
      <span className="fold-c" aria-hidden="true">›</span>
    </button>
    {open && <div className="fold-b">{children}</div>}
  </div>;
}
export const Folds = ({ children, label }: { children: ReactNode; label: string }) => <div className="folds" role="group" aria-label={label}>{children}</div>;
