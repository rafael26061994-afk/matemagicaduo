/* Matemágica Duo - Service Worker (Offline) */
// Incrementar sempre que houver mudanças para forçar atualização do cache
const CACHE_NAME = 'pet-tabuada-v1-14-1-achievements-scroll-fix-v6';
const ASSETS = [
  '.',
  './index.html',
  './style.css',
  './script.js',
  './alert-sound.mp3',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './Sem titulo.png',
  './rafael.png',
  './ronaldo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Só cacheia GET
  if (req.method !== 'GET') return;

  // Vídeo/streaming: não interceptar requests com Range nem MP4.
  // Isso evita falha de reprodução em navegadores que carregam o vídeo em partes.
  const url = new URL(req.url);
  const hasRange = !!req.headers.get('range');
  const isVideo = /\.mp4($|\?)/i.test(url.pathname + url.search);
  if (hasRange || isVideo) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone)).catch(() => {});
          return resp;
        })
        .catch(() => {
          // Fallback: tenta index (bom para abrir offline)
          return caches.match('./index.html');
        });
    })
  );
});


// Permite atualizar imediatamente quando o app solicitar
self.addEventListener('message', (event) => {
  try {
    if (event && event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  } catch (_) {}
});
