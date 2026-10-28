import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useFamily, useOnline, type FamilyData } from './lib/useFamily';
import { calculateHouseholdBalance, splitEqual } from './lib/balance';
import { eur, parseCents, centsToInput, ptDate, todayIso } from './lib/money';
import { CATS, type Bill, type Expense, type HistoryMonth, type Item, type Member } from './lib/types';
import { averages, monthly, yearly, ymLabel } from './lib/history';
import { THEMES, type ThemeId } from './themes';
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
  const [theme, setTheme] = useState<ThemeId>(() => { const t = localStorage.getItem('fs-theme') as ThemeId; return THEMES.some((x) => x.id === t) ? t : 'tokyo-night'; });
  useEffect(() => {
    const t = THEMES.find((x) => x.id === theme)!;
    document.documentElement.dataset.theme = theme; localStorage.setItem('fs-theme', theme);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.bg);
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
        <h1><span className="acc">~/</span>família</h1>
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
  const [panel, setPanel] = useState<'' | 'despesa' | 'saldar'>('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<Toast>(null);

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

  if (status === 'loading') return <p className="dim">A carregar dados…</p>;
  if (status === 'error' && !data.me) return (
    <div className="card"><p className="err" role="alert">{msg(error)}</p>
      <button onClick={refetch}>Tentar de novo</button> <button onClick={() => supabase.auth.signOut()}>Sair</button></div>);
  if (!data.me || !data.family) return <><Onboarding online={online} done={refetch} /><button onClick={() => supabase.auth.signOut()}>Sair</button></>;

  const ctx = { data, run, mutate, state, online, setToast };
  const openExpense = (e: Expense | null) => { setEditing(e); setPanel('despesa'); };
  return (
    <>
      <div className="sync dim" aria-live="polite">
        {status === 'error' ? <span className="err">Falha a sincronizar: {msg(error)}</span>
          : <>{online ? 'Sincronizado' : 'Última sincronização'} {syncedAt?.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{live && online ? ' · tempo real' : ''}</>}
        {pendingN > 0 && <span className="warn"> · {pendingN} por sincronizar{syncing && online ? ' (a enviar…)' : ''}</span>}
        <button className={'gear' + (tab === 'defs' ? ' on' : '')} aria-label="Definições" onClick={() => { setTab('defs'); setPanel(''); }}>⚙</button>
      </div>
      {toast && <div className={'banner ' + toast.kind} role={toast.kind === 'bad' ? 'alert' : 'status'}>{toast.text}{toast.kind === 'bad' && <button className="x" aria-label="Fechar" onClick={() => setToast(null)}>×</button>}</div>}
      {failed.length > 0 && <div className="card" role="alert"><h2 className="err">Falhou ({failed.length})</h2>
        <p className="dim small">O servidor não aceitou estas alterações. Continuam guardadas neste aparelho até decidires.</p>
        <ul className="list">{failed.map((o) => <li key={o.opId} className="li"><div className="grow"><div>{describeOp(o)}</div><div className="err small">{msg(o.error)}</div></div>
          <button onClick={() => retry(o.opId)} disabled={!online}>Tentar de novo</button>
          <button className="danger" onClick={() => { if (confirm('Descartar esta alteração local? Não foi guardada no servidor.')) discard(o.opId); }}>Descartar</button></li>)}</ul></div>}
      <main>
        {tab === 'inicio' && <Home {...ctx} panel={panel} setPanel={setPanel} editing={editing} openExpense={openExpense} goShop={() => setTab('compras')} />}
        {tab === 'despesas' && <Expenses {...ctx} panel={panel} setPanel={setPanel} editing={editing} openExpense={openExpense} />}
        {tab === 'compras' && <Shopping {...ctx} />}
        {tab === 'historico' && <History data={data} />}
        {tab === 'contas' && <Bills {...ctx} />}
        {tab === 'defs' && <Settings {...ctx} theme={theme} setTheme={setTheme} />}
      </main>
      <nav className="tabs" aria-label="Navegação">
        {([['inicio', 'início'], ['despesas', 'despesas'], ['compras', 'compras'], ['historico', 'histórico'], ['contas', 'contas']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} aria-current={tab === k ? 'page' : undefined} className={tab === k ? 'pri' : ''} onClick={() => { setTab(k); setPanel(''); }}>{l}</button>))}
      </nav>
    </>
  );
}

type Mutate = (label: string, table: Table, kind: Op['kind'], id: string, row?: Record<string, unknown>) => Promise<boolean>;
type Ctx = { data: FamilyData; run: (l: string, f: () => PromiseLike<{ error: unknown }>) => Promise<boolean>; mutate: Mutate; state: Record<string, 'pending' | 'failed'>; online: boolean; setToast: (t: Toast) => void };
const OPN: Record<Table, string> = { expenses: 'Despesa', settlements: 'Liquidação', shopping_items: 'Compras', recurring_bills: 'Conta' };
const describeOp = (o: Op) => `${OPN[o.table]}: ${o.kind === 'create' ? 'novo' : o.kind === 'delete' ? 'apagar' : 'alterar'}${o.row.description ? ' «' + o.row.description + '»' : o.row.name ? ' «' + o.row.name + '»' : ''}`;
function Mark({ s }: { s?: 'pending' | 'failed' }) {
  return s ? <span className={'tag ' + (s === 'failed' ? 'err' : 'warn')}>{s === 'failed' ? 'Falhou' : 'Por sincronizar'}</span> : null;
}
type PanelProps = { panel: '' | 'despesa' | 'saldar'; setPanel: (p: '' | 'despesa' | 'saldar') => void; editing: Expense | null; openExpense: (e: Expense | null) => void };

const nameOf = (ms: Member[], id: string) => ms.find((m) => m.id === id)?.display_name ?? '?';
function useBalance(d: FamilyData) {
  return useMemo(() => calculateHouseholdBalance(d.members.map((m) => m.id), d.expenses, d.settlements), [d]);
}

function BalanceCard({ data, state }: { data: FamilyData; state: Ctx['state'] }) {
  const b = useBalance(data);
  return (
    <div className="card balance" aria-live="polite">
      <div className="big num">{eur(b.debt?.cents ?? 0)}</div>
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
      {!panel && <button className="pri wide" onClick={() => p.openExpense(null)}>+ despesa</button>}
      {!panel && <div className="row links"><button className="link" onClick={() => setPanel('saldar')}>saldar conta</button><button className="link" onClick={p.goShop}>compras · {pending}</button></div>}
      {panel === 'despesa' && <ExpenseForm {...p} close={() => setPanel('')} />}
      {panel === 'saldar' && <SettleForm {...p} close={() => setPanel('')} />}
      <h3>últimas</h3>
      {recent.length ? <ul className="list">{recent.map((e) => <ExpenseRow key={e.id} e={e} ms={data.members} s={p.state[e.id]} />)}</ul> : <p className="dim">Ainda não há despesas.</p>}
    </>
  );
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

function Settings({ data, online, theme, setTheme }: Ctx & { theme: ThemeId; setTheme: (t: ThemeId) => void }) {
  const [copied, setCopied] = useState(false);
  const code = data.family!.invite_code;
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão: o código fica visível */ } };
  return (
    <>
      <h3>tema</h3>
      <ul className="list themes" role="radiogroup" aria-label="Tema">{THEMES.map((t) => (
        <li key={t.id}><button role="radio" aria-checked={theme === t.id} className={'li theme' + (theme === t.id ? ' on' : '')} onClick={() => setTheme(t.id)}>
          <span className="sw" style={{ background: t.bg, boxShadow: `inset -10px 0 0 ${t.acc}` }} /><span className="grow">{t.name}</span>{theme === t.id && <span className="acc">●</span>}</button></li>))}</ul>
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

function History({ data }: { data: FamilyData }) {
  const ms = data.months;
  const [n, setN] = useState(12);
  const [open, setOpen] = useState<string | null>(null);
  const a = useMemo(() => averages(ms, n), [ms, n]);
  const ys = useMemo(() => yearly(ms), [ms]);
  const acertos = data.notes.filter((x) => x.kind === 'acerto');
  if (!ms.length) return <p className="dim">sem histórico ainda · corre migration_v3.sql e o seed privado no Supabase</p>;
  const last = [...ms].sort((x, y) => x.ym.localeCompare(y.ym)).slice(-n);
  return (
    <>
      <div className="seg" role="radiogroup" aria-label="Período">{[12, 24, 60].map((k) => <button key={k} role="radio" aria-checked={n === k} className={n === k ? 'pri' : ''} onClick={() => setN(k)}>{k}m</button>)}</div>
      {a && <div className="kpi">
        <div><span className="big num">{eur(a.total)}</span><span className="dim">/mês</span></div>
        <div className="dim">{eur(a.noExtra)} sem extraordinários · {ymLabel(a.from)}–{ymLabel(a.to)}</div>
      </div>}
      <Bars items={last.map((m) => ({ label: ymLabel(m.ym) + (m.provisional ? ' (provisório)' : ''), v: m.total_cents, dim: m.provisional }))} avg={a?.total} />
      <div className="axis dim small"><span>{ymLabel(last[0].ym)}</span><span>— média</span><span>{ymLabel(last[last.length - 1].ym)}</span></div>
      {a && <><h3>por categoria · média/mês</h3>
        <ul className="list hbars">{a.byCat.filter(([, v]) => v > 0).map(([c, v]) => <li key={c} className="li"><span className="grow">{c}<i style={{ width: (v / a.byCat[0][1]) * 100 + '%' }} /></span><span className="num">{eur(v)}</span></li>)}</ul></>}
      <h3>por ano · média/mês</h3>
      <Bars height={70} items={ys.map((y) => ({ label: y.year, v: y.avg }))} />
      <div className="axis dim small">{ys.map((y) => <span key={y.year}>{y.year.slice(2)}</span>)}</div>
      {acertos.length > 0 && <><h3>acertos</h3><Notes notes={acertos} /></>}
      <h3>meses</h3>
      <ul className="list">{[...ms].sort((x, y) => y.ym.localeCompare(x.ym)).map((m: HistoryMonth) => (
        <li key={m.ym} className="li col"><button className="row-btn" aria-expanded={open === m.ym} onClick={() => setOpen(open === m.ym ? null : m.ym)}>
          <span className="grow">{ymLabel(m.ym)}{m.provisional && <span className="warn"> · provisório</span>}</span>
          {m.extra_cents > 0 && <span className="dim small">+{eur(m.extra_cents)} extra </span>}<span className="num">{eur(m.total_cents)}</span></button>
          {open === m.ym && <div className="sub dim small">{Object.entries(m.cats).sort((x, y) => y[1] - x[1]).map(([c, v]) => <div key={c} className="kv"><span>{c}</span><span className="num">{eur(v)}</span></div>)}{m.note && <p>{m.note}</p>}</div>}
        </li>))}</ul>
    </>
  );
}

const PER: Record<Bill['period'], string> = { mensal: '/mês', bimestral: '/2 meses', trimestral: '/3 meses', anual: '/ano', 'variável': '/mês' };
function Bills({ data, mutate, state }: Ctx) {
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
  if (!bills.length) return <p className="dim">sem contas recorrentes · corre migration_v3.sql e o seed privado no Supabase</p>;
  return (
    <>
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
