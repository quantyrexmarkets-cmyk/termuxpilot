const CACHE = 'codedeck-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Don't cache API calls or terminal
  if (e.request.url.includes('/api/')) return;
  
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => {
          cache.put(e.request, clone);
        });
        return response;
      });
    }).catch(() => caches.match('/app'))
  );
});
