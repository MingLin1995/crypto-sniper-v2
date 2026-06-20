self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      const options = {
        body: payload.body,
        icon: payload.icon || '/favicon.ico',
        badge: '/favicon.ico',
        data: payload.data || {},
        silent: false, // 不要靜音
        vibrate: [200, 100, 200], // 震動模式
      };
      event.waitUntil(
        self.registration.showNotification(payload.title || 'CryptoSniper Alert', options),
      );
    } catch (e) {
      // Fallback for non-JSON payloads
      event.waitUntil(
        self.registration.showNotification('CryptoSniper Alert', {
          body: event.data.text(),
          icon: '/favicon.ico',
        }),
      );
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/alerts';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
