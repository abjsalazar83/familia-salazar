// Compras: lista partilhada por secções, sugestões da família, quantidades, voz, básicos, preços habituais e «Fechar compra → lançar despesa». Toque marca, deslizar retira.
import { useMemo, useRef, useState } from 'react';
import type { Ctx } from './App';
import { ExpenseForm } from './App';
import type { Item, Unit } from './lib/types';
import { supabase } from './lib/supabase';
import { uuid } from './lib/outbox';
import { payerTone } from './lib/view';
import { eur, parseCents, centsToInput } from './lib/money';
import { SECTIONS, UNITS, classify, keyOf, suggest, step, qtyText, parseList, estimate, matchReceiptLines, type Pref } from './lib/shop';
import { VoiceButton, voiceSupported } from './Voice';
import { ReceiptButton, type ReceiptResult } from './Receipt';
import { IcPlus } from './Icons';
import type { VoiceGuess } from './lib/voice';

export default function Shopping(ctx: Ctx & { checkout?: boolean }) {
  const { data, mutate, state } = ctx; const me = data.me!;
  const prefs = data.prefs ?? [];
  const pm = useMemo(() => Object.fromEntries(prefs.map((p) => [p.key, p])) as Record<string, Pref>, [prefs]);
  const learned = useMemo(() => Object.fromEntries(prefs.map((p) => [p.key, p.section])), [prefs]);
  const live = data.items.filter((i) => !i.archived_at);
  const todo = live.filter((i) => !i.bought); const cart = live.filter((i) => i.bought);
  const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false); const [done, setDone] = useState<'' | 'total' | 'form'>(ctx.checkout ? 'total' : '');
  const [total, setTotal] = useState(''); const [rc, setRc] = useState<ReceiptResult | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const inList = useMemo(() => new Set(live.map((i) => keyOf(i.name))), [live]);
  const sugg = suggest(prefs, q, inList);
  const secOf = (i: Item) => i.section ?? classify(i.name, learned);
  const groups = SECTIONS.map((s) => ({ s, items: todo.filter((i) => secOf(i) === s).sort((a, b) => a.name.localeCompare(b.name, 'pt')) })).filter((g) => g.items.length);
  const prices = useMemo(() => Object.fromEntries(prefs.map((p) => [p.key, p.last_price_cents])), [prefs]);
  const est = estimate(todo.concat(cart), prices);
  const missingBasics = prefs.filter((p) => p.basic && !inList.has(p.key));
  const who = (i: Item) => data.members.find((m) => m.user_id === i.created_by) ?? me;

  const savePref = async (name: string, patch: Partial<Pref> & { bump?: boolean }) => {
    const key = keyOf(name); const cur = pm[key]; const { bump, ...rest } = patch;
    await supabase.from('shopping_prefs').upsert({ family_id: me.family_id, key, name: cur?.name ?? name, section: cur?.section ?? null, basic: cur?.basic ?? false, unit: cur?.unit ?? null, last_price_cents: cur?.last_price_cents ?? null, uses: (cur?.uses ?? 0) + (bump ? 1 : 0), last_used: bump ? new Date().toISOString() : cur?.last_used ?? new Date().toISOString(), ...rest }, { onConflict: 'family_id,key' });
  };
  const add = async (raw0: string) => {
    const raw = raw0.replace(/^\s*\+\s*/, '');
    const list = raw.includes(',') || / e /i.test(raw) ? parseList(raw) : parseList(raw).slice(0, 1);
    if (!list.length) return;
    for (const x of list) {
      const key = keyOf(x.name); const p = pm[key];
      if (inList.has(key)) continue;
      const id = uuid();
      await mutate(`«${x.name}» na lista.`, 'shopping_items', 'create', id, { id, family_id: me.family_id, name: (p?.name ?? x.name).slice(0, 120), quantity: null, note: null, bought: false, qty: x.qty, unit: x.qty != null ? x.unit : p?.unit ?? null, section: p?.section ?? null, basic: p?.basic ?? false, created_by: me.user_id, created_at: new Date().toISOString() });
      savePref(x.name, { bump: true });
    }
    setQ('');
  };
  const patch = (i: Item, row: Partial<Item>, msg = '') => mutate(msg, 'shopping_items', 'patch', i.id, row);
  const toggle = (i: Item) => { if (!i.bought) { setPop(i.id); setTimeout(() => setPop(null), 450); } return patch(i, { bought: !i.bought }); };
  // Nunca apaga: arquiva (fica no histórico das sugestões).
  const archive = (i: Item) => patch(i, { archived_at: new Date().toISOString() }, `«${i.name}» saiu da lista.`);
  const repor = () => { add(missingBasics.map((p) => p.name).join(', ')); };
  const finish = (expenseId: string) => {
    const m = rc?.text ? matchReceiptLines(rc.text, cart.map((i) => i.name)) : {};
    const at = new Date().toISOString();
    for (const i of cart) {
      const pc = m[i.name] ?? i.price_cents ?? null;
      patch(i, { archived_at: at, expense_id: expenseId, ...(pc != null ? { price_cents: pc } : {}) });
      savePref(i.name, pc != null ? { last_price_cents: pc } : {});
    }
    setDone(''); setRc(null); setTotal('');
  };
  const guess: VoiceGuess | null = done === 'form' && !rc ? { total: parseCents(total), store: 'Supermercado', category: 'Supermercado', payer: 'me', personal: false, text: 'compras' } : null;

  return (
    <div className="shop">
      <form className="shop-add" onSubmit={(e) => { e.preventDefault(); add(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="+ leite, pão, ovos" aria-label="Adicionar à lista" maxLength={200} />
        {voiceSupported() && <VoiceButton label="" aria="Adicionar à lista por voz" hint="Diz, por exemplo: «leite, 2 pães e ovos»" onText={(t) => add(t)} />}
        <button className="act pri" type="submit" aria-label="Adicionar" disabled={!q.trim()}><IcPlus /></button>
      </form>
      <div className="shop-head slim fade">
        <span className="muted small">{todo.length} por comprar{cart.length ? ` · ${cart.length} comprados` : ''}{est.known ? <> · cesto <b className="num">≈ {eur(est.total)}</b></> : ''}{est.known && est.missing ? ` · ${est.missing} sem preço` : ''}</span>
        {missingBasics.length > 0 && <button className="act" onClick={repor}>Repor básicos ({missingBasics.length})</button>}
      </div>

      {sugg.length > 0 && <div className="chips fade">{sugg.map((p) => <button key={p.key} className="chip" onClick={() => add(p.name)}>{p.name}</button>)}</div>}

      {!todo.length && <p className="muted center empty">{cart.length ? 'Tudo comprado.' : 'A lista está vazia. Escreve, dita ou toca numa sugestão.'}</p>}
      {groups.map((g) => (
        <section key={g.s} className="sec">
          <h3 className="sec-h light">{g.s}<span>{g.items.length}</span></h3>
          {g.items.map((i) => <Row key={i.id} i={i} tone={payerTone(data.members, who(i).id)} by={who(i).display_name} pending={state[i.id]} pop={pop === i.id} open={open === i.id}
            price={i.price_cents ?? pm[keyOf(i.name)]?.last_price_cents ?? null} basic={!!(i.basic || pm[keyOf(i.name)]?.basic)}
            onOpen={() => setOpen(open === i.id ? null : i.id)} onCheck={() => toggle(i)} onRemove={() => archive(i)}
            onQty={(qty, unit) => patch(i, { qty, unit })}
            onSection={(s) => { patch(i, { section: s }); savePref(i.name, { section: s }); }}
            onBasic={(b) => { patch(i, { basic: b }); savePref(i.name, { basic: b }); }}
            onPrice={(c) => { patch(i, { price_cents: c }); savePref(i.name, { last_price_cents: c }); }} />)}
        </section>
      ))}

      {cart.length > 0 && <section className="sec cart">
        <button className="cart-line" aria-expanded={showCart} onClick={() => setShowCart(!showCart)}><span>✓ {cart.length} {cart.length === 1 ? 'comprado' : 'comprados'}</span><span className="dim small">{showCart ? 'esconder ▾' : 'ver ▸'}</span></button>
        {showCart && cart.map((i) => <Row key={i.id} i={i} tone={payerTone(data.members, who(i).id)} by={who(i).display_name} pending={state[i.id]} pop={false} open={open === i.id} price={i.price_cents ?? pm[keyOf(i.name)]?.last_price_cents ?? null} basic={!!(i.basic || pm[keyOf(i.name)]?.basic)}
          onOpen={() => setOpen(open === i.id ? null : i.id)} onCheck={() => toggle(i)} onRemove={() => archive(i)} onQty={(qty, unit) => patch(i, { qty, unit })}
          onSection={(s) => { patch(i, { section: s }); savePref(i.name, { section: s }); }} onBasic={(b) => { patch(i, { basic: b }); savePref(i.name, { basic: b }); }} onPrice={(c) => { patch(i, { price_cents: c }); savePref(i.name, { last_price_cents: c }); }} />)}
      </section>}
      {cart.length > 0 && !done && <div className="shop-foot"><button className="pri" onClick={() => setDone('total')}>Fechar compra → lançar despesa</button></div>}

      {done === 'total' && <div className="form sheet">
        <h3>Fechar compra</h3>
        <p className="muted small">Indica o total ou lê o talão. Depois confirmas a despesa partilhada — nada é gravado sem confirmares.</p>
        <label>Total pago<input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={est.known ? centsToInput(est.total) : '0,00'} /></label>
        <div className="acts">
          <ReceiptButton label="Ler talão" onResult={(r) => { setRc(r); setDone('form'); }} />
          <button className="act pri" disabled={!parseCents(total)} onClick={() => setDone('form')}>Continuar</button>
          <button className="act act-x" onClick={() => setDone('')}>Cancelar</button>
        </div>
      </div>}
      {done === 'form' && <ExpenseForm key={rc ? 'rc' : 't' + total} {...ctx} editing={null} receipt={rc} voice={guess} onSaved={finish} close={() => setDone('')} />}
    </div>
  );
}

type RowP = { i: Item; tone: 'pink' | 'blue'; by: string; pending?: string; pop: boolean; open: boolean; price: number | null; basic: boolean;
  onOpen: () => void; onCheck: () => void; onRemove: () => void; onQty: (q: number | null, u: Unit | null) => void; onSection: (s: string) => void; onBasic: (b: boolean) => void; onPrice: (c: number | null) => void };
function Row(p: RowP) {
  const { i } = p; const x0 = useRef<number | null>(null); const [dx, setDx] = useState(0); const dragged = useRef(false);
  const unit = (i.unit ?? 'un') as Unit;
  const end = () => { if (Math.abs(dx) > 8) dragged.current = true; if (dx > 72) p.onCheck(); else if (dx < -72) p.onRemove(); setDx(0); x0.current = null; };
  return (
    <div className={`it ${p.tone === 'pink' ? 'by-n' : 'by-a'}${i.bought ? ' got' : ''}${p.pop ? ' pop' : ''}${p.pending ? ' pend' : ''}`}>
      {dx !== 0 && <div className="it-bg"><span>{i.bought ? 'Voltar' : 'Comprado'}</span><span>Retirar</span></div>}
      <div className="it-fg" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest('.it-dots,input,select')) return; x0.current = e.clientX; }}
        onPointerMove={(e) => { if (x0.current != null) setDx(Math.max(-120, Math.min(120, e.clientX - x0.current))); }}
        onPointerUp={end} onPointerCancel={() => { setDx(0); x0.current = null; }}>
        <button className="it-tap row-btn" role="checkbox" aria-checked={i.bought} aria-label={`${i.name}: ${i.bought ? 'comprado — tocar para voltar à lista' : 'por comprar — tocar para marcar'}`} onClick={() => { if (dragged.current) { dragged.current = false; return; } p.onCheck(); }}>
          <span className="it-l"><span className="ck" aria-hidden="true"><svg viewBox="0 0 24 24" className="icn"><path d="M6 12.5l4 4 8-9" /></svg></span>
          <span className="it-txt"><span className="it-name">{i.name}{p.basic && <em className="tag">básico</em>}</span>
          <span className="muted small">{[qtyText(i.qty, i.unit), p.price != null ? '≈ ' + eur(p.price) : '', p.by].filter(Boolean).join(' · ')}</span></span></span>
        </button>
        <button className="it-dots" onClick={p.onOpen} aria-expanded={p.open} aria-label={`Detalhes de ${i.name}`}>⋯</button>
      </div>
      {p.open && <div className="it-more fade">
        <div className="stp2"><span className="muted small">Quantidade</span>
          <button aria-label="Menos" onClick={() => p.onQty(step(i.qty, unit, -1), i.unit ?? null)}>−</button>
          <span className="num">{qtyText(i.qty, i.unit) || '—'}</span>
          <button aria-label="Mais" onClick={() => p.onQty(step(i.qty, unit, 1), unit)}>+</button></div>
        <div className="seg">{UNITS.map((u) => <button key={u} className={unit === u ? 'pri' : ''} onClick={() => p.onQty(i.qty ?? (u === 'g' ? 500 : 1), u)}>{u}</button>)}</div>
        <div className="row">
          <select aria-label="Secção" value={i.section ?? classify(i.name)} onChange={(e) => p.onSection(e.target.value)}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select>
          <input aria-label="Preço habitual" inputMode="decimal" placeholder="Preço €" defaultValue={p.price != null ? centsToInput(p.price) : ''} onBlur={(e) => { const c = e.target.value.trim() ? parseCents(e.target.value) : null; if (c !== p.price) p.onPrice(c); }} style={{ width: 96 }} />
        </div>
        <div className="row between">
          <label className="inline"><input type="checkbox" checked={p.basic} onChange={(e) => p.onBasic(e.target.checked)} /> Básico (repor sempre)</label>
          <button className="act" onClick={p.onRemove}>Retirar</button>
        </div>
      </div>}
    </div>
  );
}
