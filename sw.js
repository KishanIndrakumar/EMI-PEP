/**
 * PEPguide.ie — Service Worker
 * Version: v2026.1  |  Updated: June 2026
 *
 * Strategy: Cache-first for all app assets (single-file app).
 * On activate: delete old caches so stale clinical content never persists.
 * Update toast in index.html triggers SKIP_WAITING on user confirmation.
 */

const CACHE_NAME    = 'pepguide-v2026.1';
const OFFLINE_URLS  = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Install: pre-cache all critical assets ───────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  // Do NOT self.skipWaiting() here — let the update toast in the
  // main app control when the new SW activates (avoids mid-session disruption).
});

// ── Activate: clean up old cache versions ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[PEPguide SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, network fallback ─────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin or relative URLs
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Don't intercept external requests (e.g. CDN scripts)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache for next time
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, toCache);
        });
        return response;
      });
    }).catch(() => {
      // Offline fallback — return cached index.html for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});

// ── Message: handle SKIP_WAITING from update toast ───────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
