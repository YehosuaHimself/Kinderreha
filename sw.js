/* Service Worker — Wissens-Hub Tagesbetreuung
   v1.7 — aggressive update: network-first für HTML, force-reload aller Clients beim Activate. */
const CACHE = 'wh-v2.1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'qr.js',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon.ico',
  'favicon-16.png',
  'favicon-32.png',
  'favicon-64.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>null)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* Nuke ALL old caches (anything not the current version) */
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    /* Take control of all clients immediately */
    await self.clients.claim();
    /* Force-reload all open windows so they get fresh HTML */
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) {
      try { c.navigate(c.url); } catch(_) {
        try { c.postMessage({ type: 'reload' }); } catch(_) {}
      }
    }
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    /* HTML: ALWAYS network, never cache — guarantees fresh gate logic. */
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const c = await caches.open(CACHE);
          c.put(req, fresh.clone());
        }
        return fresh;
      } catch (_) {
        const c = await caches.open(CACHE);
        const cached = await c.match(req, { ignoreSearch: true });
        return cached || c.match('index.html');
      }
    })());
    return;
  }

  /* Other assets: cache-first, refresh in background. */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const fetchPromise = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
