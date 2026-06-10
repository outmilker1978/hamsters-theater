self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  })());
});
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
