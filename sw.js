// Service worker de la borne : précache de l'application et repli hors-ligne.
// `deploy.sh` remplace __VERSION__ (hash Git court + horodatage) pour renouveler le cache à chaque déploiement.

const CACHE = 'dupes-__VERSION__';
const CACHE_PREFIX = 'dupes-';
const API_PATH = '/api/parfums';
// Lu par js/data.js (FROM_CACHE_HEADER) : la page allume alors le point « données de secours ».
const FROM_CACHE_HEADER = 'X-From-Cache';

// Liste explicite (pas d'étape de build) : un fichier manquant ferait échouer cache.addAll,
// d'où le test tests/unit/sw.test.js qui vérifie que chaque entrée existe.
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/views.js',
  'js/search.js',
  'js/data.js',
  'js/format.js',
  'js/i18n.js',
  'js/idle.js',
  'assets/affiche.jpg',
  'assets/fonts/big-shoulders-display-latin-ext-wght-normal.woff2',
  'assets/fonts/big-shoulders-display-latin-wght-normal.woff2',
  'assets/fonts/figtree-latin-ext-wght-normal.woff2',
  'assets/fonts/figtree-latin-wght-normal.woff2',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'data/parfums.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' contourne le cache HTTP : une nouvelle version ne précache jamais de fichiers périmés.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** Copie d'une réponse en cache, marquée pour que la page sache qu'elle n'est pas fraîche. */
function markedFromCache(response) {
  const headers = new Headers(response.headers);
  headers.set(FROM_CACHE_HEADER, '1');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Réseau d'abord, copie en cache (marquée) en cas d'échec ; la dernière réponse valide est conservée. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return markedFromCache(cached);
    throw error;
  }
}

/** Cache d'abord, réseau en repli (les navigations hors-ligne retombent sur index.html). */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
  return cached || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(url.pathname.endsWith(API_PATH) ? networkFirst(request) : cacheFirst(request));
});
