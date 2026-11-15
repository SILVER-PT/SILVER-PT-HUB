// public/sw.js
self.addEventListener('push', function (event) {
  if (!(event.data)) return;

  const data = event.data.json();
  const title = data.title || 'SILVER-PT-HUB';
  const options = {
    body: data.body || 'Hai un nuovo messaggio!',
    icon: '/favicon.ico' // Usa l'icona del tuo sito
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/') // Quando clicchi la notifica, apre l'app
  );
});
