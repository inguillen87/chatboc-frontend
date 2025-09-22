// public/sw.js

const VERSION = 'v3';
const APP_SHELL_CACHE = `chatboc-shell-${VERSION}`;
const ASSET_CACHE = `chatboc-assets-${VERSION}`;
const PRECACHE_URLS = ['/', '/index.html'];
const BYPASS_PATH_PREFIXES = [
  '/iframe',
  '/assets/iframe',
  '/widget',
  '/cdn/widget',
  '/cdn/iframe',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  const validCaches = new Set([APP_SHELL_CACHE, ASSET_CACHE]);
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => !validCaches.has(name))
          .map(name => caches.delete(name))
      ).then(() => self.clients.claim())
    )
  );
});

function shouldBypassPath(pathname) {
  return BYPASS_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function isDataRequest(request, url) {
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
    return true;
  }

  const acceptHeader = request.headers.get('Accept') || '';
  return request.destination === '' && acceptHeader.includes('application/json');
}

async function putInCache(cacheName, request, response) {
  if (!response || !response.ok || response.type !== 'basic') {
    return;
  }
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function networkFirst(request, cacheName, useShellFallback = false) {
  try {
    const networkResponse = await fetch(request);
    await putInCache(cacheName, request, networkResponse);
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    if (useShellFallback) {
      const fallback = (await cache.match('/')) || (await cache.match('/index.html'));
      if (fallback) {
        return fallback;
      }
    }
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (shouldBypassPath(url.pathname)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_SHELL_CACHE, true));
    return;
  }

  if (isDataRequest(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (['script', 'style', 'worker'].includes(request.destination)) {
    event.respondWith(networkFirst(request, ASSET_CACHE));
    return;
  }

  if (['image', 'font'].includes(request.destination)) {
    event.respondWith(networkFirst(request, ASSET_CACHE));
    return;
  }

  event.respondWith(fetch(request));
});
