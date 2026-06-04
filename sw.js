// ============================================================
// PEPguide Service Worker
// ── Update this version string on EVERY deployment ──────────
// This is the only value you need to change to force all
// clients to pick up the new version.
// ============================================================
const CACHE_VERSION = 'pepguide-cache-v1.0.0';
const CACHE_VERSION_KEY = 'pepguide-sw-version';

// Static assets to pre-cache on install.
// Only app shell files — no patient data is ever cached.
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install ───────────────────────────────────────────────────
// Pre-cache all static assets. skipWaiting() means this SW
// activates immediately without waiting for tabs to close.
self.addEventListener('install', event => {
  console.log(`[SW] Installing ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        console.log(`[SW] Pre-cache complete for ${CACHE_VERSION}`);
        // Take control immediately — don't wait for old SW to finish
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] Pre-cache failed:', err))
  );
});

// ── Activate ──────────────────────────────────────────────────
// Delete all caches that don't match the current version.
// clients.claim() means this SW takes control of all open tabs
// immediately — they get new responses without a reload.
self.addEventListener('activate', event => {
  console.log(`[SW] Activating ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
      ))
      .then(() => {
        console.log('[SW] Old caches cleared');
        // Take control of all open clients without requiring reload
        return self.clients.claim();
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────
// Strategy: Network-first for HTML (always fresh), Cache-first
// for other static assets (icons, manifest).
//
// Network-first for index.html ensures that after a deployment,
// the first successful network fetch writes the new HTML to
// cache. If offline, the cached version is served.
//
// Privacy: only app shell files are ever stored. No request
// URLs containing patient data (none expected — app is
// entirely client-side) would reach this handler, but we
// explicitly skip non-GET and cross-origin requests to
// guarantee nothing unexpected is stored.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests on the same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Google Fonts — network only, never cache (avoids
  // cross-origin cache complications and keeps font loading
  // behaviour under browser control)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    return;
  }

  // HTML navigation requests: network-first
  // On success: update cache. On failure: serve cached HTML.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Only cache valid 200 responses
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Static assets (icons, manifest): cache-first
  // Network fallback updates the cache if the asset is found.
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
  );
});

// ── Message handler ───────────────────────────────────────────
// Allows the page to ask the SW to skip waiting (used by the
// update notification banner to trigger immediate activation).
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received — activating now');
    self.skipWaiting();
  }
});
