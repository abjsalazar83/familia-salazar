// Service worker: pré-guarda a "casca" da app (HTML, JS, CSS, ícones) para abrir sem rede.
// Nunca guarda pedidos ao Supabase: os dados offline vivem em IndexedDB, geridos pela app.
const VERSION = 'fs-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-180.png', './icon-512.png', './icon-maskable-512.png', './favicon.ico', './favicon-32.png', './sc-despesa.png', './sc-compras.png', './sc-saldo.png', './sc-historico.png'];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // Pré-guardar também os ficheiros com hash referidos pelo index.html (JS/CSS do build).
    const html = await (await fetch('./index.html', { cache: 'no-cache' })).text();
    const assets = [...html.matchAll(/(?:src|href)="(\.?\/?[^"]*assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href);
    await c.addAll(assets);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', (e) => { if (e.data === 'version') e.ports[0]?.postMessage(VERSION); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Supabase e outros: sempre rede
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  if (url.pathname.endsWith('.webmanifest')) { // manifesto: rede primeiro, para o Android ver alterações
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r;
  })));
});
