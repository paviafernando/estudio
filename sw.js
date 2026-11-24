// Estudio Mágico sin internet: guarda todo (no usa librerías de afuera).
const C = 'estudio-v1';
const CORE = ['/', '/css/estudio.css', '/js/app.js', '/js/audio.js', '/js/music.js', '/js/roll.js', '/js/staff.js', '/js/instruments.js', '/manifest.webmanifest', '/icon.svg'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))); });
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== C) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (u.origin !== location.origin) return;
  const key = req.mode === 'navigate' ? '/' : req;
  e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(C).then((c) => c.put(key, cp)); } return r; })
    .catch(async () => (await caches.match(key, { ignoreSearch: true })) || Response.error()));
});
