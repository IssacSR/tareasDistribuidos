const STATIC_CACHE = 'agenda-static-v2'; // bumped version to force update
const RUNTIME_CACHE = 'agenda-runtime-v1';
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/offline.html',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// API bases the SW will treat as API requests
const API_BASES = ['/api/', '/apiTarea/'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
                    .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

async function broadcastMessage(msg) {
    const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
    for (const client of clientsList) client.postMessage(msg);
}

self.addEventListener('sync', event => {
    if (event.tag === 'sync-outbox') {
        event.waitUntil(broadcastMessage({ type: 'SYNC_OUTBOX' }));
    }
});

function isApiRequest(url) {
    for (const base of API_BASES) {
        if (url.pathname.startsWith(base)) return true;
    }
    return false;
}

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);

    // Navigation (HTML) -> network-first, fallback to offline.html
    if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then(resp => {
                    const copy = resp.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, copy));
                    return resp;
                })
                .catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // API requests -> network-first, fallback to cached API response or offline.html
    if (isApiRequest(url)) {
        event.respondWith(
            fetch(event.request)
                .then(resp => {
                    const copy = resp.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, copy));
                    return resp;
                })
                .catch(() => caches.match(event.request).then(cached => cached || caches.match('/offline.html')))
        );
        return;
    }

    // Static assets -> cache-first
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cached =>
                cached || fetch(event.request).then(resp => {
                    if (resp && resp.ok) {
                        caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, resp.clone()));
                    }
                    return resp;
                })
        ).catch(() => caches.match('/offline.html'))
    );
});