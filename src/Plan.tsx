import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import type { FamilyData } from './lib/useFamily';
import { eur, parseCents, centsToInput, todayIso, ptDate } from './lib/money';
import { closeCalc, closeMessage, halvedLists, mesNome, monthlyEq, nextYm, prevYm, savings, upcoming, type Income, type MonthClose, type Payment, type Period, type Settings } from './lib/plan';
import { uuid } from './lib/outbox';

export type Extra = { payments: Payment[]; incomes: Income[]; closes: MonthClose[]; settings: Settings | null; missing: boolean; reload: () => Promise<void> };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Dados privados novos (v6). Só com rede; se a migração ainda não correu, a app continua sem estas secções. */
export function useExtra(fid: string | undefined, preset?: Omit<Extra, 'reload'>): Extra {
  const [s, set] = useState<Omit<Extra, 'reload'>>(preset ?? { payments: [], incomes: [], closes: [], settings: null, missing: false });
  const reload = useCallback(async () => {
    if (!fid || preset) return;
    const [p, i, c, st] = await Promise.all([
      supabase.from('payments').select('*').eq('family_id', fid).eq('is_deleted', false),
      supabase.from('incomes').select('*').eq('family_id', fid).eq('is_deleted', false),
      supabase.from('month_closes').select('*').eq('family_id', fid).eq('is_deleted', false).order('ym'),
      supabase.from('family_settings').select('*').eq('family_id', fid).maybeSingle(),
    ]);
    if (p.error || i.error || c.error) { set((x) => ({ ...x, missing: true })); return; }
    set({ payments: p.data ?? [], incomes: i.data ?? [], closes: c.data ?? [], settings: st.data ?? null, missing: false });
  }, [fid, preset]);
  useEffect(() => { reload(); }, [reload]);
  return { ...s, reload };
}

