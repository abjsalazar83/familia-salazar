import { useEffect, useState } from 'react';
import { shouldShowInstall } from './lib/install';
import { displayMode } from './App';

const K = 'fs-install';
const read = () => { try { return { visits: 0, saved: false, dismissedAt: null, ...JSON.parse(localStorage.getItem(K) || '{}') }; } catch { return { visits: 0, saved: false, dismissedAt: null }; } };
const write = (p: object) => localStorage.setItem(K, JSON.stringify({ ...read(), ...p }));
export const countVisit = () => { if (!sessionStorage.getItem(K)) { sessionStorage.setItem(K, '1'); write({ visits: read().visits + 1 }); } };
export const markSaved = () => { if (!read().saved) { write({ saved: true }); window.dispatchEvent(new Event('fs-bip')); } };

/** Folha pequena em baixo, por cima da barra de separadores; não bloqueia o ecrã. */
export default function InstallSheet({ editing }: { editing: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); window.addEventListener('fs-bip', f); return () => window.removeEventListener('fs-bip', f); }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const show = shouldShowInstall(read(), { now: Date.now(), installed: displayMode() !== 'browser', editing, canPrompt: !!window.__bip, ios });
  if (!show) return null;
  const close = () => { write({ dismissedAt: Date.now() }); tick((n) => n + 1); };
  const go = async () => { const e = window.__bip; if (!e) return; await e.prompt(); const r = await e.userChoice.catch(() => null); window.__bip = null; if (r?.outcome !== 'accepted') close(); else tick((n) => n + 1); };
  return (
    <div className="isheet" role="dialog" aria-label="Instalar app">
      <picture><source srcSet="./icon-192.avif" type="image/avif" /><source srcSet="./icon-192.webp" type="image/webp" /><img src="./icon-192.png" alt="" width="40" height="40" loading="lazy" decoding="async" /></picture>
      <div className="grow"><b>Instalar a Família</b><div className="dim small">{ios && !window.__bip ? 'Partilhar ⎋ → Adicionar ao ecrã principal' : 'abre mais rápido e funciona sem rede'}</div></div>
      {!ios || window.__bip ? <button className="pri" onClick={go}>Instalar</button> : null}
      <button className="x" aria-label="Agora não" onClick={close}>×</button>
    </div>
  );
}
