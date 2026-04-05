// sw.js — Luminary Service Worker
const CACHE = 'luminary-v1';
const ASSETS = ['/', '/index.html', '/app.js', '/manifest.json'];

// Install — cache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Fetch — cache first for shell, network first for API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls — network only
  if (url.pathname.startsWith('/queue') || url.hostname.includes('render.com')) {
    return;
  }

  // Shell — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ─── Push Notification Received ───────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch (_) { data = { title: '✦ Luminary', body: 'New item in your queue' }; }

  e.waitUntil(
    self.registration.showNotification(data.title || '✦ Luminary', {
      body: data.body || 'Something new in your queue',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'luminary-queue',      // Replace previous notification — no spam
      renotify: false,
      silent: false,
      data: { videoUrl: data.videoUrl, itemId: data.itemId }
    })
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { videoUrl, itemId } = e.notification.data || {};

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app is open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'OPEN_ITEM', itemId });
          return;
        }
      }
      // Otherwise open YouTube directly
      if (videoUrl) {
        return clients.openWindow(videoUrl);
      }
      return clients.openWindow('/');
    })
  );
});
