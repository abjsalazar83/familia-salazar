import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useFamily, useOnline, type FamilyData } from './lib/useFamily';
import { calculateHouseholdBalance, splitEqual } from './lib/balance';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { CATS, type Bill, type Budget, type Expense, type HistoryMonth, type Item, type Member } from './lib/types';
import { useExtra, Savings, Upcoming, CloseMonth, Money, NotifySettings, PorLancar, type Extra } from './Plan';
import { hasV7, monthlyEq } from './lib/plan';
import { averages, byStore, currentPace, costByCategory, fixedVsVariable, monthly, savingTips, ymLabel } from './lib/history';
import { monthFlags, monthTotals, type Flag } from './lib/anomaly';
import { THEMES, type ThemeId } from './themes';
import { crossings, usage } from './lib/budget';
import { disableLock, enableLock, lockAvailable, lockEnabled, shouldLock, unlock } from './lib/lock';
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
  const tr = (t: number | null) => t == null ? <span className="dim">—</span> : <span className={t > 0 ? 'bad' : t < 0 ? 'ok' : 'dim'}>{t > 0 ? '↑' : t < 0 ? '↓' : '='}{Math.abs(t)}%</span>;
  return (
    <>
      <div className="seg" role="radiogroup" aria-label="Período">{[12, 24, 60].map((k) => <button key={k} role="radio" aria-checked={n === k} className={n === k ? 'pri' : ''} onClick={() => setN(k)}>{k}m</button>)}</div>
      {a && <div className="kpi">
        <div><span className="big num">{eur(a.total)}</span><span className="dim">/mês · {eur(a.total * 12)}/ano</span></div>
        <div className="dim small">{eur(a.noExtra)}/mês sem extraordinários · {ymLabel(a.from)}–{ymLabel(a.to)}</div>
      </div>}
      <Bars height={70} items={last.map((m) => ({ label: ymLabel(m.ym), v: m.total_cents, dim: m.provisional }))} avg={a?.total} />
      <div className="axis dim small"><span>{ymLabel(last[0].ym)}</span><span>┄ média</span><span>{ymLabel(last[last.length - 1].ym)}</span></div>
      <Savings data={data} extra={extra} online={online} spent={pace.total.spent} projected={pace.total.proj} />
      <Limits data={data} />
      <OffMonth ym={ym} flags={curFlags} extras={curExtras} reason={rs.r[ym] ?? ''} online={online} onSave={(t) => rs.save(ym, t, data.me?.id)} />
      <label className="check small dim"><input type="checkbox" checked={noExtra} onChange={(e) => setNoExtra(e.target.checked)} /> excluir extraordinárias das médias</label>
      <h3>este mês · {ymLabel(pace.ym)} · dia {pace.day}/{pace.dim} · vs média {n}m</h3>
      <p className={pace.total.flag ? 'bad' : ''}><span className="big num">{eur(pace.total.spent)}</span> <span className="dim">até hoje → ritmo </span><span className="num">{eur(pace.total.proj)}</span>{pace.total.avg != null && <span className="dim"> · normal {eur(pace.total.avg)} · </span>}{pace.total.ratio != null && <span className={pace.total.ratio > 1.2 ? 'bad' : pace.total.ratio > 1 ? 'warn' : 'ok'}>{Math.round(pace.total.ratio * 100)}%</span>}</p>
      {pace.cats.length > 0 ? <table className="t"><tbody>{pace.cats.map((c) => <tr key={c.cat} className={c.flag ? 'bad' : ''}>
        <td>{c.flag ? '▲ ' : ''}{c.cat}</td><td className="num">{eur(c.spent)}</td><td className="num dim">→{eur(c.proj)}</td><td className="num dim">{c.avg != null ? eur(c.avg) : '—'}</td><td className="num">{c.ratio != null ? <span className={c.ratio > 1.2 ? 'bad' : c.ratio > 1 ? 'warn' : 'ok'}>{Math.round(c.ratio * 100)}%</span> : <span className="dim">novo</span>}</td></tr>)}</tbody></table>
        : <p className="dim small">ainda sem despesas partilhadas este mês</p>}
      <p className="dim small">gasto · →projeção ao ritmo atual · normal · % do normal. ▲ = mais de 20% acima do normal.</p>

      <h3>quanto custa · €/mês · €/ano · % · vs {n}m antes</h3>
      <table className="t"><tbody>{cats.map((c) => <tr key={c.cat}>
        <td>{c.cat}<i style={{ width: (c.month / cats[0].month) * 100 + '%' }} /></td><td className="num">{eur(c.month)}</td><td className="num dim">{eur(c.year).replace(',00', '')}</td><td className="num dim">{c.pct}%</td><td className="num">{tr(c.trend)}</td></tr>)}</tbody></table>

      {a && fixedSrc.length > 0 && <><h3>fixas vs variáveis</h3>
        <div className="split"><i style={{ width: Math.min(100, (fv.fixed / Math.max(1, a.total)) * 100) + '%' }} /></div>
        <div className="kv"><span>fixas <span className="num">{eur(fv.fixed)}</span></span><span>variáveis <span className="num">{eur(fv.variable)}</span></span></div>
        <p className="dim small">fixas = {v7 ? 'pagamentos conjuntos' : 'contas recorrentes'} com valor{fv.estimated ? ' (inclui estimativas ≈)' : ''}{fv.unknown ? ` · ${fv.unknown} por registar` : ''} · variáveis = média − fixas</p></>}

      {tips.length > 0 && <><h3>onde poupar</h3>
        <ul className="list">{tips.map((t, k) => <li key={k} className="li"><div className="grow"><div>{t.title}</div><div className="dim small">{t.detail}</div></div>
          {t.saving != null && <span className="num ok">{t.estimate ? '≈ ' : 'até '}{eur(t.saving)}<span className="dim small">/mês</span></span>}</li>)}</ul>
        <p className="dim small">≈ = estimativa: voltar à média dos {n} meses. «até» = cortar tudo.</p></>}

      {stores.length > 0 && <><h3>supermercado por loja · 90 dias</h3>
        <ul className="list">{stores.map(([s, v]) => <li key={s} className="li"><span className="grow">{s}</span><span className="num">{eur(v)}</span></li>)}</ul></>}

      {notes.length > 0 && <><h3>notas</h3><Notes notes={notes} /></>}

      <h3>meses</h3>
      <ul className="list">{[...ms].sort((x, y) => y.ym.localeCompare(x.ym)).slice(0, n).map((m: HistoryMonth) => (
        <li key={m.ym} className="li col"><button className="row-btn" aria-expanded={open === m.ym} onClick={() => setOpen(open === m.ym ? null : m.ym)}>
          <span className="grow">{ymLabel(m.ym)}{m.provisional && <span className="warn"> · em aberto</span>}{histFlags[m.ym]?.length > 0 && <span className="warn"> · ▲</span>}{rs.r[m.ym] && <span className="dim small block">{rs.r[m.ym]}</span>}</span>
          <span className="num">{eur(m.total_cents)}</span></button>
          {open === m.ym && <div className="sub dim small">{Object.entries(m.cats).sort((x, y) => y[1] - x[1]).map(([c, v]) => <div key={c} className="kv"><span>{c}</span><span className="num">{eur(v)}</span></div>)}{m.extra_cents > 0 && <div className="kv"><span>dos quais extraordinários</span><span className="num">{eur(m.extra_cents)}</span></div>}{m.note && <p>{m.note}</p>}{histFlags[m.ym]?.map((f) => <div key={f.what} className="warn">▲ {flagText(f)}</div>)}{(histFlags[m.ym]?.length > 0 || rs.r[m.ym]) && !rs.missing && <button className="link" disabled={!online} onClick={() => { const t = prompt(`Razão de ${ymLabel(m.ym)} estar fora do normal:`, rs.r[m.ym] ?? ''); if (t != null) rs.save(m.ym, t, data.me?.id); }}>{rs.r[m.ym] ? 'alterar razão' : 'indicar razão'}</button>}{!m.provisional && <button className="link" disabled={!online || busy} onClick={() => setOpenMonth(m.ym, true)}>reabrir mês</button>}</div>}
        </li>))}</ul>
    </>
  );
}
