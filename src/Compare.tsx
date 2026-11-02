// Mercadona × Lidl: duas «fichas» por item (preço, base, fonte e data; «—» se não há) e o editor no detalhe.
import { useState } from 'react';
import { CHAINS, CHAIN_NAME, srcLabel, type Chain, type PBase, type Quote } from './lib/compare';
import type { WebPrice } from './lib/webprice';
import { eur, parseCents } from './lib/money';
import { IcStore, IcTag, IcGlobe, IcReceipt } from './Icons';

const dm = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + (d.slice(0, 4) !== String(new Date().getFullYear()) ? '/' + d.slice(2, 4) : '') : '');
const SrcIc = ({ q }: { q: Quote }) => q.source === 'talão' ? <IcReceipt /> : q.source === 'manual' ? <IcTag size={12} /> : <IcGlobe size={12} />;

export function Compare({ q, win }: { q: Record<Chain, Quote | null>; win: Chain | 'igual' | null }) {
  return <span className="cmp" role="group" aria-label="Mercadona e Lidl">
    {CHAINS.map((c) => { const x = q[c];
      return <span key={c} className={'cmp-c ch-' + c + (win === c ? ' win' : '')}
        aria-label={`${CHAIN_NAME[c]}: ${x ? `${eur(x.cents)}${x.base ? ' por ' + x.base : ''}, ${srcLabel(x)}${x.at ? ', ' + dm(x.at) : ''}` : 'sem preço'}${win === c ? ', mais barato' : ''}`}>
        <span className="cmp-n">{c === 'mercadona' ? 'M' : 'L'}</span>
        {x ? <><b className="num">{eur(x.cents)}{x.base && <small>/{x.base}</small>}</b><span className="cmp-s" title={srcLabel(x) + (x.name ? ' · ' + x.name : '')}><SrcIc q={x} />{x.auto ? '?' : ''} {dm(x.at)}</span></> : <b className="dim">—</b>}
        {win === c && <span className="cmp-w" aria-hidden="true">mais barato</span>}
      </span>; })}
  </span>;
}

export function CompareEdit({ q, web, onSave }: { q: Record<Chain, Quote | null>; web: Record<Chain, WebPrice[]>; onSave: (c: Chain, cents: number, base: PBase | null, w?: WebPrice) => void }) {
  const [v, setV] = useState<Record<Chain, string>>({ mercadona: '', lidl: '' });
  const [b, setB] = useState<Record<Chain, PBase | ''>>({ mercadona: 'kg', lidl: 'kg' });
  return <div className="cmp-ed">
    {CHAINS.map((c) => { const x = q[c]; const cents = parseCents(v[c]);
      return <div key={c} className={'cmp-r ch-' + c}>
        <div className="cmp-h"><IcStore /> <b>{CHAIN_NAME[c]}</b> <span className="muted small">{x ? `${eur(x.cents)}${x.base ? '/' + x.base : ''} · ${srcLabel(x)}${x.at ? ' · ' + dm(x.at) : ''}${x.name ? ' · ' + x.name : ''}` : '— sem preço'}</span></div>
        <div className="row cmp-in">
          <input inputMode="decimal" placeholder="preço na prateleira" aria-label={`Preço na prateleira ${CHAIN_NAME[c]}`} value={v[c]} onChange={(e) => setV({ ...v, [c]: e.target.value })} />
          <select aria-label={`Base do preço ${CHAIN_NAME[c]}`} value={b[c]} onChange={(e) => setB({ ...b, [c]: e.target.value as PBase | '' })}><option value="kg">€/kg</option><option value="L">€/L</option><option value="un">€/un</option><option value="">embalagem</option></select>
          <button className="act" disabled={cents == null || cents <= 0} aria-label={`Guardar preço ${CHAIN_NAME[c]}`} onClick={() => { if (cents && cents > 0) { onSave(c, cents, b[c] || null); setV({ ...v, [c]: '' }); } }}><IcTag /> Guardar</button>
        </div>
        {web[c].length > 0 && <div className="cmp-web">{web[c].map((w) => <button key={w.id} className="chip" onClick={() => onSave(c, w.unit_price_cents ?? w.price_cents, w.unit_price_cents != null ? w.base : null, w)} title={`${w.store ?? ''} ${w.city ?? ''}`}>
          <IcGlobe /> {w.name} · {eur(w.unit_price_cents ?? w.price_cents)}{w.unit_price_cents != null && w.base ? '/' + w.base : ''} · {dm(w.seen_on ?? '')}</button>)}</div>}
      </div>; })}
    <p className="muted small">Preços: talão da família, prateleira (escrito por vós) ou Open Prices (Portugal, «?» = correspondência automática). Sem fonte → «—».</p>
  </div>;
}
