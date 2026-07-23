// Minimal service worker: caches the app shell so it opens instantly and
// works offline. Your data itself lives in IndexedDB/localStorage, which
// already work offline on their own — this just caches the app's files.

const CACHE_NAME = 'vp-expense-manager-v2';
// Files that change often (the app itself) use NETWORK-FIRST: always try to
// fetch the latest version when online, and only fall back to the cached
// copy if you're offline. This means future updates reach your phone
// automatically — no need to bump a version number by hand each time.
const NETWORK_FIRST = ['./index.html', './manifest.json', './'];

// Icons rarely change, so they stay CACHE-FIRST for instant loading.
const CACHE_FIRST = ['./icon-192.png', './icon-512.png', './icon-maskable-512.png'];

const APP_SHELL = [...NETWORK_FIRST, ...CACHE_FIRST];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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

function isNetworkFirst(url) {
  return NETWORK_FIRST.some((p) => url.endsWith(p.replace('./', '')) || url.endsWith('/'));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let CDN requests (jsPDF) go straight to network

  if (isNetworkFirst(url.pathname)) {
    // Network-first: get the freshest app code when online, cache it for
    // offline use, and only serve the stale cached copy if the network fails.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for rarely-changing assets like icons.
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
