import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useFamily, useOnline, type FamilyData } from './lib/useFamily';
import { calculateHouseholdBalance, splitEqual } from './lib/balance';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { CATS, type Bill, type Budget, type Expense, type HistoryMonth, type Item, type Member } from './lib/types';
import { useExtra, Savings, Upcoming, CloseMonth, Money, type Extra } from './Plan';
import { averages, byStore, currentPace, costByCategory, fixedVsVariable, monthly, savingTips, ymLabel } from './lib/history';
import { THEMES, type ThemeId } from './themes';
import { crossings, usage } from './lib/budget';
import { actionTab } from './lib/actions';
import { disableLock, enableLock, lockAvailable, lockEnabled, shouldLock, unlock } from './lib/lock';
import { uuid, type Op, type Table } from './lib/outbox';
import { readStoredSession } from './lib/session';

type Tab = 'inicio' | 'despesas' | 'compras' | 'historico' | 'contas' | 'defs';
type Toast = { kind: 'ok' | 'bad' | 'busy'; text: string } | null;
const msg = (e: unknown) => {
  const m = (e as { message?: string })?.message || String(e);
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem ligação ao servidor. Nada foi guardado.';
  if (/Invalid login credentials/i.test(m)) return 'Email ou palavra-passe errados.';
  if (/Email not confirmed/i.test(m)) return 'Confirma primeiro o email (vê a caixa de correio).';
  if (/relation .* does not exist|schema cache/i.test(m)) return 'A base de dados ainda não foi configurada (falta correr o schema.sql).';
  return m;
};

function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(() => { const t = localStorage.getItem('fs-theme2') as ThemeId; return THEMES.some((x) => x.id === t) ? t : 'auto'; });
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { const t = THEMES.find((x) => x.id === theme)!; const bg = theme === 'auto' ? (mq.matches ? '#000000' : '#f2f2f7') : t.bg;
      document.documentElement.dataset.theme = theme; document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg); };
    localStorage.setItem('fs-theme2', theme); apply(); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return [theme, setTheme] as const;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useTheme();
  const online = useOnline();
  useEffect(() => {
    // Sem rede, a renovação do token falha mas a sessão guardada continua válida para ver e pôr alterações em fila.
    supabase.auth.getSession().then(({ data }) => { setSession(data.session ?? (navigator.onLine ? null : readStoredSession())); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => setSession(s ?? (e !== 'SIGNED_OUT' && !navigator.onLine ? readStoredSession() : null)));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <div className="wrap">
      <header className="top">
        <h1>Família</h1>
        <span className={'dot ' + (online ? 'ok' : 'bad')} role="status">{online ? '● online' : '○ offline'}</span>
      </header>
      {!online && <div className="banner bad" role="alert">offline · a ver dados guardados; o que registares fica por sincronizar</div>}
      {!ready ? <p className="dim">A carregar…</p> : !session ? <Auth online={online} /> : <Main session={session} online={online} theme={theme} setTheme={setTheme} />}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="dim">{hint}</small>}</label>;
}

function Auth({ online }: { online: boolean }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Email inválido.');
    if (pw.length < 8) return setErr('A palavra-passe tem de ter pelo menos 8 caracteres.');
    setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw }); if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL } });
        if (error) throw error;
        if (!data.session) setInfo('Conta criada. Abre o email de confirmação e depois volta aqui para entrar.');
      }
    } catch (x) { setErr(msg(x)); } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={submit} aria-label={mode === 'in' ? 'Entrar' : 'Criar conta'}>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'pri' : ''} onClick={() => setMode('in')}>Entrar</button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'pri' : ''} onClick={() => setMode('up')}>Criar conta</button>
      </div>
      <Field label="Email"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} required /></Field>
      <Field label="Palavra-passe"><input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} /></Field>
      {err && <p className="err" role="alert">{err}</p>}
      {info && <p className="okt" role="status">{info}</p>}
      <button className="pri wide" disabled={busy || !online}>{busy ? 'A enviar…' : mode === 'in' ? 'Entrar' : 'Criar conta'}</button>
    </form>
  );
}

