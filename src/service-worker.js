// Service Worker for FlashCards PWA
const CACHE_VERSION = 'flashcards-v2-2025-12-14-bulma';
const RUNTIME_CACHE = 'flashcards-runtime';

// Files to precache on install
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/app.js',
    '/styles.css',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// Deck files to precache
const DECK_CACHE_URLS = [
    '/decks/index.json',
    '/decks/flashcards%20(1).csv',
    '/decks/flashcards%20(2).csv',
];

// ============================================================================
// INSTALL: Precache app shell and default decks
// ============================================================================

self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => {
            console.log('Caching app shell');
            return cache.addAll(PRECACHE_URLS);
        }).then(() => {
            // Try to cache deck files, but don't fail if they're not available yet
            return caches.open(RUNTIME_CACHE).then(cache => {
                return Promise.allSettled(
                    DECK_CACHE_URLS.map(url => cache.add(url).catch(() => {
                        console.log(`Deck file not immediately available: ${url}`);
                    }))
                );
            });
        }).then(() => {
            console.log('Skipping waiting - activate immediately');
            return self.skipWaiting();
        })
    );
});

// ============================================================================
// ACTIVATE: Clean up old caches and claim clients
// ============================================================================

self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_VERSION && cacheName !== RUNTIME_CACHE) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Claiming clients');
            return self.clients.claim();
        })
    );
});

// ============================================================================
// FETCH: Cache-first for app shell, stale-while-revalidate for decks
// ============================================================================

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Network-only for manifest/service-worker updates
    if (url.pathname === '/manifest.webmanifest' || url.pathname === '/service-worker.js') {
        return event.respondWith(fetch(event.request));
    }

    // App shell: cache-first
    if (PRECACHE_URLS.some(p => url.pathname.endsWith(p))) {
        return event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request).then(response => {
                    return caches.open(CACHE_VERSION).then(cache => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                });
            }).catch(() => {
                return caches.match('/index.html');
            })
        );
    }

    // Decks (CSVs, index.json): stale-while-revalidate
    if (url.pathname.startsWith('/decks/')) {
        return event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(response => {
                    return caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                });

                return cachedResponse || fetchPromise;
            }).catch(() => {
                return caches.match(event.request);
            })
        );
    }

    // External CDN resources: network-first with fallback
    if (url.hostname !== location.hostname) {
        return event.respondWith(
            fetch(event.request).then(response => {
                return caches.open(RUNTIME_CACHE).then(cache => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            }).catch(() => {
                return caches.match(event.request).catch(() => {
                    // Return a minimal offline page or empty response
                    return new Response('Offline - resource not available', { status: 503 });
                });
            })
        );
    }

    // Default: network-first
    return event.respondWith(
        fetch(event.request).then(response => {
            return caches.open(RUNTIME_CACHE).then(cache => {
                cache.put(event.request, response.clone());
                return response;
            });
        }).catch(() => {
            return caches.match(event.request).catch(() => {
                return new Response('Offline - resource not available', { status: 503 });
            });
        })
    );
});

// ============================================================================
// MESSAGE: Handle skip-waiting signal from app
// ============================================================================

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('Received SKIP_WAITING message');
        self.skipWaiting();
    }
});
