// Sube la versión cada vez que publiques cambios para que los teléfonos tomen la nueva.
const CACHE = 'viaje-v1';
const BASE = [
  './', 'index.html', 'app.js', 'config.js', 'styles.css', 'plan.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Librerías de Firebase: tienen versión fija, así que primero la caché.
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => guardar(e.request, res))));
    return;
  }

  // Archivos propios: primero la red (para ver cambios) y la caché si no hay conexión.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(res => guardar(e.request, res))
        .catch(() => caches.match(e.request, { ignoreSearch: true })),
    );
  }
});

function guardar(req, res) {
  if (res.ok) {
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(req, copia));
  }
  return res;
}
