import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Expense, Family, Item, Member, Note, Settlement } from './types';

export type FamilyData = { family: Family | null; me: Member | null; members: Member[]; expenses: Expense[]; settlements: Settlement[]; items: Item[]; notes: Note[] };
const EMPTY: FamilyData = { family: null, me: null, members: [], expenses: [], settlements: [], items: [], notes: [] };

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const u = () => setOn(true), d = () => setOn(false);
    addEventListener('online', u); addEventListener('offline', d);
    return () => { removeEventListener('online', u); removeEventListener('offline', d); };
  }, []);
  return on;
}

export function useFamily(session: Session | null) {
  const [data, setData] = useState<FamilyData>(EMPTY);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const uid = session?.user.id;
  const busy = useRef(false);

  const refetch = useCallback(async () => {
    if (!uid || busy.current) return;
    busy.current = true;
    try {
      const { data: me, error: e1 } = await supabase.from('family_members').select('*').eq('user_id', uid).maybeSingle();
      if (e1) throw e1;
      if (!me) { setData(EMPTY); setStatus('ready'); setSyncedAt(new Date()); return; }
      const fid = me.family_id;
      const [f, m, e, s, i, n] = await Promise.all([
        supabase.from('families').select('id,name,invite_code').eq('id', fid).single(),
        supabase.from('family_members').select('*').eq('family_id', fid).order('created_at'),
        supabase.from('expenses').select('*').eq('family_id', fid).order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('settlements').select('*').eq('family_id', fid).order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('shopping_items').select('*').eq('family_id', fid).order('bought').order('created_at', { ascending: false }),
        supabase.from('history_notes').select('*').eq('family_id', fid).order('sort'),
      ]);
      for (const r of [f, m, e, s, i, n]) if (r.error) throw r.error;
      setData({ family: f.data, me, members: m.data!, expenses: e.data!, settlements: s.data!, items: i.data!, notes: n.data! });
      setStatus('ready'); setError(''); setSyncedAt(new Date());
    } catch (err) {
      setError((err as Error).message || 'Erro a carregar'); setStatus('error');
    } finally { busy.current = false; }
  }, [uid]);

  useEffect(() => { setStatus('loading'); refetch(); }, [refetch]);

  // Sincronização: tempo real + recarregar ao voltar à app ou à rede.
  const fid = data.family?.id;
  useEffect(() => {
    if (!fid) return;
    const ch = supabase.channel('familia-' + fid);
    for (const t of ['expenses', 'settlements', 'shopping_items', 'family_members', 'history_notes'])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `family_id=eq.${fid}` }, () => refetch());
    ch.subscribe((st) => setLive(st === 'SUBSCRIBED'));
    const vis = () => { if (document.visibilityState === 'visible') refetch(); };
    document.addEventListener('visibilitychange', vis); addEventListener('online', refetch);
    return () => { supabase.removeChannel(ch); setLive(false); document.removeEventListener('visibilitychange', vis); removeEventListener('online', refetch); };
  }, [fid, refetch]);

  return { data, status, error, syncedAt, live, refetch };
}
