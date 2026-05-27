const CACHE_NAME = 'dragonwave-v4';
const urlsToCache = [
    './',
    './index.html',
    './management.html',
    './drgon.css',
    './landing.css',
    './dragon.js',
    './js/RaceManager.js',
    './js/api.js',
    './js/ui-utils.js',
    './js/admin-ui.js',
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Safe addAll that doesn't fail the whole cache if one asset is missing
            return Promise.allSettled(
                urlsToCache.map(url => cache.add(url).catch(() => console.warn('Failed to cache:', url)))
            );
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            return cacheName.startsWith('dragonwave-') && cacheName !== CACHE_NAME;
                        })
                        .map(cacheName => {
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    // Don't cache API calls
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => caches.match('./index.html'));
        })
    );
});
