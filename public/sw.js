// public/sw.js

const CACHE_NAME = 'chatboc-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Add other assets that need to be cached
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Ignore non-HTTP/HTTPS requests (e.g., chrome-extension://)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Strategy: Network-first for navigation, Cache-first for others.

  // For navigation requests, go to the network first.
  // This ensures the user always gets the latest version of the page,
  // fixing the bug where the widget breaks on F5 refresh.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If the fetch is successful, cache the response for offline use.
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If the network fails, fall back to the cache.
          return caches.match(event.request);
        })
    );
    return;
  }

  // For non-navigation requests (assets like JS, CSS, images),
  // use the cache-first strategy for performance.
  event.respondWith(
    caches.match(event.request).then(response => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Not in cache, so fetch from network.
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then(response => {
        // Check if we received a valid response.
        // The original check for 'basic' type is important to avoid caching
        // opaque responses from third-party domains.
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response because it's a stream and can be consumed only once.
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

self.addEventListener('activate', event => {
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
