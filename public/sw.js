// Service worker: shows push notifications and opens the app when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Mesa Companion', body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Mesa Companion', {
    body: data.body || '',
    tag: data.tag,
    icon: '/icons/192',
    badge: '/icons/96',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); return w.navigate ? w.navigate(url) : undefined; }
    }
    return self.clients.openWindow(url);
  })());
});
