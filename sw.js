/* Kociakowe skakanie – service worker (działanie offline).
 * Przy publikacji (workflow publikacji → tools/build-sw.mjs) VERSION
 * dostaje skrót wszystkich plików, a ASSETS ich pełną listę. Nowa wersja czeka,
 * aż użytkownik stuknie „Odśwież” – bez niespodziewanych przeładowań. */
const VERSION = 'dev';
const CACHE = `kociakowe-skakanie-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './js/pwa.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  // `cache: 'reload'` omija pamięć HTTP, żeby nowa wersja nie zapisała starych plików
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kociakowe-skakanie-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match('./');
        if (shell) return shell;
      }
      return fetch(req);
    }),
  );
});
