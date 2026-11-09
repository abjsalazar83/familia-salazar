// Resumo: meta de poupança (vs habitual), mesmo mês do ano passado + inflação INE, e «Meninas & escola» por mês.
import { useMemo, useState } from 'react';
import { IcPiggy, IcKids, IcCat } from './Icons';
import { eur, eurRound } from './lib/money';
import { supabase } from './lib/supabase';
import { ymLabel } from './lib/history';
import type { GoalState } from './lib/goal';
import { cpiFor, hasYoY, lastYearYm, yoy, type Cpi } from './lib/yoy';
import { kidsAvg, kidsMonths, SUBCATS } from './lib/kids';
import type { HistoryMonth, Expense } from './lib/types';
import type { Extra } from './Plan';
import CPI from './data/cpi.json';

export function GoalCard({ g }: { g: GoalState }) {
  const tone = g.status === 'ok' ? 'ok' : g.status === 'acima' ? 'bad' : g.status === 'atencao' ? 'warn' : 'dim';
  const label = g.status === 'ok' ? 'no caminho' : g.status === 'acima' ? 'acima do habitual' : g.status === 'atencao' ? 'atenção' : 'sem dados';
  return <section className="card goal" aria-label="Meta de poupança">
    <span className={'mc-i ' + tone} aria-hidden="true"><IcPiggy /></span>
    <div className="grow">
      <div className="kv"><b>Meta {eurRound(g.goal)}/mês</b><span className={'pill ' + tone}>{label}</span></div>
      {g.usual == null ? <div className="dim small">Precisa de pelo menos 3 meses fechados ({g.months} até agora).</div>
        : <><div className="small">ritmo ≈ {eur(g.projected)} · habitual {eur(g.usual)}</div>
          <div className={'small ' + (g.diff! > 0 ? tone : 'ok')}>{g.diff! > 0 ? `≈ ${eur(g.diff!)} acima → poupança ≈ ${eur(Math.max(0, g.goalLeft!))} de ${eur(g.goal)}` : `≈ ${eur(-g.diff!)} abaixo do habitual → meta protegida`}</div></>}
      <div className="dim small">estimativa · a app só vê despesas partilhadas · habitual = mediana de {g.months} meses fechados</div>
    </div>
  </section>;
}

const sign = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toLocaleString('pt-PT', { maximumFractionDigits: 1 });

export function YoYCard({ ms, ym, cats, total, projected, extra, online }: { ms: HistoryMonth[]; ym: string; cats: Record<string, number>; total: number; projected: boolean; extra: Extra; online: boolean }) {
  const st = extra.settings;
  const [man, setMan] = useState<{ pct: number | null; ym: string | null }>({ pct: st?.cpi_manual ?? null, ym: st?.cpi_manual_ym ?? null });
  const infl = cpiFor(ym, CPI as Cpi, man);
  const r = useMemo(() => hasYoY(ms, ym) ? yoy(ms, ym, cats, total, infl?.pct ?? null) : null, [ms, ym, cats, total, infl?.pct]);
  const [open, setOpen] = useState(false);
  if (!r) return null; // sem meses suficientes: escondido
  const setManual = async () => {
    const v = prompt(`Inflação (IPC, variação homóloga, %) para ${ymLabel(ym)} — valor publicado pelo INE:`, man.pct != null ? String(man.pct).replace('.', ',') : '');
    if (v == null) return; const t = v.trim().replace(',', '.'); const n = t === '' ? null : Number(t);
    if (n != null && (!Number.isFinite(n) || n < -50 || n > 100)) return alert('Valor inválido.');
    const { error } = await supabase.from('family_settings').update({ cpi_manual: n, cpi_manual_ym: n == null ? null : ym }).eq('family_id', st!.family_id);
    if (error) return alert('Não foi possível guardar: ' + error.message);
    setMan({ pct: n, ym: n == null ? null : ym }); extra.reload();
  };
  const t = r.total;
  return <section className="card yoy" aria-label="Comparação com o ano passado">
    <div className="kv"><b>vs {ymLabel(r.ly)}</b><span className="dim small">{projected ? 'previsão do mês' : 'mês fechado'}</span></div>
    <div className="yoy-t"><span className="num">{eur(t.now)}</span><span className="dim small"> vs {eur(t.before)}</span>
      {t.pct != null && <span className={'pill ' + (t.pct > (infl?.pct ?? 0) ? 'bad' : 'ok')}>{sign(t.pct)}%</span>}</div>
    <div className="small">{infl ? <>inflação {sign(infl.pct)}% <span className="dim">({infl.source === 'ine' ? 'INE' : 'indicada à mão'} · {ymLabel(infl.ym)}{infl.exact ? '' : ', último publicado'})</span>{t.real != null && <> · <span className={t.real > 0 ? 'bad' : 'ok'}>{sign(t.real)} p.p. {t.real > 0 ? 'acima' : 'abaixo'}</span></>}</>
      : <>inflação: <span className="warn">sem dados</span></>}
      {st && <button className="link small yoy-m" disabled={!online} onClick={setManual}>{infl?.source === 'manual' ? 'alterar' : infl ? 'corrigir' : 'indicar'}</button>}</div>
    {r.rows.length > 0 && <button className="link small" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'esconder categorias' : `categorias · ${r.rows.length}`}</button>}
    {open && <ul className="yoy-l">{r.rows.map((x) => <li key={x.cat}>
      <span className="yoy-n"><span className="cb-i" aria-hidden="true"><IcCat cat={x.cat} /></span>{x.cat}</span>
      <span className="num small">{eurRound(x.now)} <span className="dim">vs {eurRound(x.before)}</span></span>
      <span className={'small yoy-p ' + (x.real == null ? 'dim' : x.real > 0 ? 'bad' : 'ok')}>{x.pct != null ? sign(x.pct) + '%' : '—'}</span>
    </li>)}</ul>}
    <p className="dim small">{lastYearYm(ym).slice(0, 4)}: histórico da família · inflação: INE, IPC variação homóloga</p>
  </section>;
}

