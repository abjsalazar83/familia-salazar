import type { Pref } from './shop';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Bill, Budget, Expense, Family, HistoryMonth, Item, Member, Note, Settlement } from './types';
import { idbGet, idbSet } from './idb';
import { applyOps, classify, discardOp, enqueue, flush, mergeAfterFlush, retryOp, type ExecResult, type Op, type Snapshot, type Table } from './outbox';

export type FamilyData = { family: Family | null; me: Member | null; members: Member[]; expenses: Expense[]; settlements: Settlement[]; items: Item[]; notes: Note[]; months: HistoryMonth[]; bills: Bill[]; budgets: Budget[]; prefs?: Pref[] };
const EMPTY: FamilyData = { family: null, me: null, members: [], expenses: [], settlements: [], items: [], notes: [], months: [], bills: [], budgets: [] };
type Cache = { data: FamilyData; syncedAt: string };

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const u = () => setOn(true), d = () => setOn(false);
    addEventListener('online', u); addEventListener('offline', d);
    return () => { removeEventListener('online', u); removeEventListener('offline', d); };
  }, []);
  return on;
}

async function exec(o: Op): Promise<ExecResult> {
  try {
    const t = supabase.from(o.table);
    if (o.kind === 'create') {
      // id gerado no cliente → reenviar é inofensivo (ON CONFLICT DO NOTHING).
      const { error } = await t.upsert(o.row, { onConflict: 'id', ignoreDuplicates: true }); if (error) return classify(error);
    } else if (o.kind === 'patch') {
      const { data, error } = await t.update(o.row).eq('id', o.id).select('id'); if (error) return classify(error);
      if (!data?.length) return { ok: false, retry: false, error: 'Conflito: o registo já não existe no servidor.' };
    } else {
      const { error } = await t.delete().eq('id', o.id); if (error) return classify(error);
    }
    return { ok: true };
  } catch (e) { return classify(e); }
}

