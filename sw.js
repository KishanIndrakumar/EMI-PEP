// PEPguide.ie PWA — Service Worker
// Covers: BBV PEP (HIV/HBV/Tetanus), Rabies PET, Tetanus Wound Assessment
// Cache version: bump this string whenever index.html is deployed to force
// all installed PWAs to fetch fresh files on next load.

const CACHE_NAME = 'pepguide-v2025-1';

const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── Install: pre-cache app shell ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // Activate immediately — don't wait for existing tabs to close
  self.skipWaiting();
});

// ── Activate: delete all old caches ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for HTML, cache-first for assets ─────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Navigation / HTML: network-first so users always get the latest app
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve cached index.html
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Static assets (icons, manifest): cache-first, update in background
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {});

      return cached || networkFetch;
    })
  );
});
