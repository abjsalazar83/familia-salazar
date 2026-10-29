import { useMemo } from 'react';
import type { FamilyData } from './lib/useFamily';
import type { Extra } from './Plan';
import { eur, todayIso } from './lib/money';
import { costByCategory, currentPace, fixedVsVariable, ymLabel } from './lib/history';
import { arcs, monthSplit, topIncreases, vsAvg, yoy } from './lib/stats';
import { CPI_LATEST, inflationFor, realChange } from './lib/inflation';
import { payerTone } from './lib/view';
import { hasV7, monthlyEq } from './lib/plan';

const sg = (x: number | null) => x == null ? '—' : `${x > 0 ? '+' : ''}${String(x).replace('.', ',')}%`;
const tone = (x: number | null) => x == null ? 'dim' : x > 0 ? 'bad' : 'ok';

function Spark({ vs }: { vs: number[] }) {
  if (vs.length < 2) return null;
  const max = Math.max(...vs), min = Math.min(...vs), W = 100, H = 30;
  const pts = vs.map((v, i) => [(i / (vs.length - 1)) * W, H - 2 - ((v - min) / Math.max(1, max - min)) * (H - 4)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Tendência 12 meses">
    <path d={d + ` L${W} ${H} L0 ${H} Z`} className="sa" /><path d={d} className="sl" pathLength={1} />
    <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.6" className="sd" /></svg>;
}

function Donut({ parts }: { parts: { v: number; k: string }[] }) {
  const a = arcs(parts.map((p) => p.v)); const R = 15.9155;
  return <svg className="donut" viewBox="0 0 42 42" role="img" aria-label="Categorias">
    <circle cx="21" cy="21" r={R} className="dt" />
    {a.map((x, i) => <circle key={i} cx="21" cy="21" r={R} className={'ds c' + (i % 6)} strokeDasharray={`${Math.max(0, (x.to - x.from) * 100 - 1.2)} 100`} strokeDashoffset={25 - x.from * 100} />)}
  </svg>;
}

/** Resumo visual: total do mês vs médias, inflação INE, tendência, categorias, poupança, divisões e onde poupar. */
export default function Overview({ data, extra }: { data: FamilyData; extra: Extra }) {
  const ms = data.months ?? [];
  const today = todayIso(), ym = today.slice(0, 7);
  const pace = useMemo(() => currentPace(ms, data.expenses, today, 12), [ms, data.expenses, today]);
  const a6 = vsAvg(ms, pace.total.proj, 6), a12 = vsAvg(ms, pace.total.proj, 12);
  const y = useMemo(() => yoy(ms), [ms]);
  const infl = inflationFor(y?.to ?? ym);
  const last12 = [...ms].filter((m) => !m.provisional).sort((p, q) => p.ym.localeCompare(q.ym)).slice(-12);
  const cats = useMemo(() => costByCategory(ms, 12).slice(0, 6), [ms]);
  const ups = useMemo(() => topIncreases(ms), [ms]);
  const sp = useMemo(() => monthSplit(data.expenses, ym), [data.expenses, ym]);
  const v7 = hasV7(extra.payments);
  const fixedSrc = v7 ? extra.payments.filter((p) => !p.is_deleted && p.kind !== 'pessoal').map((p) => ({ name: p.name, amount_cents: monthlyEq(p, today), period: 'mensal' })) : data.bills;
  const fv = fixedVsVariable(fixedSrc, a12?.avg ?? 0);
  const perDay = Math.round(pace.total.spent / Math.max(1, pace.day));
  const payers = data.members.map((m) => ({ m, v: sp.by[m.id] ?? 0, t: payerTone(data.members, m.id) }));
  const paidT = payers.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <section className="ov">
      <div className="hero fade">
        <div className="dim small">{ymLabel(ym)} · previsão a {pace.day}/{pace.dim}</div>
        <div className="big num">{eur(pace.total.proj)}</div>
        <div className="small">{a6 && <span>vs média 6m {eur(a6.avg)} <b className={tone(a6.pct)}>{sg(a6.pct)}</b></span>}{a12 && <span className="dim"> · 12m {eur(a12.avg)} <b className={tone(a12.pct)}>{sg(a12.pct)}</b></span>}</div>
        <Spark vs={last12.map((m) => m.total_cents)} />
        {last12.length > 1 && <div className="axis dim small"><span>{ymLabel(last12[0].ym)}</span><span>12 meses</span><span>{ymLabel(last12[last12.length - 1].ym)}</span></div>}
      </div>

      <div className="tiles fade">
        <div><div className="dim small">por dia</div><div className="t2 num">{eur(perDay)}</div><div className="dim small">gasto {eur(pace.total.spent)}</div></div>
        <div><div className="dim small">fim do mês</div><div className="t2 num">{eur(pace.total.proj)}</div><div className="dim small">ao ritmo atual</div></div>
      </div>

      <h3>inflação</h3>
      <div className="infl fade">
        {y ? <p>Os vossos gastos <b className={tone(y.pct - infl.pct)}>{y.pct >= 0 ? 'subiram' : 'desceram'} {sg(Math.abs(y.pct)).replace('+', '')}</b> em 12 meses; a inflação foi <b>{String(infl.pct).replace('.', ',')}%</b>.
          <span className="dim small block">Em termos reais (descontada a inflação): <b className={tone(realChange(y.pct, infl.pct))}>{sg(realChange(y.pct, infl.pct))}</b> · {eur(y.cur)} vs {eur(Math.round(y.prev * (1 + infl.pct / 100)))} a preços de hoje</span></p>
          : <p className="dim small">Precisa de 24 meses fechados para comparar com a inflação.</p>}
        <div className="dim small">IPC {CPI_LATEST.ym.slice(5)}/{CPI_LATEST.ym.slice(0, 4)}: {String(CPI_LATEST.yoy).replace('.', ',')}% homóloga · {String(CPI_LATEST.avg12).replace('.', ',')}% média 12m · fonte {CPI_LATEST.source}, publicado {CPI_LATEST.published.split('-').reverse().join('/')}</div>
      </div>

      {cats.length > 0 && <><h3>categorias · média 12m</h3>
        <div className="catv fade"><Donut parts={cats.map((c) => ({ v: c.month, k: c.cat }))} />
          <ul className="legend">{cats.map((c, i) => <li key={c.cat}><i className={'c' + (i % 6)} /><span className="grow">{c.cat}</span><span className="num">{eur(c.month)}</span><span className={'num small ' + tone(c.trend)}>{sg(c.trend)}</span></li>)}</ul></div></>}

      {a12 && fixedSrc.length > 0 && <><h3>fixas vs variáveis</h3>
        <div className="bar2 fade"><i className="fx" style={{ flex: fv.fixed }} /><i className="vr" style={{ flex: Math.max(0, fv.variable) }} /></div>
        <div className="kv small"><span><i className="sw fx" />fixas <span className="num">{eur(fv.fixed)}</span></span><span><i className="sw vr" />variáveis <span className="num">{eur(fv.variable)}</span></span></div></>}

      <h3>este mês · quem pagou</h3>
      <div className="bar2 fade">{payers.map((p) => <i key={p.m.id} className={p.t === 'pink' ? 'pn' : 'pa'} style={{ flex: p.v || 0.0001 }} />)}</div>
      <div className="kv small">{payers.map((p) => <span key={p.m.id}><i className={'sw ' + (p.t === 'pink' ? 'pn' : 'pa')} />{p.m.display_name} <span className="num">{eur(p.v)}</span> <span className="dim">{Math.round((p.v / paidT) * 100)}%</span></span>)}</div>
      <div className="kv small dim"><span>partilhadas <span className="num">{eur(sp.shared)}</span></span><span>pessoais <span className="num">{eur(sp.personal)}</span></span></div>

      {ups.length > 0 && <><h3>maiores subidas · 3m vs 12m antes</h3>
        <ul className="list">{ups.map((u) => <li key={u.cat} className="li"><span className="grow">{u.cat}<span className="dim small block">{eur(u.before)} → {eur(u.now)}/mês</span></span><span className="num bad">+{eur(u.diff)}</span></li>)}</ul>
        <p className="dim small">Voltar ao nível anterior poupava ≈ {eur(ups.reduce((s, u) => s + u.diff, 0))}/mês.</p></>}
    </section>
  );
}
