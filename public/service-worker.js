const CACHE_NAME = 'triponext-cache-v2';
const urlsToCache = [
  '/',
  '/login.html',
  '/index.html',
  '/explore.html',
  '/mytrips.html',
  '/community.html',
  '/buddies.html',
  '/style.css',
  '/script.js',
  '/auth.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
