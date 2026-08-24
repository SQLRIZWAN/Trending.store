// ================================================
// 🔧 TREDING STORE - SERVICE WORKER
// ================================================
const CACHE_NAME = 'treding-store-v5';
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
      return cache.addAll(STATIC_ASSETS).catch(() => {});
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{background:#0b0e11;color:#eaecef;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}.card{background:#151a21;border:1px solid #2b3139;border-radius:16px;padding:32px;max-width:320px}.icon{font-size:48px;margin-bottom:16px}.title{font-size:20px;font-weight:700;margin-bottom:8px;color:#d4af37}.msg{color:#848e9c;font-size:14px;margin-bottom:24px}.btn{background:#00c853;color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px}</style></head><body><div class="card"><div class="icon">📡</div><div class="title">You're Offline</div><p class="msg">Please check your internet connection and try again.</p><button class="btn" onclick="location.reload()">Retry</button></div></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })
  );
});

// ── Push Notifications (FCM + Custom) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  
  let data = {};
  try { 
    data = event.data.json(); 
  } catch(e) { 
    data = { title: 'Treding Store', body: event.data.text() }; 
  }

  // Handle FCM payload format
  const title = data.notification?.title || data.title || 'Treding Store';
  const body = data.notification?.body || data.body || data.message || '';
  const icon = data.notification?.icon || data.icon || '/icon.svg';
  const clickAction = data.notification?.click_action || data.click_action || '/';

  const options = {
    body: body,
    icon: icon,
    badge: '/icon.svg',
    tag: data.tag || 'treding-notif-' + Date.now(),
    data: { url: clickAction, ...data },
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const action = event.action;
  const url = event.notification.data?.url || '/';
  
  if (action === 'dismiss') return;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── FCM Background Message Handler ──
// Import Firebase scripts for background messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAozV8jcau0GuIKBPCMFAbChm75O9VE1Rs",
  authDomain: "treding-store-2.firebaseapp.com",
  projectId: "treding-store-2",
  messagingSenderId: "2938541914",
  appId: "1:2938541914:web:7fe53d76a34ec044c90563"
});

const messaging = firebase.messaging();

// Handle background FCM messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background FCM message:', payload);
  const title = payload.notification?.title || 'Treding Store';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'fcm-bg-' + Date.now(),
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: payload.notification?.click_action || '/' }
  };
  
  self.registration.showNotification(title, options);
});
