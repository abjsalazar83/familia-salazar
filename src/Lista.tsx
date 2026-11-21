// fs-v45/v48 — «Keep»: a nota do mês como no Google Keep da família, já a metade. SÓ CONSULTA — nada aqui se edita; só copiar o texto.
import { useMemo, useRef, useState } from 'react';
import { IcBack, IcCheck } from './Icons';
import { todayIso } from './lib/money';
import { keepAlias, keepMonth, keepText } from './lib/keep';
import type { Expense, Member } from './lib/types';
import type { SharedIncome } from './lib/income';
import type { MonthClose } from './lib/monthclose';

const addYm = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* sem permissão: alternativa abaixo */ }
  const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  const ok = document.execCommand('copy'); ta.remove(); return ok;
}

export function Lista({ exps, members, incomes = [], closes = [], close, initial }: { exps: Expense[]; members: Member[]; incomes?: SharedIncome[]; closes?: MonthClose[]; close: () => void; initial?: string }) {
  const now = todayIso().slice(0, 7);
  const [ym, setYm] = useState(initial ?? now); const [ok, setOk] = useState(false);
  const alias = keepAlias();
  const text = useMemo(() => keepText(exps, members, ym, alias, incomes, closes), [exps, members, ym, alias, incomes, closes]);
  const first = useMemo(() => exps.reduce((m, e) => (!e.is_deleted && e.date && e.date.slice(0, 7) < m ? e.date.slice(0, 7) : m), now), [exps, now]);
  const go = (n: number) => { const t = addYm(ym, n); if (t <= now && t >= first) { setYm(t); setOk(false); } };
  const x0 = useRef<number | null>(null);
  const copy = async () => { if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 2000); } };
  return (
    <div className="lista" role="dialog" aria-label={`Keep de ${keepMonth(ym)} (só consulta)`}
      onTouchStart={(e) => { x0.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (x0.current == null) return; const dx = e.changedTouches[0].clientX - x0.current; x0.current = null; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }}>
      <div className="lista-top">
        <button className="link" aria-label="Voltar" onClick={close}><IcBack /></button>
        <div className="lista-nav">
          <button aria-label="Mês anterior" disabled={ym <= first} onClick={() => go(-1)}>‹</button>
          <b className="keep-t">Keep<small>{keepMonth(ym)}</small></b>
          <button aria-label="Mês seguinte" disabled={ym >= now} onClick={() => go(1)}>›</button>
        </div>
        <button className="pri small lista-cp" onClick={copy}>{ok ? <><IcCheck /> Copiado</> : 'Copiar'}</button>
      </div>
      <pre className="lista-note" aria-readonly="true">{text}</pre>
      <p className="dim small lista-foot">Só consulta · tudo já a metade: cada bloco é o que essa pessoa deve à outra (despesas partilhadas que a outra pagou + receitas partilhadas que ela recebeu) · a última linha é o acerto do mês · desliza para mudar de mês</p>
    </div>
  );
}
