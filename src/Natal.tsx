// Resumo: cartão «Natal 🎄» — total da época, conjunta vs pessoal, quem pagou e orçamento opcional (family_settings).
import { useMemo, useState } from 'react';
import { eur, parseCents, centsToInput, todayIso } from './lib/money';
import { supabase } from './lib/supabase';
import { natalSummary, seasonBudget, showNatal } from './lib/natal';
import { payerTone } from './lib/view';
import type { Expense, Member } from './lib/types';
import type { Extra } from './Plan';

export function NatalCard({ exps, members, extra, online, today = todayIso() }: { exps: Expense[]; members: Member[]; extra: Extra; online: boolean; today?: string }) {
  const st = extra.settings;
  const [local, setLocal] = useState<{ cents: number | null; year: number } | null>(null);
  const base = useMemo(() => natalSummary(exps, today, null), [exps, today]);
  const budget = base ? (local && local.year === base.season.year ? local.cents : seasonBudget(st, base.season)) : null;
  const s = useMemo(() => natalSummary(exps, today, budget), [exps, today, budget]);
  const [edit, setEdit] = useState(false); const [v, setV] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!s || !showNatal(s, today)) return null;
  const fid = members[0]?.family_id;
  const save = async (cents: number | null) => {
    setErr(''); if (!fid) return;
    setBusy(true);
    const { error } = await supabase.from('family_settings').upsert({ family_id: fid, natal_budget_cents: cents, natal_budget_year: cents == null ? null : s.season.year }, { onConflict: 'family_id' });
    setBusy(false);
    if (error) return setErr('Não foi possível guardar: ' + error.message);
    setLocal({ cents, year: s.season.year }); setEdit(false); extra.reload();
  };
  const submit = () => { const t = v.trim(); if (!t) return save(null); const c = parseCents(t); if (c == null || c <= 0) return setErr('Valor inválido (ex.: 400).'); save(c); };
  const pctShared = s.total ? Math.round((s.shared / s.total) * 100) : 0;
  const over = s.left != null && s.left < 0;
  const who = members.map((m) => ({ m, v: s.paid[m.id] ?? 0 }));
  const yr = `${s.season.year}/${String(s.season.year + 1).slice(2)}`;
  return <section className="card natal fade" aria-label="Natal">
    <div className="kv"><b><span className="natal-e" aria-hidden="true">🎄</span> Natal <span className="dim small" style={{ fontWeight: 400 }}>{yr}</span></b><span className="num natal-t">{eur(s.total)}</span></div>
    {s.count === 0 ? <p className="dim small">Ainda sem compras de Natal. Ao lançar, escolhe «🎄 Natal» — conta no acerto como as outras despesas.</p> : <>
      <div className="dim small">{s.count} compra{s.count > 1 ? 's' : ''} · set.–jan.</div>
      <div className="natal-sp" role="img" aria-label={`Conjunta ${eur(s.shared)}, pessoal ${eur(s.personal)}`}><i className="sh" style={{ flex: s.shared || 0 }} /><i className="pe" style={{ flex: s.personal || 0 }} /></div>
      <ul className="natal-l">
        <li><i className="dotc sh" />conjunta 50/50<span className="num">{eur(s.shared)}</span><small className="dim">{pctShared}%</small></li>
        <li><i className="dotc pe" />pessoal<span className="num">{eur(s.personal)}</span><small className="dim">{100 - pctShared}%</small></li>
      </ul>
      <div className="natal-w">{who.map(({ m, v }) => <div key={m.id} className={'natal-p pay-' + payerTone(members, m.id)}><span className="small dim">pagou {m.display_name}</span><b className="num">{eur(v)}</b></div>)}</div>
    </>}
    {edit ? <div className="natal-ed">
      <label className="fld"><span>orçamento de Natal (€) · vazio = sem orçamento</span><input className="num" inputMode="decimal" autoFocus value={v} placeholder="ex.: 400" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} /></label>
      <div className="row"><button className="pri" disabled={busy || !online} onClick={submit}>{busy ? 'A guardar…' : 'Guardar'}</button>
        {s.budget != null && <button disabled={busy || !online} onClick={() => save(null)}>Sem orçamento</button>}
        <button className="link" onClick={() => { setEdit(false); setErr(''); }}>Cancelar</button></div>
      {err && <p className="err small" role="alert">{err}</p>}
    </div>
    : s.budget != null ? <button className="natal-b" disabled={!online} onClick={() => { setV(centsToInput(s.budget!)); setEdit(true); }} aria-label="Alterar orçamento de Natal">
      <div className="kv small"><span>{eur(s.total)} de {eur(s.budget)}</span><span className={'num ' + (over ? 'bad' : s.ratio! >= 0.8 ? 'warn' : 'ok')}>{over ? `+${eur(-s.left!)} acima` : `sobram ${eur(s.left!)}`}</span></div>
      <div className="bar"><i className={over ? 'over' : s.ratio! >= 0.8 ? 'warn' : ''} style={{ width: Math.min(100, Math.round(s.ratio! * 100)) + '%' }} /></div>
    </button>
    : <button className="link small" disabled={!online} onClick={() => { setV(''); setEdit(true); }}>+ definir orçamento (opcional)</button>}
  </section>;
}
