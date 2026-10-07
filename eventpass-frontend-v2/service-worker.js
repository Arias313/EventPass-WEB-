// ============================================================
// SERVICE WORKER — EventPass PWA (v3)
// ============================================================

const CACHE_STATIC_NAME = 'eventpass-static-v5';
const CACHE_DYNAMIC_NAME = 'eventpass-dynamic-v5';

// Archivos que componen el App Shell (Cache de Instalación)
const scope = self.registration.scope;
const STATIC_ASSETS = [
  scope,
  new URL('index.html', scope).href,
  new URL('index-administrador.html', scope).href,
  new URL('pages/login.html', scope).href,
  new URL('pages/registro.html', scope).href,
  new URL('pages/ticket.html', scope).href,
  new URL('css/main.css', scope).href,
  new URL('js/app.js', scope).href,
  new URL('js/config.js', scope).href,
  new URL('js/api-store.js', scope).href,
  new URL('manifest.json', scope).href,
  new URL('icons/icon-192x192.png', scope).href,
  new URL('icons/icon-512x512.png', scope).href
];

// Prefijos de URL que NO deben pasar por la caché (se gestionan en la API o IndexedDB)
const NEVER_CACHE = [
  '/api/',
  '/checkin',
  '/dashboard/live'
];

// ─── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando EventPass Service Worker...');

  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando App Shell (assets estáticos)...');
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn(`[SW] No se pudo cachear ${url}:`, err)
            )
          )
        );
      })
      .then(() => {
        console.log('[SW] App Shell cacheado correctamente.');
        return self.skipWaiting();
      })
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker y limpiando caches viejos...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_STATIC_NAME && name !== CACHE_DYNAMIC_NAME)
            .map(name => {
              console.log(`[SW] Eliminando cache obsoleto: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Excluir peticiones que no sean GET (POST, PUT, DELETE no se pueden guardar en Cache API)
  if (request.method !== 'GET') {
    return;
  }

  // 1. Peticiones de API / Backend -> Network First
  if (NEVER_CACHE.some(path => url.pathname.includes(path))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 2. Assets estáticos (CSS, JS, imágenes, fuentes) -> Cache First
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. Peticiones de navegación (Navegación HTML) -> Network First con fallback a offline.html
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // 4. Recursos genéricos -> Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ─── ESTRATEGIAS DE CACHÉ ───────────────────────────────────

function isJavaScriptResponse(response) {
  return /(?:java|ecma)script/i.test(response.headers.get('content-type') || '');
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached && (request.destination !== 'script' || isJavaScriptResponse(cached))) return cached;

  try {
    const networkResponse = await fetch(request);
    if (
      networkResponse &&
      networkResponse.ok &&
      networkResponse.type === 'basic' &&
      (request.destination !== 'script' || isJavaScriptResponse(networkResponse))
    ) {
      const cache = await caches.open(CACHE_STATIC_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache First falló:', error);
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_DYNAMIC_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Red no disponible, buscando en caché:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ error: 'Sin conexión a internet', offline: true }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    );
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_DYNAMIC_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback a la landing principal
    const offlinePage = await caches.match(scope);
    return offlinePage || new Response('<h1>Modo Sin Conexión</h1><p>Revisa tu conexión a internet.</p>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_DYNAMIC_NAME);
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cached || await fetchPromise;
}

// ─── PUSH NOTIFICATIONS ─────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Notificación de EventPass',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ver detalles' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'EventPass', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          const existingClient = clientList.find(c => c.url === urlToOpen);
          if (existingClient) return existingClient.focus();
          return clients.openWindow(urlToOpen);
        })
    );
  }
});

// ─── BACKGROUND SYNC ────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins' || event.tag === 'sync-eventpass') {
    console.log('[SW] Evento de sincronización en segundo plano recibido...');
    event.waitUntil(notificarClientesSincronizacion());
  }
});

async function notificarClientesSincronizacion() {
  const clientList = await self.clients.matchAll();
  clientList.forEach(client => {
    client.postMessage({ type: 'SYNC_EVENTPASS' });
  });
}