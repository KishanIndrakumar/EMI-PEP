/**
 * PEPguide.ie — Service Worker v2026.2
 *
 * Safe single-file PWA strategy:
 * - Cache ONLY index.html — the one file the app needs
 * - Never pre-cache icons, manifest, or other assets
 * - Graceful catch on everything — a failure NEVER breaks the site
 * - No auto skipWaiting — user controls update via toast
 * - Stale-while-revalidate: serve cached index.html instantly,
 *   update cache in background for next visit
 */

const CACHE = 'pepguide-v2026.10';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.add('/'))
      .catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();

        caches.open(CACHE).then(cache => {
          cache.put('/', copy);
        });

        return response;
      })
      .catch(() => {
        return caches.match('/').then(cached => {
          return cached || new Response(
            'Offline. Please reconnect and reload.',
            { headers: { 'Content-Type': 'text/plain' } }
          );
        });
      })
  );
});
