import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './style.css';
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').then((r) => r.update()).catch(() => {}));
  // Nova versão do service worker assumiu o controlo: recarregar uma única vez para não misturar versões.
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) reloadOnce('sw-' + Date.now().toString().slice(0, -5)); });
}

// Android: se o WebAPK ignorou display=fullscreen, pede ecrã inteiro no primeiro toque (Fullscreen API).
if (/android/i.test(navigator.userAgent) && document.documentElement.requestFullscreen && localStorage.getItem('fs-autofs') !== 'off') {
  const go = () => {
    if (!document.fullscreenElement && !matchMedia('(display-mode: fullscreen)').matches)
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  };
  document.addEventListener('pointerup', go, { capture: true });
}

// Instalar app (Android/Chrome): guarda o pedido para o botão em ⚙.
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global { interface Window { __bip?: BIP | null } }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__bip = e as BIP; window.dispatchEvent(new Event('fs-bip')); });
window.addEventListener('appinstalled', () => { window.__bip = null; window.dispatchEvent(new Event('fs-bip')); });

if (new URLSearchParams(location.search).get('source') === 'pwa') sessionStorage.setItem('fs-pwa', '1');

// Sem zoom: o CSS (touch-action: pan-x pan-y) já impede pinça e duplo toque sem bloquear o scroll.
// Só o iOS precisa de gesturestart; nada de touchmove não-passivo (tornava o scroll pesado).
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

// Ficheiro do build antigo em falta (cache desatualizada): recarregar uma vez.
const reloadOnce = (why: string) => { if (sessionStorage.getItem('fs-reloaded') === why) return; sessionStorage.setItem('fs-reloaded', why); location.reload(); };
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadOnce('chunk'); });
window.addEventListener('error', (e) => { if (/Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(String(e.message))) reloadOnce('chunk'); });