function Onboarding({ online, done }: { online: boolean; done: () => void }) {
  const [name, setName] = useState(''); const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async (kind: 'create' | 'join') => {
    setErr('');
    if (!name.trim()) return setErr('Escreve o teu nome (ex.: António ou Ana).');
    if (kind === 'join' && code.trim().length < 6) return setErr('Escreve o código de convite.');
    setBusy(true);
    const { error } = kind === 'create'
      ? await supabase.rpc('create_family', { p_name: 'Família Salazar', p_display_name: name.trim() })
      : await supabase.rpc('join_family', { code: code.trim(), p_display_name: name.trim() });
    setBusy(false);
    if (error) setErr(msg(error)); else done();
  };
  return (
    <div className="card">
      <h2>Bem-vindo</h2>
      <Field label="Como te chamas?"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="António ou Ana" maxLength={40} /></Field>
      <h3>Primeira pessoa</h3>
      <p className="dim">Cria a «Família Salazar». Depois vês um código para a outra pessoa entrar.</p>
      <button className="pri wide" disabled={busy || !online} onClick={() => go('create')}>Criar a Família Salazar</button>
      <h3>Já tens um código?</h3>
      <Field label="Código de convite"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" maxLength={12} className="num" /></Field>
      <button className="wide" disabled={busy || !online} onClick={() => go('join')}>Entrar na família</button>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

function Main({ session, online, theme, setTheme }: { session: Session; online: boolean; theme: ThemeId; setTheme: (t: ThemeId) => void }) {
  const { data, state, queue, status, error, syncedAt, live, syncing, refetch, mutate: qMutate, retry, discard } = useFamily(session);
  const [tab, setTab] = useState<Tab>('inicio');
  const extra = useExtra(data.family?.id);
  useEffect(() => { if (syncedAt) extra.reload(); }, [syncedAt]); // eslint-disable-line
  const mainRef = useRef<HTMLElement>(null);
  const [swipeDir, setSwipeDir] = useState('');
  const tabRef = useRef(tab); tabRef.current = tab;
  useEffect(() => {
    const ORDER: Tab[] = ['inicio', 'despesas', 'compras', 'historico', 'contas'];
    let x0 = 0, y0 = 0, t0 = 0, ok = false;
    const skip = (el: EventTarget | null) => { for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
      if (n.matches?.('input,textarea,select,[contenteditable],.no-swipe')) return true;
      if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true; } return false; };
    const start = (e: TouchEvent) => { const p = e.touches[0]; ok = e.touches.length === 1 && p.clientX > 30 && p.clientX < innerWidth - 30 && p.clientY < innerHeight - 40 && !skip(e.target); if (!ok) return; x0 = p.clientX; y0 = p.clientY; t0 = Date.now(); };
    const end = (e: TouchEvent) => {
      if (!ok) return; ok = false; const t = e.changedTouches[0]; const dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - t0 > 700) return;
      const i = ORDER.indexOf(tabRef.current); if (i < 0) return;
      const j = dx < 0 ? i + 1 : i - 1; if (j < 0 || j >= ORDER.length) return;
      setSwipeDir(dx < 0 ? 'from-right' : 'from-left'); setTab(ORDER[j]); setPanel('');
    };
    const el = mainRef.current?.parentElement ?? document.body;
    el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchend', end, { passive: true });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end); };
  }, []);
  const [panel, setPanel] = useState<'' | 'despesa' | 'saldar' | 'fechar'>('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [locked, unlocked] = useLock();
  // Atalhos do ícone (toque longo): ./?acao=despesa|compras|saldar|historico
  const ready = !!data.me && !locked;
  useEffect(() => {
    if (!ready) return;
    const u = new URL(location.href); const a = actionTab(u.searchParams.get('acao'));
    if (!a) return;
    setTab(a.tab); setPanel(a.panel); setEditing(null);
    u.searchParams.delete('acao'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  }, [ready]);

  const run = async (label: string, fn: () => PromiseLike<{ error: unknown }>) => {
    if (!navigator.onLine) { setToast({ kind: 'bad', text: 'Sem ligação: nada foi guardado.' }); return false; }
    setToast({ kind: 'busy', text: 'A guardar…' });
    try {
      const { error } = await fn(); if (error) throw error;
      await refetch();
      setToast({ kind: 'ok', text: label }); setTimeout(() => setToast((t) => (t?.kind === 'ok' ? null : t)), 2500);
      return true;
    } catch (e) { setToast({ kind: 'bad', text: 'Não foi guardado: ' + msg(e) }); return false; }
  };

  const mutate = async (label: string, table: Table, kind: Op['kind'], id: string, row?: Record<string, unknown>) => {
    try { await qMutate(table, kind, id, row); }
    catch (e) { setToast({ kind: 'bad', text: 'Não foi possível guardar neste aparelho: ' + msg(e) }); return false; }
    setToast({ kind: 'ok', text: navigator.onLine ? label + ' A enviar para o servidor…' : label + ' Guardado neste aparelho · por sincronizar.' });
    setTimeout(() => setToast((t) => (t?.kind === 'ok' ? null : t)), 3000);
    return true;
  };
  const pendingN = queue.filter((o) => o.status === 'pending').length;
  const failed = queue.filter((o) => o.status === 'failed');

  if (locked) return <LockScreen done={unlocked} />;
  if (status === 'loading') return <p className="dim">A carregar dados…</p>;
  if (status === 'error' && !data.me) return (
    <div className="card"><p className="err" role="alert">{msg(error)}</p>
      <button onClick={refetch}>Tentar de novo</button> <button onClick={() => supabase.auth.signOut()}>Sair</button></div>);
  if (!data.me || !data.family) return <><Onboarding online={online} done={refetch} /><button onClick={() => supabase.auth.signOut()}>Sair</button></>;

  const ctx = { data, run, mutate, state, online, setToast, extra };
  const openExpense = (e: Expense | null) => { setEditing(e); setPanel('despesa'); };
  return (
    <>
      <div className="sync dim" aria-live="polite">
        {status === 'error' ? <span className="err">Falha a sincronizar: {msg(error)}</span>
          : <>{online ? 'Sincronizado' : 'Última sincronização'} {syncedAt?.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{live && online ? ' · tempo real' : ''}</>}
        {pendingN > 0 && <span className="warn"> · {pendingN} por sincronizar{syncing && online ? ' (a enviar…)' : ''}</span>}
        <button className={'gear' + (tab === 'defs' ? ' on' : '')} aria-label="Definições" onClick={() => { setTab('defs'); setPanel(''); }}>⚙</button>
      </div>
      <InstallBanner />
      {toast && <div className={'banner ' + toast.kind} role={toast.kind === 'bad' ? 'alert' : 'status'}>{toast.text}{toast.kind === 'bad' && <button className="x" aria-label="Fechar" onClick={() => setToast(null)}>×</button>}</div>}
      {failed.length > 0 && <div className="card" role="alert"><h2 className="err">Falhou ({failed.length})</h2>
        <p className="dim small">O servidor não aceitou estas alterações. Continuam guardadas neste aparelho até decidires.</p>
        <ul className="list">{failed.map((o) => <li key={o.opId} className="li"><div className="grow"><div>{describeOp(o)}</div><div className="err small">{msg(o.error)}</div></div>
          <button onClick={() => retry(o.opId)} disabled={!online}>Tentar de novo</button>
          <button className="danger" onClick={() => { if (confirm('Descartar esta alteração local? Não foi guardada no servidor.')) discard(o.opId); }}>Descartar</button></li>)}</ul></div>}
      <main ref={mainRef} key={tab} className={'screen ' + swipeDir}>
        {tab === 'inicio' && <Home {...ctx} panel={panel} setPanel={setPanel} editing={editing} openExpense={openExpense} goShop={() => setTab('compras')} />}
        {tab === 'despesas' && <Expenses {...ctx} panel={panel} setPanel={setPanel} editing={editing} openExpense={openExpense} />}
        {tab === 'compras' && <Shopping {...ctx} />}
        {tab === 'historico' && <History data={data} refetch={refetch} online={online} extra={extra} />}
        {tab === 'contas' && <Bills {...ctx} />}
        {tab === 'defs' && <Settings {...ctx} theme={theme} setTheme={setTheme} />}
      </main>
      <nav className="tabs" aria-label="Navegação">
        {([['inicio', 'início'], ['despesas', 'despesas'], ['compras', 'compras'], ['historico', 'histórico'], ['contas', 'contas']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} aria-current={tab === k ? 'page' : undefined} className={tab === k ? 'pri' : ''} onClick={() => { setSwipeDir(''); setTab(k); setPanel(''); }}>{l}</button>))}
      </nav>
    </>
  );
}

type Mutate = (label: string, table: Table, kind: Op['kind'], id: string, row?: Record<string, unknown>) => Promise<boolean>;
type Ctx = { data: FamilyData; run: (l: string, f: () => PromiseLike<{ error: unknown }>) => Promise<boolean>; mutate: Mutate; state: Record<string, 'pending' | 'failed'>; online: boolean; setToast: (t: Toast) => void; extra: Extra };
const OPN: Record<Table, string> = { expenses: 'Despesa', settlements: 'Liquidação', shopping_items: 'Compras', recurring_bills: 'Conta', budgets: 'Limite' };
const describeOp = (o: Op) => `${OPN[o.table]}: ${o.kind === 'create' ? 'novo' : o.kind === 'delete' ? 'apagar' : 'alterar'}${o.row.description ? ' «' + o.row.description + '»' : o.row.name ? ' «' + o.row.name + '»' : ''}`;
function Mark({ s }: { s?: 'pending' | 'failed' }) {
  return s ? <span className={'tag ' + (s === 'failed' ? 'err' : 'warn')}>{s === 'failed' ? 'Falhou' : 'Por sincronizar'}</span> : null;
}
type PanelProps = { panel: '' | 'despesa' | 'saldar' | 'fechar'; setPanel: (p: '' | 'despesa' | 'saldar' | 'fechar') => void; editing: Expense | null; openExpense: (e: Expense | null) => void };

const nameOf = (ms: Member[], id: string) => ms.find((m) => m.id === id)?.display_name ?? '?';
function useBalance(d: FamilyData) {
  return useMemo(() => calculateHouseholdBalance(d.members.map((m) => m.id), d.expenses, d.settlements), [d]);
}

function BalanceCard({ data, state }: { data: FamilyData; state: Ctx['state'] }) {
  const b = useBalance(data);
  return (
    <div className="card balance" aria-live="polite">
      <div><Money c={b.debt?.cents ?? 0} className="big" /></div>
      <div className="dim">{b.debt ? `${nameOf(data.members, b.debt.from)} → ${nameOf(data.members, b.debt.to)}` : 'contas certas'}</div>
      {[...data.expenses, ...data.settlements].some((r) => state[r.id]) && <div className="warn small">inclui alterações por sincronizar</div>}
      {data.members.length < 2 && <div className="warn small">falta a segunda pessoa · código em ⚙</div>}
    </div>
  );
}

function ExpenseForm({ data, mutate, editing, close }: Ctx & { editing: Expense | null; close: () => void }) {
  const ms = data.members; const me = data.me!;
  const other = ms.find((m) => m.id !== me.id);
  const [f, setF] = useState(() => editing ? {
    amount: centsToInput(editing.amount_cents), desc: editing.description, cat: editing.category, payer: editing.paid_by,
    type: editing.type, split: editing.split_mode, mine: centsToInput(editing.shares[me.id] ?? 0), date: editing.date,
  } : { amount: '', desc: '', cat: 'Supermercado', payer: me.id, type: (other ? 'partilhada' : 'pessoal') as Expense['type'], split: '50/50' as Expense['split_mode'], mine: '', date: todayIso() });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const cents = parseCents(f.amount);
  const mine = parseCents(f.mine || '0');
  const preview = useMemo(() => {
    if (!cents || f.type !== 'partilhada' || !other) return null;
    const shares = f.split === '50/50' ? splitEqual(cents, ms.map((m) => m.id), f.payer)
      : mine !== null && mine <= cents ? { [me.id]: mine, [other.id]: cents - mine } : null;
    return shares;
  }, [cents, f, mine, ms, me.id, other]);
  const save = async () => {
    setErr('');
    if (!cents || cents <= 0) return setErr('Indica um valor maior que zero (ex.: 12,50).');
    if (!f.desc.trim()) return setErr('Escreve o que foi.');
    if (f.type === 'partilhada' && !preview) return setErr(`A tua parte tem de estar entre 0 e ${eur(cents)}.`);
    const row = { amount_cents: cents, description: f.desc.trim(), category: f.cat, paid_by: f.payer, type: f.type, split_mode: f.split, shares: f.type === 'partilhada' ? preview! : {}, date: f.date || todayIso() };
    const cr = crossings(data.budgets, data.expenses, { ...row, id: editing?.id, is_deleted: false }, editing?.id);
    if (cr.length && !confirm(cr.map((u) => `${u.level === 'over' ? 'Passa o' : 'Chega a 80% do'} limite ${budgetName(u.budget, ms)}: ${eur(u.spent)} / ${eur(u.budget.limit_cents)}`).join('\n') + '\n\nGravar mesmo assim?')) return;
    setBusy(true);
    const id = editing?.id ?? uuid();
    const ok = editing ? await mutate('Despesa atualizada.', 'expenses', 'patch', id, row)
      : await mutate('Despesa registada.', 'expenses', 'create', id, { id, family_id: me.family_id, ...row, is_deleted: false, created_at: new Date().toISOString() });
    setBusy(false); if (ok) close();
  };
  const remove = async () => {
    if (!editing || !confirm('Retirar esta despesa do saldo? Fica no histórico como apagada.')) return;
    setBusy(true); const ok = await mutate('Despesa retirada do saldo.', 'expenses', 'patch', editing.id, { is_deleted: true }); setBusy(false); if (ok) close();
  };
  return (
    <div className="form">
      <h2>{editing ? 'Editar despesa' : 'Nova despesa'}</h2>
      <Field label="Quanto? (€)"><input className="num" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" autoFocus={!editing} /></Field>
      <Field label="O quê?"><input value={f.desc} maxLength={200} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
      <span className="lab">Quem pagou?</span>
      <div className="seg" role="radiogroup" aria-label="Quem pagou?">{ms.map((m) => <button key={m.id} role="radio" aria-checked={f.payer === m.id} className={f.payer === m.id ? 'pri' : ''} onClick={() => setF({ ...f, payer: m.id })}>{m.display_name}</button>)}</div>
      <span className="lab">Tipo</span>
      <div className="seg" role="radiogroup" aria-label="Tipo">
        <button role="radio" aria-checked={f.type === 'partilhada'} disabled={!other} className={f.type === 'partilhada' ? 'pri' : ''} onClick={() => setF({ ...f, type: 'partilhada' })}>Partilhada</button>
        <button role="radio" aria-checked={f.type === 'pessoal'} className={f.type === 'pessoal' ? 'pri' : ''} onClick={() => setF({ ...f, type: 'pessoal' })}>Pessoal</button>
      </div>
      <details>
        <summary>Mais opções (categoria, data, divisão)</summary>
        <Field label="Categoria"><select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Data"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        {f.type === 'partilhada' && other && <>
          <span className="lab">Divisão</span>
          <div className="seg" role="radiogroup" aria-label="Divisão">
            <button role="radio" aria-checked={f.split === '50/50'} className={f.split === '50/50' ? 'pri' : ''} onClick={() => setF({ ...f, split: '50/50' })}>50/50</button>
            <button role="radio" aria-checked={f.split === 'personalizada'} className={f.split === 'personalizada' ? 'pri' : ''} onClick={() => setF({ ...f, split: 'personalizada' })}>Valores personalizados</button>
          </div>
          {f.split === 'personalizada' && <Field label={`A parte de ${me.display_name} (€)`}><input className="num" inputMode="decimal" value={f.mine} onChange={(e) => setF({ ...f, mine: e.target.value })} /></Field>}
        </>}
      </details>
      {preview && other && <p className="dim small">{me.display_name} {eur(preview[me.id])} · {other.display_name} {eur(preview[other.id])}</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        <button className="pri" disabled={busy} onClick={save}>{busy ? 'A guardar…' : 'Guardar despesa'}</button>
        <button onClick={close} disabled={busy}>Cancelar</button>
        {editing && <button className="danger" disabled={busy} onClick={remove}>Retirar</button>}
      </div>
    </div>
  );
}

function SettleForm({ data, mutate, close }: Ctx & { close: () => void }) {
  const b = useBalance(data); const ms = data.members;
  const [from, setFrom] = useState(b.debt?.from ?? data.me!.id);
  const to = ms.find((m) => m.id !== from)?.id;
  const [amount, setAmount] = useState(b.debt ? centsToInput(b.debt.cents) : '');
  const [date, setDate] = useState(todayIso()); const [method, setMethod] = useState('MB WAY');
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!to) return <div className="card"><p>Falta a segunda pessoa na família.</p><button onClick={close}>Fechar</button></div>;
  const save = async () => {
    const c = parseCents(amount); setErr('');
    if (!c || c <= 0) return setErr('Indica um valor maior que zero.');
    setBusy(true);
    const id = uuid();
    const ok = await mutate(confirmed ? 'Liquidação confirmada.' : 'Liquidação registada como «por confirmar» (não conta no saldo).', 'settlements', 'create', id,
      { id, family_id: data.me!.family_id, from_member: from, to_member: to, amount_cents: c, date, method: method.trim() || null, confirmed, confirmed_at: null, is_deleted: false, created_at: new Date().toISOString() });
    setBusy(false); if (ok) close();
  };
  return (
    <div className="form">
      <h2>saldar conta</h2>
      <span className="lab">Quem pagou?</span>
      <div className="seg" role="radiogroup" aria-label="Quem pagou?">{ms.map((m) => <button key={m.id} role="radio" aria-checked={from === m.id} className={from === m.id ? 'pri' : ''} onClick={() => setFrom(m.id)}>{m.display_name}</button>)}</div>
      <p className="dim small">Recebe: {nameOf(ms, to)}</p>
      <Field label="Quanto? (€)"><input className="num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <details><summary>Data e método</summary>
        <Field label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Método (opcional)"><input value={method} maxLength={40} onChange={(e) => setMethod(e.target.value)} placeholder="MB WAY, transferência, numerário…" /></Field>
      </details>
      <label className="check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Confirmo que o dinheiro já foi recebido</label>
      <p className="dim small">A app não faz pagamentos. Só conta no saldo depois de confirmada.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row"><button className="pri" disabled={busy} onClick={save}>{busy ? 'A guardar…' : 'Registar liquidação'}</button><button onClick={close} disabled={busy}>Cancelar</button></div>
    </div>
  );
}

function ExpenseRow({ e, ms, onEdit, s }: { e: Expense; ms: Member[]; onEdit?: () => void; s?: 'pending' | 'failed' }) {
  return (
    <li className={'li' + (e.is_deleted ? ' gone' : '')}>
      <div className="grow"><div>{e.description}{e.is_deleted && ' (retirada)'} <Mark s={s} /></div>
        <div className="dim small">{ptDate(e.date)} · {e.category} · pagou {nameOf(ms, e.paid_by)} · {e.type === 'pessoal' ? 'pessoal' : e.split_mode === '50/50' ? 'partilhada 50/50' : 'partilhada (personalizada)'}</div></div>
      <span className="num">{eur(e.amount_cents)}</span>
      {onEdit && !e.is_deleted && <button onClick={onEdit} aria-label={`Editar ${e.description}`}>Editar</button>}
    </li>
  );
}

function Home(p: Ctx & PanelProps & { goShop: () => void }) {
  const { data, panel, setPanel } = p;
  const recent = data.expenses.filter((e) => !e.is_deleted).slice(0, 5);
  const pending = data.items.filter((i) => !i.bought).length;
  return (
    <>
      <BalanceCard data={data} state={p.state} />
      <Limits data={data} />
      {!panel && <button className="pri wide" onClick={() => p.openExpense(null)}>+ despesa</button>}
      {!panel && <div className="row links"><button className="link" onClick={() => setPanel('fechar')}>fechar mês</button><button className="link" onClick={() => setPanel('saldar')}>saldar</button><button className="link" onClick={p.goShop}>compras · {pending}</button></div>}
      {panel === 'despesa' && <ExpenseForm {...p} close={() => setPanel('')} />}
      {panel === 'fechar' && <CloseMonth data={data} extra={p.extra} mutate={p.mutate as never} online={p.online} close={() => setPanel('')} />}
      {panel === 'saldar' && <SettleForm {...p} close={() => setPanel('')} />}
      <h3>últimas</h3>
      {recent.length ? <ul className="list">{recent.map((e) => <ExpenseRow key={e.id} e={e} ms={data.members} s={p.state[e.id]} />)}</ul> : <p className="dim">Ainda não há despesas.</p>}
    </>
  );
}

export const budgetName = (b: Budget, ms: Member[]) => (b.category === '*' ? 'tudo' : b.category) + ' · ' + (b.member_id ? nameOf(ms, b.member_id) : 'casa');
function Limits({ data }: { data: FamilyData }) {
  const u = usage(data.budgets, data.expenses, todayIso().slice(0, 7));
  if (!u.length) return null;
  return (<ul className="list limits" aria-label="Limites do mês">{u.map((x) => (
    <li key={x.budget.id} className={'lim ' + x.level}>
      <div className="kv small"><span>{budgetName(x.budget, data.members)}</span><span className="num">{eur(x.spent)} / {eur(x.budget.limit_cents)}{x.level === 'over' ? ' · passou' : ''}</span></div>
      <div className="bar"><i style={{ width: Math.min(100, x.ratio * 100) + '%' }} /></div></li>))}</ul>);
}
function LimitsEdit({ data, mutate }: Ctx) {
  const ms = data.members, me = data.me!;
  const [f, setF] = useState({ cat: 'Supermercado', who: '', v: '' }); const [err, setErr] = useState('');
  const add = async () => {
    const c = parseCents(f.v); if (!c || c <= 0) return setErr('Indica um limite maior que zero.');
    const member_id = f.who || null;
    if (data.budgets.some((b) => b.category === f.cat && b.member_id === member_id)) return setErr('Já existe esse limite: altera-o na lista.');
    const id = uuid(); setErr('');
    if (await mutate('Limite guardado.', 'budgets', 'create', id, { id, family_id: me.family_id, category: f.cat, member_id, limit_cents: c, is_deleted: false, created_at: new Date().toISOString() })) setF({ ...f, v: '' });
  };
  const edit = (b: Budget) => { const v = prompt(`Novo limite mensal para ${budgetName(b, ms)} (€):`, centsToInput(b.limit_cents)); if (v == null) return; const c = parseCents(v); if (c && c > 0) mutate('Limite atualizado.', 'budgets', 'patch', b.id, { limit_cents: c }); };
  const del = (b: Budget) => { if (confirm(`Apagar o limite ${budgetName(b, ms)}?`)) mutate('Limite apagado.', 'budgets', 'patch', b.id, { is_deleted: true }); };
  return (<><h3>limites mensais</h3>
    <p className="dim small">casa = despesas partilhadas · pessoa = despesas pessoais dessa pessoa · aviso a 80%, alerta a 100%</p>
    <ul className="list">{data.budgets.map((b) => <li key={b.id} className="li"><span className="grow">{budgetName(b, ms)}</span><span className="num">{eur(b.limit_cents)}</span><button className="link" onClick={() => edit(b)}>alterar</button><button className="link" onClick={() => del(b)}>apagar</button></li>)}
      {!data.budgets.length && <li className="li dim small">sem limites ainda</li>}</ul>
    <div className="row">
      <select aria-label="Categoria" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}><option value="*">tudo</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      <select aria-label="De quem" value={f.who} onChange={(e) => setF({ ...f, who: e.target.value })}><option value="">casa</option>{ms.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select>
      <input aria-label="Limite €/mês" inputMode="decimal" placeholder="€/mês" value={f.v} onChange={(e) => setF({ ...f, v: e.target.value })} style={{ width: '6em' }} />
      <button className="pri" onClick={add}>+</button></div>
    {err && <p className="err small" role="alert">{err}</p>}</>);
}

function Notes({ notes }: { notes: FamilyData['notes'] }) {
  return <ul className="list">{notes.map((n) => <li key={n.id} className="li"><span className="grow">{n.title}</span><span className="num">{n.value_text}</span></li>)}</ul>;
}

function Expenses(p: Ctx & PanelProps) {
  const { data, panel, setPanel, mutate } = p;
  const [showGone, setShowGone] = useState(false);
  const list = data.expenses.filter((e) => showGone || !e.is_deleted);
  const confirmS = (id: string) => mutate('Liquidação confirmada.', 'settlements', 'patch', id, { confirmed: true });
  return (
    <>
      {panel === 'despesa' ? <ExpenseForm {...p} close={() => setPanel('')} /> : <button className="pri wide" onClick={() => p.openExpense(null)}>+ despesa</button>}
      <h3>despesas · {list.length}</h3>
      {list.length ? <ul className="list">{list.map((e) => <ExpenseRow key={e.id} e={e} ms={data.members} s={p.state[e.id]} onEdit={() => p.openExpense(e)} />)}</ul> : <p className="dim">Ainda não há despesas.</p>}
      <label className="check small dim"><input type="checkbox" checked={showGone} onChange={(e) => setShowGone(e.target.checked)} /> mostrar retiradas</label>
      <h3>liquidações</h3>
      {panel === 'saldar' ? <SettleForm {...p} close={() => setPanel('')} /> : <button className="link" onClick={() => setPanel('saldar')}>saldar conta</button>}
      {data.settlements.length > 0 && <ul className="list">{data.settlements.map((s) => (
        <li key={s.id} className="li">
          <div className="grow"><div>{nameOf(data.members, s.from_member)} → {nameOf(data.members, s.to_member)} <Mark s={p.state[s.id]} /></div>
            <div className="dim small">{ptDate(s.date)}{s.method ? ` · ${s.method}` : ''} · <span className={s.confirmed ? 'okt' : 'warn'}>{s.confirmed ? `confirmada${s.confirmed_at ? ' ' + ptDate(s.confirmed_at) : ''}` : 'por confirmar (não conta)'}</span></div></div>
          <span className="num">{eur(s.amount_cents)}</span>
          {!s.confirmed && <button onClick={() => confirmS(s.id)}>Confirmar recebido</button>}
        </li>))}</ul>}
    </>
  );
}

function Shopping({ data, mutate, state }: Ctx) {
  const blank = { id: '', name: '', qty: '', note: '' };
  const [f, setF] = useState(blank); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return;
    const row = { name: f.name.trim(), quantity: f.qty.trim() || null, note: f.note.trim() || null };
    setBusy(true);
    const id = f.id || uuid();
    const ok = f.id ? await mutate('Item atualizado.', 'shopping_items', 'patch', id, row)
      : await mutate('Item adicionado à lista.', 'shopping_items', 'create', id, { id, ...row, family_id: data.me!.family_id, bought: false, created_at: new Date().toISOString() });
    setBusy(false); if (ok) setF(blank);
  };
  const toggle = (i: Item) => mutate(i.bought ? 'Marcado como por comprar.' : 'Marcado como comprado.', 'shopping_items', 'patch', i.id, { bought: !i.bought });
  const del = (i: Item) => mutate('Item apagado.', 'shopping_items', 'delete', i.id);
  return (
    <>
      <div className="form">
        <Field label={f.id ? 'editar item' : 'o que falta?'}><input value={f.name} maxLength={120} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <details open={!!(f.qty || f.note)}><summary>Quantidade e nota</summary>
          <Field label="Quantidade"><input value={f.qty} maxLength={40} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
          <Field label="Nota"><input value={f.note} maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </details>
        <div className="row"><button className="pri" onClick={save} disabled={busy || !f.name.trim()}>{busy ? 'A guardar…' : f.id ? 'Guardar item' : 'Adicionar à lista'}</button>
          {f.id && <button onClick={() => setF(blank)}>Cancelar</button>}</div>
      </div>
      {data.items.length ? <ul className="list">{data.items.map((i) => (
        <li key={i.id} className="li">
          <label className="check grow"><input type="checkbox" checked={i.bought} onChange={() => toggle(i)} />
            <span className={i.bought ? 'gone' : ''}>{i.name}{i.quantity ? ` · ${i.quantity}` : ''}{i.note && <span className="dim small"> — {i.note}</span>}</span> <Mark s={state[i.id]} /></label>
          <button onClick={() => setF({ id: i.id, name: i.name, qty: i.quantity ?? '', note: i.note ?? '' })}>Editar</button>
          <button className="danger" onClick={() => { if (confirm(`Apagar «${i.name}»?`)) del(i); }}>Apagar</button>
        </li>))}</ul> : <p className="dim">A lista está vazia.</p>}
    </>
  );
}