export function useCountUp(v: number, ms = 450) {
  const [x, setX] = useState(v); const from = useRef(v);
  useEffect(() => {
    if (reduced() || from.current === v) { from.current = v; setX(v); return; }
    const a = from.current, t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); setX(Math.round(a + (v - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = v; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [v, ms]);
  return x;
}
export const Money = ({ c, className = '' }: { c: number; className?: string }) => <span className={'num ' + className}>{eur(useCountUp(c))}</span>;

function Ring({ ratio, status }: { ratio: number; status: string }) {
  const r = 26, L = 2 * Math.PI * r, k = Math.max(0, Math.min(1, ratio));
  return <svg className="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r={r} className="ring-bg" />
    <circle cx="32" cy="32" r={r} className={'ring-fg ' + status} strokeDasharray={L} strokeDashoffset={L * (1 - k)} transform="rotate(-90 32 32)" /></svg>;
}

const db = async (f: () => PromiseLike<{ error: unknown }>) => { const { error } = await f(); if (error) throw error; };

/** Rendimentos − despesas reais = sobra; objetivo de poupança com o ritmo do mês. */
export function Savings({ data, extra, spent, projected, online }: { data: FamilyData; extra: Extra; spent: number; projected: number; online: boolean }) {
  const ym = todayIso().slice(0, 7);
  const [edit, setEdit] = useState(false); const [vals, setVals] = useState<Record<string, string>>({}); const [goal, setGoal] = useState(''); const [err, setErr] = useState('');
  const inc = extra.incomes.filter((i) => i.ym === ym);
  const income = inc.reduce((s, i) => s + i.amount_cents, 0);
  const g = extra.settings?.savings_goal_cents ?? 60000;
  const sv = savings(income, spent, projected, g);
  const open = () => { setVals(Object.fromEntries(data.members.map((m) => [m.id, (() => { const x = inc.find((i) => i.member_id === m.id); return x ? centsToInput(x.amount_cents) : ''; })()]))); setGoal(centsToInput(g)); setErr(''); setEdit(true); };
  const save = async () => {
    setErr(''); const fid = data.me!.family_id;
    try {
      for (const m of data.members) {
        const t = (vals[m.id] ?? '').trim(); if (!t) continue; const c = parseCents(t); if (c == null) throw new Error(`valor inválido para ${m.display_name}`);
        const ex = inc.find((i) => i.member_id === m.id);
        await db(() => ex ? supabase.from('incomes').update({ amount_cents: c }).eq('id', ex.id) : supabase.from('incomes').insert({ id: uuid(), family_id: fid, member_id: m.id, ym, amount_cents: c }));
      }
      const gc = parseCents(goal); if (gc == null) throw new Error('objetivo inválido');
      await db(() => supabase.from('family_settings').upsert({ family_id: fid, savings_goal_cents: gc, notify_days: extra.settings?.notify_days ?? 3 }));
      await extra.reload(); setEdit(false);
    } catch (e) { setErr((e as Error).message); }
  };
  if (extra.missing) return null;
  return (
    <section className="group">
      <h3>poupança · {mesNome(ym)}</h3>
      <div className="savings">
        <Ring ratio={sv.ratio} status={sv.status} />
        <div className="grow">
          {sv.status === 'sem-dados' ? <><div className="t2">Sem rendimentos deste mês</div><div className="dim small">Regista-os para ver a sobra e o objetivo de {eur(g)}.</div></>
            : <><div className="t2"><Money c={sv.leftover} /> <span className="dim small">sobra até hoje</span></div>
              <div className={'small ' + (sv.status === 'ok' ? 'ok' : 'warn')}>{sv.status === 'ok' ? 'No bom caminho' : 'Em risco'} · ao ritmo atual sobram {eur(sv.projectedLeftover)} de {eur(g)}</div>
              <div className="dim small">rendimentos {eur(income)} − despesas {eur(spent)}</div></>}
        </div>
      </div>
      {!edit ? <button className="link" disabled={!online} onClick={open}>rendimentos e objetivo</button> : <div className="form">
        {data.members.map((m) => <label key={m.id} className="fld"><span>{m.display_name} · líquido {mesNome(ym)}</span>
          <input inputMode="decimal" className="num" value={vals[m.id] ?? ''} placeholder="0,00" onChange={(e) => setVals({ ...vals, [m.id]: e.target.value })} /></label>)}
        <label className="fld"><span>objetivo de poupança / mês</span><input inputMode="decimal" className="num" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
        {err && <p className="err small">{err}</p>}
        <div className="row"><button className="pri" onClick={save}>guardar</button><button onClick={() => setEdit(false)}>cancelar</button></div>
        <p className="dim small">Fica só na base de dados privada da família.</p></div>}
    </section>
  );
}

const PERN: Record<Period, string> = { mensal: '/mês', trimestral: '/3 meses', anual: '/ano' };
const notifKey = (p: Payment, d: string) => `fs-notif-${p.id}-${d}`;
async function notifyDue(items: ReturnType<typeof upcoming>, days: number) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return;
  for (const u of items) {
    if (u.days == null || u.days < 0 || u.days > days || !u.date || localStorage.getItem(notifKey(u.p, u.date))) continue;
    await reg.showNotification(u.days === 0 ? `Hoje: ${u.p.name}` : `${u.p.name} daqui a ${u.days} dia${u.days > 1 ? 's' : ''}`,
      { body: [u.amount != null ? eur(u.amount) : null, ptDate(u.date), u.p.account].filter(Boolean).join(' · '), tag: notifKey(u.p, u.date), icon: './icon-192.png', data: { url: './?acao=contas' } });
    localStorage.setItem(notifKey(u.p, u.date), '1');
  }
}

/** Próximos pagamentos e subscrições. */
export function Upcoming({ data, extra, online }: { data: FamilyData; extra: Extra; online: boolean }) {
  const today = todayIso();
  const list = useMemo(() => upcoming(extra.payments, today), [extra.payments, today]);
  const days = extra.settings?.notify_days ?? 3;
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [edit, setEdit] = useState<string | null>(null); const [f, setF] = useState<Record<string, string>>({}); const [err, setErr] = useState('');
  useEffect(() => { notifyDue(list, days).catch(() => {}); }, [list, days, perm]);
  if (extra.missing) return <p className="dim small">Pagamentos: falta correr migration_v6.sql no Supabase.</p>;
  const monthly = extra.payments.reduce((s, p) => s + (monthlyEq(p, today) ?? 0), 0);
  const startEdit = (p?: Payment) => {
    setErr(''); setEdit(p?.id ?? 'novo');
    setF({ name: p?.name ?? '', amount: p?.amount_cents != null ? centsToInput(p.amount_cents) : '', period: p?.period ?? 'mensal', next_date: p?.next_date ?? '', payer: p?.payer ?? '', account: p?.account ?? '', note: p?.note ?? '',
      new_amount: p?.new_amount_cents != null ? centsToInput(p.new_amount_cents) : '', new_period: p?.new_period ?? '', new_from: p?.new_from ?? '' });
  };
  const save = async () => {
    setErr('');
    const money = (s: string) => { if (!s.trim()) return null; const c = parseCents(s); if (c == null) throw new Error('valor inválido (ex.: 12,50)'); return c; };
    try {
      if (!f.name.trim()) throw new Error('falta o nome');
      const row = { name: f.name.trim(), amount_cents: money(f.amount), period: f.period, next_date: f.next_date || null, payer: f.payer.trim() || null, account: f.account.trim() || null, note: f.note.trim() || null,
        new_amount_cents: money(f.new_amount), new_period: f.new_period || null, new_from: f.new_from || null };
      await db(() => edit === 'novo' ? supabase.from('payments').insert({ id: uuid(), family_id: data.me!.family_id, ...row }) : supabase.from('payments').update(row).eq('id', edit!));
      await extra.reload(); setEdit(null);
    } catch (e) { setErr((e as Error).message); }
  };
  const remove = async (id: string) => { if (!confirm('Arquivar este pagamento? Fica no histórico da base de dados.')) return; await db(() => supabase.from('payments').update({ is_deleted: true }).eq('id', id)).catch((e) => setErr(e.message)); await extra.reload(); setEdit(null); };
  const ask = async () => { const r = await Notification.requestPermission(); setPerm(r); };
  const setDays = async (n: number) => { await db(() => supabase.from('family_settings').upsert({ family_id: data.me!.family_id, savings_goal_cents: extra.settings?.savings_goal_cents ?? 60000, notify_days: n })).catch(() => {}); extra.reload(); };
  const form = <div className="form">
    <label className="fld"><span>nome</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
    <div className="row2"><label className="fld"><span>valor</span><input inputMode="decimal" className="num" placeholder="por preencher" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label className="fld"><span>periodicidade</span><select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}><option value="mensal">mensal</option><option value="trimestral">trimestral</option><option value="anual">anual</option></select></label></div>
    <div className="row2"><label className="fld"><span>próxima data</span><input type="date" value={f.next_date} onChange={(e) => setF({ ...f, next_date: e.target.value })} /></label>
      <label className="fld"><span>quem paga</span><input value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })} /></label></div>
    <label className="fld"><span>conta / cartão</span><input value={f.account} placeholder="ex.: Visa …1234" onChange={(e) => setF({ ...f, account: e.target.value })} /></label>
    <label className="fld"><span>nota</span><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
    <div className="dim small">mudança de preço (opcional)</div>
    <div className="row3"><label className="fld"><span>novo valor</span><input inputMode="decimal" className="num" value={f.new_amount} onChange={(e) => setF({ ...f, new_amount: e.target.value })} /></label>
      <label className="fld"><span>período</span><select value={f.new_period} onChange={(e) => setF({ ...f, new_period: e.target.value })}><option value="">igual</option><option value="mensal">mensal</option><option value="trimestral">trimestral</option><option value="anual">anual</option></select></label>
      <label className="fld"><span>a partir de</span><input type="date" value={f.new_from} onChange={(e) => setF({ ...f, new_from: e.target.value })} /></label></div>
    {err && <p className="err small">{err}</p>}
    <div className="row"><button className="pri" disabled={!online} onClick={save}>guardar</button><button onClick={() => setEdit(null)}>cancelar</button>
      {edit !== 'novo' && <button className="danger" onClick={() => remove(edit!)}>arquivar</button>}</div></div>;
  return (
    <section className="group">
      <h3>próximos</h3>
      <div className="kpi"><Money c={monthly} className="big" /><span className="dim"> /mês em pagamentos</span></div>
      <ul className="list ios">{list.map((u, i) => (
        <li key={u.p.id} className={'li col in' + (u.soon ? ' soon' : '')} style={{ animationDelay: Math.min(i, 10) * 25 + 'ms' }}>
          <button className="row-btn" onClick={() => (edit === u.p.id ? setEdit(null) : startEdit(u.p))}>
            <span className="grow"><span className="t2">{u.p.name}</span><span className="dim small block">{[u.date ? ptDate(u.date) : 'data por preencher', u.p.payer, u.p.account].filter(Boolean).join(' · ')}{u.changes ? ` · novo preço a ${ptDate(u.p.new_from!)}` : ''}</span></span>
            <span className="r"><span className="num">{u.amount != null ? eur(u.amount) : <span className="warn small">valor?</span>}</span>
              <span className={'small block ' + (u.soon ? 'warn' : 'dim')}>{u.days == null ? '' : u.days === 0 ? 'hoje' : `${u.days} dia${u.days > 1 ? 's' : ''}`}{u.amount != null && <span className="dim"> {PERN[termsAt2(u)]}</span>}</span></span>
          </button>
          {edit === u.p.id && form}
        </li>))}</ul>
      {edit === 'novo' ? form : <button className="link" disabled={!online} onClick={() => startEdit()}>adicionar pagamento</button>}
      <div className="row small dim notif">
        {perm === 'granted' ? <span>🔔 avisos {days} dia{days > 1 ? 's' : ''} antes</span> : perm === 'unsupported' ? <span>avisos indisponíveis neste browser</span> : <button className="link" onClick={ask}>ativar avisos</button>}
        {perm === 'granted' && <select aria-label="Dias de antecedência" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n} d</option>)}</select>}
      </div>
      {perm === 'granted' && <p className="dim small">O aviso aparece quando a app é aberta (ou sincroniza) dentro do prazo.</p>}
    </section>
  );
}
const termsAt2 = (u: ReturnType<typeof upcoming>[number]) => (u.p.new_from && u.date && u.date >= u.p.new_from ? u.p.new_period ?? u.p.period : u.p.period);

