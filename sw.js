// Service worker da Família.
// Estratégias: Cache First para ficheiros com hash (assets/) e OCR (tess/); Stale-While-Revalidate para ícones/imagens/fontes;
// Network First (3 s) para leituras REST do Supabase, com cópia de recurso; navegação: rede → index guardado → offline.html.
// Nunca guarda auth, storage (talões), realtime nem nada que não seja GET.
const VERSION = 'fs-v27';
const TESS = 'fs-tess-2'; // leitor de talões: grande, guardado à parte para não voltar a descarregar a cada versão
const API = 'fs-api-1';   // últimas leituras do Supabase (apagadas ao terminar sessão)
const SB = 'luumtyvsssazlexsqudk.supabase.co';
const SHELL = ['./', './index.html', './offline.html', './manifest.webmanifest', './icon-192.png', './icon-192.webp', './icon-192.avif', './icon-180.png', './icon-512.png', './icon-maskable-512.png', './favicon.ico', './favicon-32.png', './sc-despesa.png', './sc-compras.png', './sc-saldo.png', './sc-historico.png'];
const KEEP = [VERSION, TESS, API];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // Um ficheiro em falta nunca pode estragar a instalação: cada um é guardado à parte e as falhas ignoradas.
    const add = (urls) => Promise.all(urls.map((u) => c.add(new Request(u, { cache: 'no-cache' })).catch(() => {})));
    await add(SHELL);
    try {
      const html = await (await fetch('./index.html', { cache: 'no-cache' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\.?\/?[^"]*assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href);
      await add(assets);
      const all = await fetch('./precache.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => []);
      await add(all.map((f) => new URL(f, self.registration.scope).href).filter((u) => !assets.includes(u)));
    } catch { /* sem rede: instala na mesma, os ficheiros vêm da rede quando pedidos */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => { e.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
  if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
  await self.clients.claim();
})()); });
self.addEventListener('message', (e) => {
  if (e.data === 'version') e.ports[0]?.postMessage(VERSION);
  if (e.data === 'logout') e.waitUntil(caches.delete(API));
});

const put = (name, req, res) => { if (res.ok && res.type !== 'opaque') { const cp = res.clone(); caches.open(name).then((c) => c.put(req, cp)); } return res; };
const cacheFirst = (name) => (req) => caches.open(name).then((c) => c.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((r) => put(name, req, r))));
const swr = (req, ev) => caches.match(req, { ignoreVary: true }).then((hit) => {
  const net = fetch(req).then((r) => put(VERSION, req, r));
  if (hit) { ev.waitUntil(net.catch(() => {})); return hit; }
  return net;
});
const networkFirst = (req, ms) => new Promise((resolve, reject) => {
  let done = false;
  const fallback = () => caches.open(API).then((c) => c.match(req)).then((hit) => { if (!done && hit) { done = true; resolve(hit); } return hit; });
  const t = setTimeout(fallback, ms);
  fetch(req).then((r) => { clearTimeout(t); put(API, req, r); if (!done) { done = true; resolve(r); } })
    .catch((err) => { clearTimeout(t); fallback().then((hit) => { if (!hit && !done) reject(err); }); });
});

self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET') return; // escritas: sempre rede (a app põe-nas em fila se falharem)
  if (url.host === SB) {
    if (url.pathname.startsWith('/rest/v1/') && !req.headers.has('range')) e.respondWith(networkFirst(req, 3000));
    return; // auth, storage, realtime: nunca em cache
  }
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const r = (await e.preloadResponse) || await fetch(req); return put(VERSION, './index.html', r); }
      catch { return (await caches.match('./index.html')) || (await caches.match('./offline.html')); }
    })());
    return;
  }
  if (url.pathname.endsWith('.webmanifest')) { // manifesto: rede primeiro, para o Android ver alterações
    e.respondWith(fetch(req).then((r) => put(VERSION, req, r)).catch(() => caches.match(req)));
    return;
  }
  if (url.pathname.includes('/tess/')) return e.respondWith(cacheFirst(TESS)(req));
  if (url.pathname.includes('/assets/')) return e.respondWith(cacheFirst(VERSION)(req)); // nomes com hash: imutáveis
  if (/\.(png|webp|avif|ico|svg|woff2?)$/.test(url.pathname)) return e.respondWith(swr(req, e));
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => put(VERSION, req, r))));
});
// Toque num aviso de pagamento: abre/foca a app no separador contas.
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { for (const c of cs) { if ('focus' in c) { c.navigate?.(url); return c.focus(); } } return self.clients.openWindow(url); }));
});