function useLock() {
  const [locked, setLocked] = useState(() => shouldLock(lockEnabled(), null, Date.now()));
  useEffect(() => {
    let hiddenAt: number | null = Date.now();
    const f = () => { if (document.hidden) hiddenAt = Date.now(); else if (shouldLock(lockEnabled(), hiddenAt, Date.now())) setLocked(true); };
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, []);
  return [locked, () => setLocked(false)] as const;
}
function LockScreen({ done }: { done: () => void }) {
  const [err, setErr] = useState('');
  const go = async () => { setErr(''); try { await unlock(); done(); } catch (e) { setErr(msg(e)); } };
  useEffect(() => { go(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (<div className="lockscreen" role="dialog" aria-label="App bloqueada">
    <img src="./icon-192.png" alt="" />
    <button className="pri wide" onClick={go}>desbloquear com impressão digital</button>
    {err && <p className="err small" role="alert">{err}</p>}
    <button className="link" onClick={async () => { disableLock(); await supabase.auth.signOut(); done(); }}>entrar com email e palavra-passe</button>
  </div>);
}
function Lock() {
  const [on, setOn] = useState(lockEnabled()); const [ok, setOk] = useState<boolean | null>(null); const [err, setErr] = useState('');
  useEffect(() => { lockAvailable().then(setOk); }, []);
  const toggle = async () => { setErr(''); try { if (on) disableLock(); else await enableLock('Família Salazar'); setOn(lockEnabled()); } catch (e) { setErr(msg(e)); } };
  return (<><h3>entrada rápida</h3><ul className="list">
    <li className="li"><span className="grow">pedir impressão digital ao abrir</span>{ok ? <button className="link" onClick={toggle}>{on ? 'desligar' : 'ligar'}</button> : <span className="dim small">{ok === false ? 'sem leitor neste aparelho' : '…'}</span>}</li>
    <li className="li dim small">bloqueio só deste aparelho: a sessão continua iniciada; a impressão digital fica no telemóvel e nunca sai dele. Se falhar, entra com email.</li>
  </ul>{err && <p className="err small" role="alert">{err}</p>}</>);
}
function InstallBanner() {
  const [bip, setBip] = useState(!!window.__bip); const [hide, setHide] = useState(false);
  useEffect(() => { const f = () => setBip(!!window.__bip); window.addEventListener('fs-bip', f); return () => window.removeEventListener('fs-bip', f); }, []);
  if (!bip || hide || displayMode() !== 'browser') return null;
  const go = async () => { const e = window.__bip; if (!e) return; await e.prompt(); await e.userChoice.catch(() => null); window.__bip = null; setBip(false); };
  return <div className="banner busy" role="status">abriste no browser · <button className="link" onClick={go}>instalar app</button><button className="x" aria-label="Fechar" onClick={() => setHide(true)}>×</button></div>;
}
function displayMode(): 'fullscreen' | 'standalone' | 'browser' {
  const q = (m: string) => window.matchMedia?.(`(display-mode: ${m})`).matches;
  if (q('fullscreen') || document.fullscreenElement) return 'fullscreen';
  if (q('standalone') || (navigator as Navigator & { standalone?: boolean }).standalone) return 'standalone';
  return 'browser';
}
function Screen() {
  const [mode, setMode] = useState(displayMode());
  useEffect(() => { const f = () => setMode(displayMode()); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [bip, setBip] = useState(!!window.__bip);
  useEffect(() => { const f = () => setBip(!!window.__bip); window.addEventListener('fs-bip', f); return () => window.removeEventListener('fs-bip', f); }, []);
  const install = async () => { const e = window.__bip; if (!e) return; await e.prompt(); await e.userChoice.catch(() => null); window.__bip = null; setBip(false); };
  const canFs = !!document.documentElement.requestFullscreen && !ios;
  const toggle = async () => { try { if (document.fullscreenElement) { localStorage.setItem('fs-autofs', 'off'); await document.exitFullscreen(); } else { localStorage.removeItem('fs-autofs'); await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } } catch { /* recusado pelo browser */ } setMode(displayMode()); };
  return (<><h3>ecrã</h3><ul className="list">
    <li className="li"><span className="grow">modo atual</span><span className="acc">{mode === 'fullscreen' ? 'ecrã inteiro' : mode === 'standalone' ? 'app instalada' : 'browser'}</span></li>
    {canFs && <li className="li"><span className="grow">ecrã inteiro</span><button className="link" onClick={toggle}>{document.fullscreenElement ? 'sair' : 'ativar'}</button></li>}
    <li className="li dim small" style={{display:'block',wordBreak:'break-all'}}>
      diagnóstico · modo: {['fullscreen','standalone','minimal-ui','browser'].find(m => matchMedia('(display-mode: ' + m + ')').matches) ?? '?'}
      {' · instalada: '}{(matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || new URLSearchParams(location.search).get('source') === 'pwa' || sessionStorage.getItem('fs-pwa') === '1') ? 'sim' : 'não'}
      {' · '}{location.href}{' · '}{navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? ''}
    </li>
    {bip && mode === 'browser' && <li className="li"><span className="grow">instalar como app</span><button className="pri" onClick={install}>instalar app</button></li>}
    {mode === 'browser' && <li className="li dim small">{ios ? 'Safari → Partilhar → Adicionar ao ecrã principal, e abre pelo ícone.' : 'Chrome → ⋮ → Instalar app / Adicionar ao ecrã principal, e abre pelo ícone.'}</li>}
    {ios && mode === 'standalone' && <li className="li dim small">no iPhone isto já é o máximo: a barra de estado fica por cima da app.</li>}
  </ul></>);
}
function Settings({ data, online, theme, setTheme, mutate, run, state, setToast, extra }: Ctx & { theme: ThemeId; setTheme: (t: ThemeId) => void }) {
  const [copied, setCopied] = useState(false);
  const code = data.family!.invite_code;
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão: o código fica visível */ } };
  return (
    <>
      <h3>tema</h3>
      <ul className="list themes" role="radiogroup" aria-label="Tema">{THEMES.map((t) => (
        <li key={t.id}><button role="radio" aria-checked={theme === t.id} className={'li theme' + (theme === t.id ? ' on' : '')} onClick={() => setTheme(t.id)}>
          <span className="sw" style={{ background: t.bg, boxShadow: `inset -10px 0 0 ${t.acc}` }} /><span className="grow">{t.name}</span>{theme === t.id && <span className="acc">●</span>}</button></li>))}</ul>
      <Lock />
      <Screen />
      <LimitsEdit data={data} mutate={mutate} run={run} state={state} online={online} setToast={setToast} extra={extra} />
      <h3>família</h3>
      <ul className="list">{data.members.map((m) => <li key={m.id} className="li"><span className="grow">{m.display_name}</span>{m.id === data.me!.id && <span className="dim">tu</span>}</li>)}
        <li className="li"><span className="grow dim">convite</span><span className="num acc">{code}</span><button className="link" onClick={copy}>{copied ? 'copiado' : 'copiar'}</button></li></ul>
      <h3>sessão</h3>
      <button className="link" disabled={!online} onClick={() => supabase.auth.signOut()}>terminar sessão</button>{!online && <p className="dim small">só com rede, para não perder o que está por sincronizar</p>}
    </>
  );
}

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

function History({ data, refetch, online, extra }: { data: FamilyData; refetch: () => void; online: boolean; extra: Extra }) {
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
  const fv = useMemo(() => fixedVsVariable(data.bills, a?.total ?? 0), [data.bills, a]);
  const tips = useMemo(() => savingTips(ms, data.bills, n), [ms, data.bills, n]);
  const since = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); }, []);
  const stores = useMemo(() => byStore(data.expenses, since), [data.expenses, since]);
  const ym = todayIso().slice(0, 7);
  const pace = useMemo(() => currentPace(ms, data.expenses, todayIso(), n), [ms, data.expenses, n]);
  const nowM = data.expenses.filter((e) => !e.is_deleted && e.type === 'partilhada' && e.date?.startsWith(ym)).reduce((s, e) => s + e.amount_cents, 0);
  const notes = data.notes;
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
      <h3>este mês · {ymLabel(pace.ym)} · dia {pace.day}/{pace.dim} · vs média {n}m</h3>
      <p className={pace.total.flag ? 'bad' : ''}><span className="big num">{eur(pace.total.spent)}</span> <span className="dim">até hoje → ritmo </span><span className="num">{eur(pace.total.proj)}</span>{pace.total.avg != null && <span className="dim"> · normal {eur(pace.total.avg)} · </span>}{pace.total.ratio != null && <span className={pace.total.ratio > 1.2 ? 'bad' : pace.total.ratio > 1 ? 'warn' : 'ok'}>{Math.round(pace.total.ratio * 100)}%</span>}</p>
      {pace.cats.length > 0 ? <table className="t"><tbody>{pace.cats.map((c) => <tr key={c.cat} className={c.flag ? 'bad' : ''}>
        <td>{c.flag ? '▲ ' : ''}{c.cat}</td><td className="num">{eur(c.spent)}</td><td className="num dim">→{eur(c.proj)}</td><td className="num dim">{c.avg != null ? eur(c.avg) : '—'}</td><td className="num">{c.ratio != null ? <span className={c.ratio > 1.2 ? 'bad' : c.ratio > 1 ? 'warn' : 'ok'}>{Math.round(c.ratio * 100)}%</span> : <span className="dim">novo</span>}</td></tr>)}</tbody></table>
        : <p className="dim small">ainda sem despesas partilhadas este mês</p>}
      <p className="dim small">gasto · →projeção ao ritmo atual · normal · % do normal. ▲ = mais de 20% acima do normal.</p>

      <h3>quanto custa · €/mês · €/ano · % · vs {n}m antes</h3>
      <table className="t"><tbody>{cats.map((c) => <tr key={c.cat}>
        <td>{c.cat}<i style={{ width: (c.month / cats[0].month) * 100 + '%' }} /></td><td className="num">{eur(c.month)}</td><td className="num dim">{eur(c.year).replace(',00', '')}</td><td className="num dim">{c.pct}%</td><td className="num">{tr(c.trend)}</td></tr>)}</tbody></table>

      {a && data.bills.length > 0 && <><h3>fixas vs variáveis</h3>
        <div className="split"><i style={{ width: Math.min(100, (fv.fixed / Math.max(1, a.total)) * 100) + '%' }} /></div>
        <div className="kv"><span>fixas <span className="num">{eur(fv.fixed)}</span></span><span>variáveis <span className="num">{eur(fv.variable)}</span></span></div>
        <p className="dim small">fixas = contas recorrentes com valor{fv.estimated ? ' (inclui estimativas ≈)' : ''}{fv.unknown ? ` · ${fv.unknown} por registar` : ''} · variáveis = média − fixas</p></>}

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
          <span className="grow">{ymLabel(m.ym)}{m.provisional && <span className="warn"> · em aberto</span>}</span>
          <span className="num">{eur(m.total_cents)}</span></button>
          {open === m.ym && <div className="sub dim small">{Object.entries(m.cats).sort((x, y) => y[1] - x[1]).map(([c, v]) => <div key={c} className="kv"><span>{c}</span><span className="num">{eur(v)}</span></div>)}{m.extra_cents > 0 && <div className="kv"><span>dos quais extraordinários</span><span className="num">{eur(m.extra_cents)}</span></div>}{m.note && <p>{m.note}</p>}<button className="link" disabled={!online || busy} onClick={() => setOpenMonth(m.ym, !m.provisional)}>{m.provisional ? 'fechar mês' : 'reabrir mês'}</button></div>}
        </li>))}</ul>
    </>
  );
}

