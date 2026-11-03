// Receitas: sugestão de hoje (almoço/jantar), doses da família, marmitas, calorias (≈) e ingredientes para a lista.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import { RECIPES, TAGS, byId, doses, DEFAULT_FAMILY, hasTag, macros, mergeIntoList, qtyLabel, rank, scaled, type Cooked, type Family, type Slot } from './lib/recipes';
import { norm } from './lib/shop';
import { uuid } from './lib/outbox';
import type { Ctx } from './App';
import type { Recipe } from './data/recipes';
import { IcBack, IcBox, IcCart, IcCheck, IcClock, IcFlame, IcMinus, IcMoon, IcPlus, IcRefill, IcSun, IcUsers, IcCalendar } from './Icons';

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const LS = 'fs-receitas';
const load = () => { try { return { fam: DEFAULT_FAMILY, ...JSON.parse(localStorage.getItem(LS) || '{}') } as { fam: Family; night?: boolean; marm?: number }; } catch { return { fam: DEFAULT_FAMILY }; } };
const half = (n: number) => String(n).replace('.', ',');

export default function Receitas({ data, mutate, run, setToast, online, demoHist }: Ctx & { demoHist?: Cooked[] }) {
  const [st, setSt] = useState(load);
  useEffect(() => { localStorage.setItem(LS, JSON.stringify(st)); }, [st]);
  const [hist, setHist] = useState<Cooked[]>(demoHist ?? []);
  const fid = data.family?.id;
  const today = iso(new Date()), tomorrow = iso(new Date(Date.now() + 864e5));
  const reload = async () => {
    if (!fid || demoHist) return;
    const since = iso(new Date(Date.now() - 14 * 864e5));
    const { data: r } = await supabase.from('meal_log').select('recipe_id,on_date,kind,meal').eq('family_id', fid).gte('on_date', since).order('on_date', { ascending: false }).limit(300);
    if (r) setHist(r as Cooked[]);
  };
  useEffect(() => { reload(); }, [fid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [skip, setSkip] = useState<Record<Slot, string[]>>({ almoco: [], jantar: [] });
  const [open, setOpen] = useState<Recipe | null>(null);
  const [q, setQ] = useState(''); const [tag, setTag] = useState('');

  const planned = (d: string, m: Slot) => hist.find((h) => h.kind === 'plano' && h.on_date === d && h.meal === m)?.recipe_id;
  const pick = (slot: Slot, other?: string) => {
    const p = planned(today, slot); if (p && !skip[slot].includes(p)) return byId(p)!;
    const r = rank(today, hist, slot, slot === 'jantar' ? { light: st.night, marmita: (st.marm ?? 0) > 0 } : {}, [...skip[slot], ...(other ? [other] : [])]);
    return r[0];
  };
  const almoco = pick('almoco'); const jantar = pick('jantar', almoco?.id);
  const tmrBac = (['almoco', 'jantar'] as Slot[]).map((m) => byId(planned(tomorrow, m) ?? '')).find((r) => r?.t.includes('bacalhau'));

  const log = async (r: Recipe, meal: Slot, kind: 'cozinhei' | 'plano', on: string, d: number) => {
    if (!fid) return;
    const row = { id: uuid(), family_id: fid, recipe_id: r.id, meal, kind, on_date: on, doses: d };
    const ok = await run(kind === 'cozinhei' ? `«${r.n}» registada.` : `«${r.n}» planeada para amanhã.`, () => supabase.from('meal_log').insert(row));
    if (ok) setHist((h) => [row, ...h]);
  };
  const addToList = async (r: Recipe, d: number, pantry: boolean) => {
    const me = data.me; if (!me) return;
    const ops = mergeIntoList(scaled(r, d), data.items, pantry);
    let n = 0;
    for (const o of ops) {
      if (o.kind === 'create') { const id = uuid(); await mutate('', 'shopping_items', 'create', id, { id, family_id: me.family_id, name: o.name.slice(0, 120), quantity: null, note: null, bought: false, qty: o.qty, unit: o.unit, section: null, basic: false, created_by: me.user_id, created_at: new Date().toISOString() }); n++; }
      else if (o.kind === 'patch') { await mutate('', 'shopping_items', 'patch', o.id, { qty: o.qty, unit: o.unit }); n++; }
    }
    const sk = ops.filter((o) => o.kind === 'skip').length;
    setToast({ kind: 'ok', text: `${n} ingredientes na lista` + (sk ? ` · ${sk} já lá estavam` : '') + '.' });
    setTimeout(() => setToast(null), 2500);
  };

  const fam = st.fam; const base = doses(fam); const marm = st.marm ?? 0;
  const list = useMemo(() => { const n = norm(q); return RECIPES.filter((r) => (!tag || hasTag(r, tag)) && (!n || norm(r.n + ' ' + r.ing.map((i) => i[0]).join(' ')).includes(n))); }, [q, tag]);

  if (open) return <Detail r={open} back={() => setOpen(null)} d0={base + (open.id === jantar?.id ? marm : 0)} add={addToList} log={log} today={today} tomorrow={tomorrow} online={online} />;
  return (
    <section className="rc">
      {tmrBac && <div className="banner rc-warn" role="status"><span aria-hidden>🐟</span><span>Amanhã há <b>{tmrBac.n}</b> — põe o bacalhau de molho hoje.</span></div>}
      <h2 className="rc-h">Hoje</h2>
      <div className="rc-today">
        {([['almoco', 'Almoço', almoco, <IcSun />], ['jantar', 'Jantar', jantar, <IcMoon />]] as const).map(([slot, l, r, ic]) => r && (
          <div key={slot} className="rc-sug">
            <button className="row-btn rc-sug-b" onClick={() => setOpen(r)}>
              <span className="rc-ic" aria-hidden>{ic}</span>
              <span className="grow"><span className="small dim block">{l}{planned(today, slot) === r.id ? ' · planeado' : ''}</span><b className="rc-name">{r.n}</b><Meta r={r} /></span>
            </button>
            <button className="rc-other" aria-label={`Outra sugestão para o ${l.toLowerCase()}`} onClick={() => setSkip((s) => ({ ...s, [slot]: [...s[slot], r.id] }))}><IcRefill /><span>Outra</span></button>
          </div>))}
      </div>
      <div className="rc-opts">
        <button className={'rc-tog' + (st.night ? ' on' : '')} aria-pressed={!!st.night} onClick={() => setSt({ ...st, night: !st.night })}><IcMoon size={16} /><span>Noite da Ana · jantar leve</span></button>
        <div className="rc-step" role="group" aria-label="Marmitas de amanhã">
          <span className="rc-step-l"><IcBox size={16} /> Marmitas p/ amanhã</span>
          <button aria-label="Menos uma marmita" disabled={!marm} onClick={() => setSt({ ...st, marm: Math.max(0, marm - 1) })}><IcMinus /></button>
          <b className="num">{marm}</b>
          <button aria-label="Mais uma marmita" onClick={() => setSt({ ...st, marm: Math.min(6, marm + 1) })}><IcPlus /></button>
        </div>
        <FamilyEdit fam={fam} set={(f) => setSt({ ...st, fam: f })} base={base} />
      </div>
      <h2 className="rc-h">Livro de receitas <span className="dim small">{list.length}</span></h2>
      <input className="search" type="search" placeholder="Procurar receita ou ingrediente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar receitas" />
      <div className="rc-chips" role="toolbar" aria-label="Filtrar">
        {TAGS.map(([k, l]) => <button key={k} className={'rc-chip' + (tag === k ? ' on' : '')} aria-pressed={tag === k} onClick={() => setTag(tag === k ? '' : k)}>{l}</button>)}
      </div>
      <ul className="list rc-list">
        {list.map((r) => <li key={r.id} className="li"><button className="row-btn rc-row" onClick={() => setOpen(r)}><span className="grow"><span className="rc-name">{r.n}</span><Meta r={r} /></span></button></li>)}
        {!list.length && <li className="li dim">Nada encontrado.</li>}
      </ul>
      <p className="small dim rc-src">Calorias aproximadas por dose de adulto, calculadas com valores da Tabela da Composição de Alimentos (INSA). Variam com o azeite e o tamanho das doses.</p>
    </section>
  );
}

function Meta({ r }: { r: Recipe }) {
  const m = macros(r); const light = m.kcal <= 500;
  return <span className="rc-meta small"><span><IcFlame /> ≈ {m.kcal} kcal</span><span><IcClock /> {r.min} min</span>{r.t.includes('marmita') && <span title="Dá para marmita"><IcBox /> marmita</span>}{light && <span className="rc-badge">leve</span>}</span>;
}

function FamilyEdit({ fam, set, base }: { fam: Family; set: (f: Family) => void; base: number }) {
  const [o, setO] = useState(false);
  return <div className="rc-fam">
    <button className="row-btn rc-fam-b" aria-expanded={o} onClick={() => setO(!o)}><IcUsers size={16} /><span className="grow small">{fam.adults} adultos · {fam.kids} crianças a {half(fam.kidDose)} dose = <b>{half(base)} doses</b></span><span className="acc small">{o ? 'Fechar' : 'Mudar'}</span></button>
    {o && <div className="rc-fam-e">
      {([['Adultos', 'adults', 1], ['Crianças', 'kids', 1], ['Dose criança', 'kidDose', 0.1]] as const).map(([l, k, s]) => (
        <div key={k} className="rc-step"><span className="rc-step-l">{l}</span>
          <button aria-label={`Menos ${l}`} onClick={() => set({ ...fam, [k]: Math.max(k === 'kidDose' ? 0.2 : 0, Math.round((fam[k] - s) * 10) / 10) })}><IcMinus /></button>
          <b className="num">{half(fam[k])}</b>
          <button aria-label={`Mais ${l}`} onClick={() => set({ ...fam, [k]: Math.min(k === 'kidDose' ? 1 : 10, Math.round((fam[k] + s) * 10) / 10) })}><IcPlus /></button></div>))}
      <p className="small dim">Laura (5) e Olívia (3) contam como meia dose cada.</p>
    </div>}
  </div>;
}

function Detail({ r, back, d0, add, log, today, tomorrow, online }: { r: Recipe; back: () => void; d0: number; add: (r: Recipe, d: number, pantry: boolean) => void; log: (r: Recipe, m: Slot, k: 'cozinhei' | 'plano', on: string, d: number) => void; today: string; tomorrow: string; online: boolean }) {
  const [d, setD] = useState(d0); const [pantry, setPantry] = useState(false);
  const [meal, setMeal] = useState<Slot>(new Date().getHours() < 16 ? 'almoco' : 'jantar');
  const m = macros(r); const ing = scaled(r, d);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <section className="rc rc-det">
      <button className="rc-back" onClick={back}><IcBack /><span>Receitas</span></button>
      <h2 className="rc-title">{r.n}</h2>
      <div className="rc-tags">{r.t.map((t) => <span key={t} className="rc-tag">{TAGS.find(([k]) => k === t)?.[1]}</span>)}{r.epoca && <span className="rc-tag">época {r.epoca}</span>}</div>
      <div className="rc-kcal card">
        <div><b>≈ {m.kcal}</b><span className="small dim">kcal</span></div><div><b>{m.p} g</b><span className="small dim">proteína</span></div><div><b>{m.h} g</b><span className="small dim">hidratos</span></div><div><b>{m.g} g</b><span className="small dim">gordura</span></div>
      </div>
      <p className="small dim rc-c">Por dose de adulto · crianças ≈ metade · <IcClock /> {r.min} min</p>
      <div className="rc-step card" role="group" aria-label="Doses">
        <span className="rc-step-l"><IcUsers size={16} /> Doses</span>
        <button aria-label="Menos meia dose" disabled={d <= 0.5} onClick={() => setD(Math.max(0.5, d - 0.5))}><IcMinus /></button>
        <b className="num">{half(d)}</b>
        <button aria-label="Mais meia dose" onClick={() => setD(d + 0.5)}><IcPlus /></button>
      </div>
      <h3>Ingredientes</h3>
      <ul className="list rc-ing">{ing.map((i, k) => <li key={k} className="li"><span className="grow">{i.label}</span><span className="num dim">{qtyLabel(i.qty, i.unit)}</span></li>)}</ul>
      <label className="rc-check small"><input type="checkbox" checked={pantry} onChange={(e) => setPantry(e.target.checked)} /> Incluir despensa (azeite, alho, farinha…)</label>
      <button className="pri rc-wide" onClick={() => add(r, d, pantry)}><IcCart /> Adicionar ingredientes à lista</button>
      <h3>Preparação</h3>
      <ol className="rc-steps">{r.s.map((s, k) => <li key={k}>{s}</li>)}</ol>
      <h3>Registar</h3>
      <div className="seg">{(['almoco', 'jantar'] as Slot[]).map((x) => <button key={x} className={meal === x ? 'pri' : ''} onClick={() => setMeal(x)}>{x === 'almoco' ? 'Almoço' : 'Jantar'}</button>)}</div>
      <div className="rc-acts">
        <button disabled={!online} onClick={() => log(r, meal, 'cozinhei', today, d)}><IcCheck /> Cozinhei hoje</button>
        <button disabled={!online} onClick={() => log(r, meal, 'plano', tomorrow, d)}><IcCalendar /> Para amanhã</button>
      </div>
      {r.t.includes('bacalhau') && <p className="small dim">Se planeares para amanhã, hoje aparece o aviso para pôr o bacalhau de molho.</p>}
    </section>
  );
}
