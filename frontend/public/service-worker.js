// Skopo PWA — minimal service worker v1
// Strategy:
//   - App shell: cache-first (fast repeat loads, offline boot)
//   - API calls (/api/*): network-first (never serve stale user data)
//   - Everything else: network-first with cache fallback

const CACHE_NAME = 'skopo-shell-v1';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API calls — always hit the network so user data stays fresh.
  if (url.pathname.startsWith('/api/')) {
    return; // let the browser handle it normally
  }

  // For navigation requests (HTML pages) → network-first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/') || caches.match(req))
    );
    return;
  }

  // For same-origin static assets → cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200 && resp.type === 'basic') {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return resp;
          })
          .catch(() => cached);
      })
    );
  }
});