const SUBL: Record<string, string> = { 'refeições': 'refeições', material: 'material', atividades: 'atividades', roupa: 'roupa', 'sem subcategoria': 'sem subcat.' };
export function KidsCard({ exps, ms, ym }: { exps: Expense[]; ms: HistoryMonth[]; ym: string }) {
  const k = useMemo(() => kidsMonths(exps, ym, 6, ms), [exps, ym, ms]);
  const avg = kidsAvg(k.slice(0, -1)); const cur = k[k.length - 1];
  if (!k.some((m) => m.total > 0)) return <section className="card kids"><div className="kv"><b><IcKids size={16} /> Meninas &amp; escola</b></div><p className="dim small">Sem gastos ainda. Ao lançar, escolhe a categoria «Meninas &amp; escola» e a subcategoria.</p></section>;
  const max = Math.max(1, ...k.map((m) => m.total));
  const parts = [...SUBCATS, 'sem subcategoria'] as const;
  return <section className="card kids" aria-label="Meninas e escola por mês">
    <div className="kv"><b><span className="kids-i" aria-hidden="true"><IcKids size={16} /></span> Meninas &amp; escola</b><span className="num">{eur(cur.total)}</span></div>
    <div className="dim small">{ymLabel(cur.ym)}{avg != null ? ` · média ${eur(avg)}/mês` : ''}</div>
    <div className="kids-b" role="img" aria-label="Últimos 6 meses">{k.map((m) => <div key={m.ym} className="kids-c">
      <div className="kids-s" style={{ height: Math.round((m.total / max) * 56) + 'px' }}>{parts.map((p) => m.by[p] > 0 && <i key={p} className={'s-' + SUBCATS.indexOf(p as typeof SUBCATS[number])} style={{ flex: m.by[p] }} />)}</div>
      <small className="dim">{ymLabel(m.ym).slice(0, 3)}</small></div>)}</div>
    <ul className="kids-l">{parts.map((p) => cur.by[p] > 0 ? <li key={p}><i className={'dotc s-' + SUBCATS.indexOf(p as typeof SUBCATS[number])} />{SUBL[p]}<span className="num">{eur(cur.by[p])}</span></li> : null)}</ul>
    {k.some((m) => m.fromHistory) && <p className="dim small">meses antigos: total do histórico («Filhos/escola»), sem subcategoria</p>}
  </section>;
}