const PER: Record<Bill['period'], string> = { mensal: '/mês', bimestral: '/2 meses', trimestral: '/3 meses', anual: '/ano', 'variável': '/mês' };
function Bills({ data, mutate, state, extra, online }: Ctx) {
  const [edit, setEdit] = useState<string | null>(null);
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const bills = data.bills;
  const total = bills.reduce((s, b) => s + (monthly(b.amount_cents, b.period) ?? 0), 0);
  const unknown = bills.filter((b) => b.amount_cents == null).length;
  const save = async (b: Bill) => {
    setErr('');
    const c = val.trim() === '' ? null : parseCents(val);
    if (val.trim() !== '' && c === null) return setErr('valor inválido (ex.: 12,50)');
    if (await mutate('Conta atualizada.', 'recurring_bills', 'patch', b.id, { amount_cents: c, estimate: false })) setEdit(null);
  };
  const up = <Upcoming data={data} extra={extra} online={online} />;
  if (!bills.length) return <>{up}<p className="dim">sem contas recorrentes · corre migration_v3.sql e o seed privado no Supabase</p></>;
  return (
    <>
      {up}
      <h3>contas da casa</h3>
      <div className="kpi"><div><span className="big num">{eur(total)}</span><span className="dim">/mês</span></div>
        <div className="dim">{unknown ? `${unknown} por registar · ` : ''}≈ = estimativa</div></div>
      <ul className="list">{bills.map((b) => (
        <li key={b.id} className="li col">
          <button className="row-btn" aria-expanded={edit === b.id} onClick={() => { setEdit(edit === b.id ? null : b.id); setVal(b.amount_cents == null ? '' : centsToInput(b.amount_cents)); setErr(''); }}>
            <span className="grow">{b.name} <Mark s={state[b.id]} /></span>
            {b.amount_cents == null ? <span className="warn small">valor por registar</span>
              : <span className="num">{b.estimate ? '≈ ' : ''}{eur(b.amount_cents)}<span className="dim small">{PER[b.period]}</span></span>}
          </button>
          {(b.note || b.payer || b.method) && <div className="sub dim small">{[b.payer, b.method, b.note].filter(Boolean).join(' · ')}</div>}
          {edit === b.id && <div className="sub row">
            <input className="num" inputMode="decimal" aria-label={`Valor de ${b.name}`} value={val} onChange={(e) => setVal(e.target.value)} placeholder="0,00" autoFocus />
            <button className="pri" onClick={() => save(b)}>guardar</button>{err && <span className="err small">{err}</span>}</div>}
        </li>))}</ul>
    </>
  );
}
