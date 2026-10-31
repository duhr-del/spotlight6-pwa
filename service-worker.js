/* Service Worker: офлайн-кэш статики и контента.
   Стратегии:
   - переходы по приложению (navigate) — сеть, при отказе кэш и index.html;
   - JSON контента — сеть, при отказе кэш;
   - всё остальное своё — из кэша с фоновым обновлением. */

const VERSION = 'v1.2.0';
const STATIC_CACHE = `spotlight6-static-${VERSION}`;
const RUNTIME_CACHE = `spotlight6-runtime-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/match.js',
  './js/speech.js',
  './js/storage.js',
  './js/tts.js',
  './js/modes/flashcards.js',
  './js/modes/builder.js',
  './js/modes/reading.js',
  './js/ui/dom.js',
  './js/ui/header.js',
  './js/ui/home.js',
  './js/ui/settings.js',
  './data/modules.json',
  './data/module1.json',
  './data/module2.json',
  './data/module3.json',
  './data/module4.json',
  './data/module5.json',
  './data/module6.json',
  './data/module7.json',
  './data/module8.json',
  './data/module9.json',
  './data/module10.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Кэшируем по одному: один недоступный файл не должен ломать установку.
    await Promise.all(PRECACHE.map(async (path) => {
      try {
        await cache.add(new Request(path, { cache: 'reload' }));
      } catch (error) {
        console.warn('[SW] не удалось закэшировать', path, error);
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) return caches.delete(key);
      return undefined;
    }));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Офлайн: страница недоступна', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request) || await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || network || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});