import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js'));
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

// Sem zoom: bloquear pinça (iOS gesture*, Android multi-toque) e duplo toque.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || ((e as unknown as { scale?: number }).scale ?? 1) !== 1) e.preventDefault(); }, { passive: false });
let lastTouch = 0;
document.addEventListener('touchend', (e) => { const t = Date.now(); if (t - lastTouch < 300 && !(e.target as HTMLElement).closest('input,textarea,select')) e.preventDefault(); lastTouch = t; }, { passive: false });
