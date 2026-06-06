/**
 * PEPguide.ie — Service Worker v2026.2
 *
 * Safe strategy for a single-file clinical app:
 * - Pre-cache only index.html on install (the only file needed for the app to work)
 * - Don't skipWaiting automatically — let the update toast control activation
 * - Fail gracefully — a cache error never breaks the site
 */

const CACHE_NAME = 'pepguide-v2026.2';

// ── Install: cache only index.html ───────────────────────────
// Only one file to cache — if it fails, catch it gracefully so
// the SW still installs and the site keeps working online.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add('/index.html'))
      .catch(err => console.warn('[PEPguide SW] Pre-cache failed (non-fatal):', err))
    // No self.skipWaiting() — new SW waits until user taps "Refresh" on the toast
  );
});

// ── Activate: delete old caches, claim clients ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for index.html, network-first for rest ─
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate' ||
    url.pathname === '/' || url.pathname === '/index.html';

  if (isNavigation) {
    // Cache-first for the app shell — serves instantly offline
    event.respondWith(
      caches.match('/index.html').then(cached => {
        // Always try to update the cache in the background
        const networkFetch = fetch('/index.html').then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', response.clone()));
          }
          return response;
        }).catch(() => null);
        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch;
      })
    );
  }
  // All other requests (fonts, external scripts etc): network only, no interception
});

// ── Message: SKIP_WAITING triggered by "Refresh" toast ───────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
