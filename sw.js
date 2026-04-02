// ================================================
// 🔧 TREDING STORE - SERVICE WORKER
// ================================================
const CACHE_NAME = 'treding-store-v4';
const OFFLINE_URL = '/offline.html';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/offline.html'
];

// ── Install: cache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignore individual cache failures (e.g. CDN resources)
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first with offline fallback ──
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip external requests (Firebase, Binance, CDN, etc.)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for app shell
        if (response.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // For navigation requests, return offline page
        if (event.request.mode === 'navigate') {
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          // Inline fallback if offline.html not cached
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{background:#0b0e11;color:#eaecef;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}.card{background:#151a21;border:1px solid #2b3139;border-radius:16px;padding:32px;max-width:320px}.icon{font-size:48px;margin-bottom:16px}.title{font-size:20px;font-weight:700;margin-bottom:8px;color:#d4af37}.msg{color:#848e9c;font-size:14px;margin-bottom:24px}.btn{background:#00c853;color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px}</style></head><body><div class="card"><div class="icon">📡</div><div class="title">You're Offline</div><p class="msg">Please check your internet connection and try again.</p><button class="btn" onclick="location.reload()">Retry</button></div></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })
  );
});

// ── Push Notifications ──
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Treding Store', body: event.data.text() }; }

  const options = {
    body: data.body || data.message || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'treding-notif',
    data: data,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Treding Store', options)
  );
});

// ── Notification Click ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