export function useFamily(session: Session | null) {
  const [server, setServer] = useState<FamilyData>(EMPTY);
  const [queue, setQueueState] = useState<Op[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const uid = session?.user.id;
  const busy = useRef(false); const flushing = useRef(false);
  const qRef = useRef<Op[]>([]);
  const qKey = 'outbox:' + uid, cKey = 'cache:' + uid;

  const setQueue = useCallback(async (q: Op[]) => { qRef.current = q; setQueueState(q); await idbSet(qKey, q); }, [qKey]);

  const refetch = useCallback(async () => {
    if (!uid || busy.current) return;
    busy.current = true;
    try {
      const { data: me, error: e1 } = await supabase.from('family_members').select('*').eq('user_id', uid).maybeSingle();
      if (e1) throw e1;
      let next = EMPTY;
      if (me) {
        const fid = me.family_id;
        const [f, m, e, s, i, n, h, b, bu, sp] = await Promise.all([
          supabase.from('families').select('id,name,invite_code').eq('id', fid).single(),
          supabase.from('family_members').select('*').eq('family_id', fid).order('created_at'),
          supabase.from('expenses').select('*').eq('family_id', fid).order('date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('settlements').select('*').eq('family_id', fid).order('date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('shopping_items').select('*').eq('family_id', fid).order('bought').order('created_at', { ascending: false }),
          supabase.from('history_notes').select('*').eq('family_id', fid).order('sort'),
          supabase.from('history_months').select('*').eq('family_id', fid).order('ym'),
          supabase.from('recurring_bills').select('*').eq('family_id', fid).order('sort').order('name'),
          supabase.from('budgets').select('*').eq('family_id', fid).eq('is_deleted', false).order('created_at'),
          supabase.from('shopping_prefs').select('*').eq('family_id', fid).order('uses', { ascending: false }).limit(500),
        ]);
        for (const r of [f, m, e, s, i, n]) if (r.error) throw r.error;
        // Antes de correr migration_v3.sql estas tabelas não existem: a app continua a funcionar sem histórico.
        const opt = <T,>(r: { data: T[] | null; error: unknown }) => (r.error ? [] : r.data ?? []);
        next = { family: f.data, me, members: m.data!, expenses: e.data!, settlements: s.data!, items: i.data!, notes: n.data!, months: opt<HistoryMonth>(h), bills: opt<Bill>(b), budgets: opt<Budget>(bu), prefs: opt<Pref>(sp) };
      }
      const at = new Date();
      setServer(next); setStatus('ready'); setError(''); setSyncedAt(at);
      await idbSet(cKey, { data: next, syncedAt: at.toISOString() } satisfies Cache);
    } catch (err) {
      setError((err as Error).message || 'Erro a carregar');
      setStatus((s) => (s === 'loading' ? 'error' : s)); // com cache, continua a mostrar os dados
    } finally { busy.current = false; }
  }, [uid, cKey]);

  const sync = useCallback(async () => {
    if (!uid || flushing.current) return;
    flushing.current = true; setSyncing(true);
    try {
      if (qRef.current.some((o) => o.status === 'pending')) {
        const start = qRef.current;
        const { queue: q } = await flush(start, exec);
        if (q.length < start.length && navigator.onLine) await refetch(); // trazer do servidor o que foi aceite antes de tirar a marca
        await setQueue(mergeAfterFlush(start, q, qRef.current));
      }
      if (navigator.onLine) await refetch(); // a marca "por sincronizar" só sai quando o servidor confirmou
    } finally { flushing.current = false; setSyncing(false); }
  }, [uid, refetch, setQueue]);

  // Arranque: mostrar cache e fila imediatamente, depois sincronizar.
  useEffect(() => {
    if (!uid) return;
    let off = false;
    (async () => {
      const [c, q] = await Promise.all([idbGet<Cache>(cKey), idbGet<Op[]>(qKey)]);
      if (off) return;
      qRef.current = q ?? []; setQueueState(qRef.current);
      if (c) { setServer(c.data); setSyncedAt(new Date(c.syncedAt)); setStatus('ready'); } else setStatus('loading');
      await sync();
    })();
    return () => { off = true; };
  }, [uid, cKey, qKey, sync]);

  // Repetir envio com espera crescente enquanto houver pendentes.
  useEffect(() => {
    const pend = queue.filter((o) => o.status === 'pending');
    if (!pend.length) return;
    const wait = Math.max(1000, Math.min(...pend.map((o) => o.nextAt)) - Date.now());
    const t = setTimeout(() => { if (navigator.onLine) sync(); }, wait);
    return () => clearTimeout(t);
  }, [queue, sync]);

  const fid = server.family?.id;
  useEffect(() => {
    if (!fid) return;
    const ch = supabase.channel('familia-' + fid);
    for (const t of ['expenses', 'settlements', 'shopping_items', 'family_members', 'history_notes', 'history_months', 'recurring_bills', 'budgets', 'shopping_prefs'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `family_id=eq.${fid}` }, () => refetch());
    ch.subscribe((st) => setLive(st === 'SUBSCRIBED'));
    const vis = () => { if (document.visibilityState === 'visible') sync(); };
    const on = () => { setQueue(qRef.current.map((o) => (o.status === 'pending' ? { ...o, nextAt: 0 } : o))).then(sync); };
    document.addEventListener('visibilitychange', vis); addEventListener('online', on);
    return () => { supabase.removeChannel(ch); setLive(false); document.removeEventListener('visibilitychange', vis); removeEventListener('online', on); };
  }, [fid, refetch, sync, setQueue]);

  const mutate = useCallback(async (table: Table, kind: Op['kind'], id: string, row: Record<string, unknown> = {}) => {
    await setQueue(enqueue(qRef.current, { table, kind, id, row }));
    if (navigator.onLine) sync();
  }, [setQueue, sync]);
  const retry = useCallback(async (opId: string) => { await setQueue(retryOp(qRef.current, opId)); sync(); }, [setQueue, sync]);
  const discard = useCallback((opId: string) => setQueue(discardOp(qRef.current, opId)), [setQueue]);

  const { data, state } = useMemo(() => {
    const snap: Snapshot = { expenses: server.expenses, settlements: server.settlements, shopping_items: server.items, recurring_bills: server.bills ?? [], budgets: server.budgets ?? [] } as unknown as Snapshot;
    const r = applyOps(snap, queue);
    return { data: { ...server, expenses: r.data.expenses as unknown as Expense[], settlements: r.data.settlements as unknown as Settlement[], items: r.data.shopping_items as unknown as Item[], months: server.months ?? [], bills: r.data.recurring_bills as unknown as Bill[], budgets: (r.data.budgets as unknown as Budget[]).filter((x) => !x.is_deleted) }, state: r.state };
  }, [server, queue]);

  return { data, state, queue, status, error, syncedAt, live, syncing, refetch: sync, mutate, retry, discard };
}
