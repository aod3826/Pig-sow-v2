/**
 * นิพนธ์ฟาร์ม Service Worker
 * Handles offline support, caching, and background sync
 * Version: 1.0
 */

const CACHE_NAME = 'niphand-farm-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/farm.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800;900&family=Sarabun:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap'
];

/**
 * Install event - cache essential assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[ServiceWorker] Some assets could not be cached:', err);
        // Don't fail install if some assets can't be cached
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event - Network first, fallback to cache
 * 
 * Strategy:
 * - API calls: try network first, don't cache
 * - Assets (CSS, JS, fonts): try cache first, network as fallback
 * - HTML: try network first, cache as fallback
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache API calls to Google Apps Script
  if (url.hostname === 'script.google.com') {
    console.log('[ServiceWorker] Skipping cache for API call:', url.pathname);
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Network request failed', offline: true }),
          { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // HTML files - network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response('Offline - Page not available', { status: 503 });
          });
        })
    );
    return;
  }

  // Assets (CSS, JS, images, fonts) - cache first
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => {
            // Return a placeholder for failed assets
            if (request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#eee" width="100" height="100"/></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return new Response('Asset unavailable', { status: 503 });
          });
      })
    );
    return;
  }

  // Default - network first
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});

/**
 * Message handler - for manual cache update
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[ServiceWorker] Loaded successfully');
