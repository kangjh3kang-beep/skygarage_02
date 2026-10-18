/* Public install assets only. Never cache authenticated pages, APIs or commands. */
const CACHE_NAME = 'sgp-public-install-v3';
const ASSETS = ['/offline.html', '/doelv/icon-192.png', '/doelv/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sgp-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate' && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html'))); return;
  }
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
