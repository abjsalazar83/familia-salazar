// Uma barra horizontal por categoria, ordenadas por valor, com a variação face ao mês anterior (▲/▼ %).
import { eur } from './lib/money';

export type CatBar = { cat: string; v: number; pct: number | null; sub?: string; flag?: boolean };

export function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="cb-d dim">novo</span>;
  if (pct === 0) return <span className="cb-d dim">= 0%</span>;
  return <span className={'cb-d ' + (pct > 0 ? 'bad' : 'ok')} aria-label={`${pct > 0 ? 'subiu' : 'desceu'} ${Math.abs(pct)}%`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}

export default function CatBars({ rows, empty = 'sem despesas' }: { rows: CatBar[]; empty?: string }) {
  if (!rows.length) return <p className="dim small">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <ul className="cbars">
      {rows.map((r) => <li key={r.cat} className={r.flag ? 'flag' : ''}>
        <div className="cb-top"><span className="cb-n">{r.flag ? '▲ ' : ''}{r.cat}</span><span className="num cb-v">{eur(r.v)}</span><Delta pct={r.pct} /></div>
        <div className="cb-bar" aria-hidden="true"><i style={{ width: Math.max(2, (r.v / max) * 100) + '%' }} /></div>
        {r.sub && <div className="dim small cb-sub">{r.sub}</div>}
      </li>)}
    </ul>
  );
}
