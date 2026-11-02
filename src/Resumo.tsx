import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useFamily, useOnline, type FamilyData } from './lib/useFamily';
import { calculateHouseholdBalance, splitEqual } from './lib/balance';
import { eur, eurRound, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { CATS, type Bill, type Budget, type Expense, type HistoryMonth, type Item, type Member } from './lib/types';
import { Savings, type Extra } from './Plan';
import { hasV7, monthlyEq } from './lib/plan';
import { averages, byStore, currentPace, costByCategory, fixedVsVariable, monthly, savingTips, ymLabel } from './lib/history';
import { monthFlags, monthTotals, type Flag } from './lib/anomaly';
import { THEMES, type ThemeId } from './themes';
import { crossings, usage } from './lib/budget';
import { disableLock, enableLock, lockAvailable, lockEnabled, shouldLock, unlock } from './lib/lock';
import Overview from './Overview';
import CatBars from './CatBars';
import { catRows, monthBars, pctChange, prevYm } from './lib/resumo';
import { msg, displayMode, LimitsEdit, Limits, Notes, type Ctx } from './App';

function Bars({ items, avg, height = 120 }: { items: { label: string; v: number; dim?: boolean }[]; avg?: number; height?: number }) {
  const max = Math.max(1, ...items.map((i) => i.v), avg ?? 0);
  const w = 100 / Math.max(1, items.length);
  return (
    <svg className="bars" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" role="img" aria-label="Gráfico de barras">
      {items.map((i, k) => { const h = (i.v / max) * (height - 4); return <rect key={k} x={k * w + w * 0.15} y={height - h} width={w * 0.7} height={h} className={i.dim ? 'b dimb' : 'b'}><title>{i.label}: {eur(i.v)}</title></rect>; })}
      {avg != null && <line x1="0" x2="100" y1={height - (avg / max) * (height - 4)} y2={height - (avg / max) * (height - 4)} className="avg" />}
    </svg>
  );
}


type Reasons = Record<string, string>;
function useReasons(fid: string | undefined) {
  const [r, setR] = useState<Reasons>({}); const [missing, setMissing] = useState(false);
  const load = async () => {
    if (!fid) return;
    const { data, error } = await supabase.from('month_reasons').select('ym,reason').eq('family_id', fid);
    if (error) { setMissing(true); return; }
    setR(Object.fromEntries((data ?? []).map((x: { ym: string; reason: string }) => [x.ym, x.reason])));
  };
  useEffect(() => { load(); }, [fid]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (ym: string, reason: string, by?: string) => {
    const { error } = await supabase.from('month_reasons').upsert({ family_id: fid, ym, reason: reason.trim(), updated_by: by, updated_at: new Date().toISOString() }, { onConflict: 'family_id,ym' });
    if (error) { alert('Não foi possível guardar: ' + error.message); return false; }
    setR((x) => ({ ...x, [ym]: reason.trim() })); return true;
  };
  return { r, save, missing };
}

const flagText = (f: Flag) => `${f.what === 'total' ? 'Total' : f.what} ${eur(f.value)} · média ${eur(f.avg)} · +${f.pct}%`;

/** Mês fora do normal: assinala total/categorias acima da média dos 6 meses e pede a razão. */
function OffMonth({ ym, flags, extras, reason, onSave, online }: { ym: string; flags: Flag[]; extras: Expense[]; reason: string; onSave: (t: string) => Promise<boolean>; online: boolean }) {
  const [t, setT] = useState(reason); const [busy, setBusy] = useState(false);
  useEffect(() => setT(reason), [reason]);
  if (!flags.length && !extras.length) return null;
  return (
    <div className="flagbox" role="note" aria-label="Mês fora do normal">
      <div className="warn">▲ {ymLabel(ym)} fora do normal</div>
      {flags.map((f) => <div key={f.what} className="small">{flagText(f)}</div>)}
      {extras.map((e) => <div key={e.id} className="small">extraordinária: {e.description} {eur(e.amount_cents)}{e.reason ? ` — ${e.reason}` : ''}</div>)}
      <label className="small dim block" htmlFor={'rz' + ym}>razão do mês</label>
      <div className="row"><input id={'rz' + ym} value={t} onChange={(e) => setT(e.target.value)} placeholder="ex.: seguro anual + férias" />
        <button disabled={!online || busy || t.trim() === reason} onClick={async () => { setBusy(true); await onSave(t); setBusy(false); }}>guardar</button></div>
    </div>
  );
}

export default function History({ data, refetch, online, extra }: { data: FamilyData; refetch: () => void; online: boolean; extra: Extra }) {
  const [busy, setBusy] = useState(false);
  const setOpenMonth = async (ym: string, op: boolean) => {
    if (!confirm(op ? `Reabrir ${ymLabel(ym)}? Fica em aberto (provisório).` : `Fechar ${ymLabel(ym)}?`)) return;
    setBusy(true); const { error } = await supabase.rpc('set_month_open', { p_ym: ym, p_open: op }); setBusy(false);
    if (error) alert('Não foi possível: ' + error.message); else refetch();
  };
  const ms = useMemo(() => (data.months ?? []).filter((m) => m && typeof m.ym === 'string').map((m) => ({ ...m, cats: m.cats ?? {}, total_cents: Number(m.total_cents) || 0 })), [data.months]);
  const [n, setN] = useState(12);
  const [sel, setSel] = useState(todayIso().slice(0, 7)); const [mq, setMq] = useState(''); const [mais, setMais] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const a = useMemo(() => averages(ms, n), [ms, n]);
  const cats = useMemo(() => costByCategory(ms, n), [ms, n]);
  const v7 = hasV7(extra.payments);
  const fixedSrc = useMemo(() => v7 ? extra.payments.filter((p) => !p.is_deleted && p.kind !== 'pessoal').map((p) => ({ name: p.name, amount_cents: monthlyEq(p, todayIso()), period: 'mensal' })) : data.bills, [v7, extra.payments, data.bills]);
  const fv = useMemo(() => fixedVsVariable(fixedSrc, a?.total ?? 0), [fixedSrc, a]);
  const tips = useMemo(() => savingTips(ms, data.bills, n), [ms, data.bills, n]);
  const since = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); }, []);
  const stores = useMemo(() => byStore(data.expenses, since), [data.expenses, since]);
  const ym = todayIso().slice(0, 7);
  const pace = useMemo(() => currentPace(ms, data.expenses, todayIso(), n), [ms, data.expenses, n]);
  const nowM = data.expenses.filter((e) => !e.is_deleted && e.type === 'partilhada' && e.date?.startsWith(ym)).reduce((s, e) => s + e.amount_cents, 0);
  const notes = data.notes;
  const rs = useReasons(data.me?.family_id);
  const [noExtra, setNoExtra] = useState(false);
  const curT = useMemo(() => monthTotals(data.expenses, ym, noExtra), [data.expenses, ym, noExtra]);
  const curFlags = useMemo(() => monthFlags(ms, ym, curT.total, curT.cats, { noExtra }), [ms, ym, curT, noExtra]);
  const curExtras = data.expenses.filter((e) => !e.is_deleted && e.extraordinary && e.date?.startsWith(ym));
  const histFlags = useMemo(() => Object.fromEntries(ms.map((m) => [m.ym, monthFlags(ms, m.ym, Number(m.total_cents) - (noExtra ? Number(m.extra_cents) || 0 : 0), m.cats, { noExtra })])), [ms, noExtra]);
  if (!ms.length) return <p className="dim">sem histórico ainda · corre migration_v3.sql e o seed privado no Supabase</p>;
  const last = [...ms].sort((x, y) => x.ym.localeCompare(y.ym)).slice(-n);
  const income = extra.incomes.filter((x) => x.ym === ym).reduce((s, x) => s + x.amount_cents, 0);
  const bars = monthBars(ms, ym, curT.total);
  const maxB = Math.max(1, ...bars.map((b) => b.v));
  const selM = sel === ym ? null : ms.find((m) => m.ym === sel) ?? null;
  const prevCats = ms.find((m) => m.ym === prevYm(sel))?.cats ?? null;
  const projBy = Object.fromEntries(pace.cats.map((c) => [c.cat, c]));
  const catRowsSel = sel === ym
    ? catRows(curT.cats, null).map((r) => { const c = projBy[r.cat]; const pv = prevCats ? prevCats[r.cat] ?? 0 : null; return { cat: r.cat, v: r.v, pct: pctChange(c?.proj ?? r.v, pv), flag: !!c?.flag, sub: c ? `→ ${eur(c.proj)} ao ritmo atual${pv ? ` · ${ymLabel(prevYm(sel))} ${eur(pv)}` : ''}` : undefined }; })
    : catRows(selM?.cats ?? {}, prevCats).map((r) => ({ cat: r.cat, v: r.v, pct: r.pct, sub: r.prev ? `${ymLabel(prevYm(sel))} ${eur(r.prev)}` : undefined }));
  const qq = mq.trim().toLowerCase();
  const monthsList = [...ms].sort((x, y) => y.ym.localeCompare(x.ym)).filter((m) => !qq || [m.ym, ymLabel(m.ym), rs.r[m.ym] ?? '', m.note ?? '', ...Object.keys(m.cats)].join(' ').toLowerCase().includes(qq)).slice(0, qq ? 999 : n);
  return (
    <>
      <section className="rhero fade" aria-label="Este mês">
        <div className="dim small">{ymLabel(ym)} · dia {pace.day}/{pace.dim}</div>
        <div className="big num">gastámos {eur(curT.total)}</div>
        <div className="sv">poupança {income ? <span className={income - curT.total >= 0 ? 'ok num' : 'bad num'}>{eur(income - curT.total)}</span> : <span className="dim">— <span className="small">(sem rendimentos)</span></span>}</div>
        <div className="dim small">ritmo → {eur(pace.total.proj)}{pace.total.avg != null && <> · normal {eur(pace.total.avg)}</>}{pace.total.ratio != null && <> · <span className={pace.total.ratio > 1.2 ? 'bad' : pace.total.ratio > 1 ? 'warn' : 'ok'}>{Math.round(pace.total.ratio * 100)}%</span></>}</div>
      </section>

      <div className="mb" role="group" aria-label="Últimos 6 meses · toca num mês">
        {bars.map((b) => <button key={b.ym} className={b.current ? 'cur' : ''} aria-pressed={sel === b.ym} aria-label={`${ymLabel(b.ym)}: ${eur(b.v)}`} onClick={() => setSel(b.ym)}>
          <span className="bv">{eurRound(b.v).replace(/\s?€/, '')}</span>
          <span className="bb" style={{ height: (b.v / maxB) * 110 + 'px' }} />
          <span className="bl">{ymLabel(b.ym).split(' ')[0].slice(0, 3)}</span></button>)}
      </div>

      <h3>categorias · {ymLabel(sel)}{sel === ym ? ' · previsão vs mês anterior' : ' · vs mês anterior'}</h3>
      <CatBars rows={catRowsSel} empty={sel === ym ? 'ainda sem despesas partilhadas este mês' : 'sem categorias neste mês'} />
      {selM && <div className="mdet small dim">
        <div className="kv"><span>total</span><span className="num">{eur(selM.total_cents)}</span></div>
        {selM.extra_cents > 0 && <div className="kv"><span>dos quais extraordinários</span><span className="num">{eur(selM.extra_cents)}</span></div>}
        {selM.note && <p>{selM.note}</p>}{rs.r[selM.ym] && <p>razão: {rs.r[selM.ym]}</p>}
        {histFlags[selM.ym]?.map((f) => <div key={f.what} className="warn">▲ {flagText(f)}</div>)}
      </div>}

      <OffMonth ym={ym} flags={curFlags} extras={curExtras} reason={rs.r[ym] ?? ''} online={online} onSave={(t) => rs.save(ym, t, data.me?.id)} />
      <Limits data={data} />

      <details className="mais" open={mais} onToggle={(e) => setMais((e.target as HTMLDetailsElement).open)}>
        <summary><span>Mais <span className="dim small" style={{ fontWeight: 400 }}>· poupança, dicas, meses</span></span></summary>
        <div className="mais-b">
          <Savings data={data} extra={extra} online={online} spent={pace.total.spent} projected={pace.total.proj} />
          <Overview data={data} extra={extra} />

          <h3>histórico</h3>
          <div className="seg" role="radiogroup" aria-label="Período">{[12, 24, 60].map((k) => <button key={k} role="radio" aria-checked={n === k} className={n === k ? 'pri' : ''} onClick={() => setN(k)}>{k}m</button>)}</div>
          {a && <div className="kpi">
            <div><span className="big num">{eur(a.total)}</span><span className="dim per">/mês</span></div>
            <div className="dim small">{eur(a.total * 12)}/ano · {eur(a.noExtra)}/mês sem extraordinários · {ymLabel(a.from)}–{ymLabel(a.to)}</div>
          </div>}
          <Bars height={70} items={last.map((m) => ({ label: ymLabel(m.ym), v: m.total_cents, dim: m.provisional }))} avg={a?.total} />
          <div className="axis dim small"><span>{ymLabel(last[0].ym)}</span><span>┄ média</span><span>{ymLabel(last[last.length - 1].ym)}</span></div>
          <label className="check small dim"><input type="checkbox" checked={noExtra} onChange={(e) => setNoExtra(e.target.checked)} /> excluir extraordinárias das médias</label>
          <h3>quanto custa · média {n}m · vs {n}m antes</h3>
          <CatBars rows={cats.map((c) => ({ cat: c.cat, v: c.month, pct: c.trend, sub: `${eurRound(c.year)}/ano · ${c.pct}% do total` }))} />

          {tips.length > 0 && <><h3>onde poupar</h3>
            <ul className="list">{tips.map((t, k) => <li key={k} className="li"><div className="grow"><div>{t.title}</div><div className="dim small">{t.detail}</div></div>
              {t.saving != null && <span className="num ok">{t.estimate ? '≈ ' : 'até '}{eur(t.saving)}<span className="dim small">/mês</span></span>}</li>)}</ul>
            <p className="dim small">≈ = estimativa: voltar à média dos {n} meses. «até» = cortar tudo.</p></>}

          {stores.length > 0 && <><h3>supermercado por loja · 90 dias</h3>
            <ul className="list">{stores.map(([s, v]) => <li key={s} className="li"><span className="grow">{s}</span><span className="num">{eur(v)}</span></li>)}</ul></>}

          {notes.length > 0 && <><h3>notas</h3><Notes notes={notes} /></>}

          <h3>meses fechados</h3>
          <input className="msearch" type="search" value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Procurar mês, categoria ou razão…" aria-label="Procurar meses" />
          <ul className="list">{monthsList.map((m: HistoryMonth) => (
            <li key={m.ym} className="li col"><button className="row-btn" style={{ minHeight: 44 }} aria-expanded={open === m.ym} onClick={() => setOpen(open === m.ym ? null : m.ym)}>
              <span className="grow">{ymLabel(m.ym)}{m.provisional && <span className="warn"> · em aberto</span>}{histFlags[m.ym]?.length > 0 && <span className="warn"> · ▲</span>}{rs.r[m.ym] && <span className="dim small block">{rs.r[m.ym]}</span>}</span>
              <span className="num">{eur(m.total_cents)}</span></button>
              {open === m.ym && <div className="sub dim small">{Object.entries(m.cats).sort((x, y) => y[1] - x[1]).map(([c, v]) => <div key={c} className="kv"><span>{c}</span><span className="num">{eur(v)}</span></div>)}{m.extra_cents > 0 && <div className="kv"><span>dos quais extraordinários</span><span className="num">{eur(m.extra_cents)}</span></div>}{m.note && <p>{m.note}</p>}{histFlags[m.ym]?.map((f) => <div key={f.what} className="warn">▲ {flagText(f)}</div>)}{(histFlags[m.ym]?.length > 0 || rs.r[m.ym]) && !rs.missing && <button className="link" disabled={!online} onClick={() => { const t = prompt(`Razão de ${ymLabel(m.ym)} estar fora do normal:`, rs.r[m.ym] ?? ''); if (t != null) rs.save(m.ym, t, data.me?.id); }}>{rs.r[m.ym] ? 'alterar razão' : 'indicar razão'}</button>}{!m.provisional && <button className="link" disabled={!online || busy} onClick={() => setOpenMonth(m.ym, true)}>reabrir mês</button>}</div>}
            </li>))}</ul>
          {!monthsList.length && <p className="dim small">nenhum mês encontrado</p>}
        </div>
      </details>
    </>
  );
}