type MutateFn = (label: string, table: 'settlements', kind: 'create', id: string, row: Record<string, unknown>) => Promise<boolean>;
/** Fecho de mês num toque: listas a metade → diferença → MB WAY máx. 750 € → resto para o mês seguinte. Não envia nada. */
export function CloseMonth({ data, extra, mutate, online, close }: { data: FamilyData; extra: Extra; mutate: MutateFn; online: boolean; close: () => void }) {
  const ids = data.members.map((m) => m.id);
  const names = Object.fromEntries(data.members.map((m) => [m.id, m.display_name]));
  const closed = new Set(extra.closes.map((c) => c.ym));
  const cur = todayIso().slice(0, 7);
  const [ym, setYm] = useState(() => (closed.has(prevYm(cur)) ? cur : prevYm(cur)));
  const base = useMemo(() => halvedLists(ids, data.expenses, ym), [ids.join(), data.expenses, ym]);
  const carryIn = extra.closes.find((c) => c.ym === prevYm(ym) && c.carry_cents > 0);
  const [over, setOver] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'rever' | 'pagar'>('rever'); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => { setOver({}); setStep('rever'); }, [ym]);
  const lists = Object.fromEntries(ids.map((id) => { const o = over[id]; const v = o != null && o.trim() !== '' ? parseCents(o) ?? 0 : base[id] + (carryIn?.creditor === id ? carryIn.carry_cents : 0); return [id, v]; }));
  const c = closeCalc(lists);
  const text = closeMessage(ym, names, lists, c, eur);
  const already = closed.has(ym);
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* cancelado */ }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr('Não consegui copiar; seleciona o texto.'); }
  };
  const paid = async () => {
    if (!confirm(`Confirmas que ${names[c.debtor ?? ''] ?? ''} já pagou ${eur(c.paid)} e queres fechar ${mesNome(ym)}?`)) return;
    setErr(''); const fid = data.me!.family_id; let sid: string | null = null;
    if (c.debtor && c.paid > 0) {
      sid = uuid();
      const ok = await mutate(`Acerto de ${mesNome(ym)} registado.`, 'settlements', 'create', sid, { id: sid, family_id: fid, from_member: c.debtor, to_member: c.creditor, amount_cents: c.paid, date: todayIso(), method: 'MB WAY', confirmed: true, confirmed_at: new Date().toISOString(), is_deleted: false, created_at: new Date().toISOString() });
      if (!ok) return;
    }
    const { error } = await supabase.from('month_closes').insert({ id: uuid(), family_id: fid, ym, creditor: c.creditor, debtor: c.debtor, diff_cents: c.diff, paid_cents: c.paid, carry_cents: c.carry, settlement_id: sid,
      lists: { ...Object.fromEntries(Object.entries(lists).map(([k, v]) => [names[k], v])), ...(carryIn ? { [`mês ${mesNome(prevYm(ym))}`]: carryIn.carry_cents } : {}) } });
    if (error) return setErr('O pagamento ficou registado, mas o fecho não: ' + error.message);
    await supabase.rpc('set_month_open', { p_ym: ym, p_open: false }).then(() => {}, () => {});
    await extra.reload(); close();
  };
  if (extra.missing) return <div className="form"><p className="dim">Falta correr migration_v6.sql no Supabase para fechar meses.</p><button onClick={close}>fechar</button></div>;
  return (
    <section className="form sheet">
      <div className="row between"><h2>Fechar mês</h2><button className="link" onClick={close}>cancelar</button></div>
      <div className="seg">{[prevYm(prevYm(cur)), prevYm(cur), cur].map((m) => <button key={m} className={ym === m ? 'pri' : ''} onClick={() => setYm(m)}>{mesNome(m)}{closed.has(m) ? ' ✓' : ''}</button>)}</div>
      {already && <p className="ok small">{mesNome(ym)} já está fechado.</p>}
      <ul className="list ios">{ids.map((id) => <li key={id} className="li">
        <span className="grow">Lista {names[id]}<span className="dim small block">já a metade{carryIn?.creditor === id ? ` · inclui «mês ${mesNome(prevYm(ym))}» ${eur(carryIn.carry_cents)}` : ''}</span></span>
        <input className="num amt" inputMode="decimal" aria-label={`Lista de ${names[id]}`} value={over[id] ?? centsToInput(lists[id])} onChange={(e) => setOver({ ...over, [id]: e.target.value })} /></li>)}</ul>
      <div className="summary">
        {c.debtor ? <><div className="dim small">{names[c.debtor]} → {names[c.creditor!]}</div><Money c={c.paid} className="big" /><div className="dim small">por MB WAY{c.carry > 0 ? ` · ${eur(c.carry)} passam para ${mesNome(nextYm(ym))} como «mês ${mesNome(ym)}» na lista de ${names[c.creditor!]}` : ''}</div></>
          : <div className="t2">Contas certas</div>}
      </div>
      <p className="msg small">{text}</p>
      <div className="row"><button onClick={share}>{copied ? 'copiado ✓' : 'copiar / partilhar com a Ana'}</button></div>
      {step === 'rever' ? <button className="pri wide" disabled={already} onClick={() => setStep('pagar')}>continuar</button>
        : <button className="pri wide" disabled={!online || already} onClick={paid}>já paguei · fechar {mesNome(ym)}</button>}
      {err && <p className="err small">{err}</p>}
      <p className="dim small">A app não envia nada: tu fazes o MB WAY e partilhas a mensagem.</p>
    </section>
  );
}
