/**
 * PEPguide.ie — Service Worker
 * Version: v2026.1  |  Updated: June 2026
 *
 * Strategy: Cache-first for all app assets (single-file app).
 * start_url is "/" — handles both "/" and "/index.html" correctly.
 */

const CACHE_NAME   = 'pepguide-v2026.1';
const SHELL_URLS   = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: pre-cache all critical assets ───────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  );
  // Do NOT self.skipWaiting() — let the update toast control activation
});

// ── Activate: wipe old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[PEPguide SW] Removing old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, network fallback ─────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Treat "/" and "/index.html" as the same cache entry
  const cacheKey = (url.pathname === '/' || url.pathname === '/index.html')
    ? new Request('/index.html')
    : event.request;

  event.respondWith(
    caches.match(cacheKey).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, toCache));
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// ── Message: SKIP_WAITING from update toast ──────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
