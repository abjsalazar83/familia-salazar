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
