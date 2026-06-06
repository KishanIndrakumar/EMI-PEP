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

const CACHE = 'pepguide-v2026.2';

// ── Install ──────────────────────────────────────────────────
// Cache index.html only. Catch any error so install always succeeds.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.add('/index.html'))
      .catch(() => { /* non-fatal — site still works online */ })
  );
  // Do NOT skipWaiting — let the toast control activation timing
});

// ── Activate ─────────────────────────────────────────────────
// Delete any old cache versions, then claim all open tabs.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});

// ── Fetch ─────────────────────────────────────────────────────
// Only intercept navigation requests (loading the app itself).
// All other requests (APIs, fonts, external scripts) pass through untouched.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin navigation (loading index.html)
  if (url.origin !== self.location.origin) return;
  if (event.request.mode !== 'navigate' &&
      url.pathname !== '/' &&
      url.pathname !== '/index.html') return;

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match('/index.html').then(cached => {
        // Fetch fresh copy in background and update cache
        const network = fetch('/index.html').then(response => {
          if (response && response.status === 200) {
            cache.put('/index.html', response.clone());
          }
          return response;
        }).catch(() => null);
        // Return cached immediately if we have it, else wait for network
        return cached || network;
      })
    ).catch(() => fetch(event.request))
  );
});

// ── Message ───────────────────────────────────────────────────
// Receive SKIP_WAITING from the update toast button in index.html
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
