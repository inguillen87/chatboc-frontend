// public/sw.js

const CACHE_NAME = 'chatboc-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  // Add other assets that need to be cached
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Ignore non-HTTP/HTTPS requests (e.g., chrome-extension://) and non-GET calls
  // so POST/PUT requests (like token mints) always hit the network directly.
  if (!request.url.startsWith('http') || request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Strategy: Network-first for navigation, Cache-first for others.
  if (request.mode === 'navigate') {
    // Let the browser handle iframe navigations so the widget always hits the network
    if (url.pathname.startsWith('/iframe')) {
      return;
    }

    event.respondWith(
      fetch(request)
        .then(response => {
          // If the fetch is successful, cache the response for offline use.
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // JavaScript and CSS power both the main app and the embeddable widget.
  // Serve them network-first so updates are not blocked by a stale cache.
  const isCodeAsset = ['script', 'style', 'worker'].includes(request.destination);

  if (isCodeAsset) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(async err => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          throw err;
        })
    );
    return;
  }

  // For non-code assets (images, JSON, etc.), use the existing cache-first strategy.
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        return response;
      }

      return fetch(request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

self.addEventListener('activate', event => {
  self.clients.claim();
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
