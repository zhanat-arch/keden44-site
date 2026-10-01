const CACHE = 'keden44-monitor-v18';
const ASSETS = ['./', './index.html', './styles.css', './monitor-public.css?v=2', './app.js?v=14', './monitor-public.js?v=3', './manifest.webmanifest', './modules/keden/client.js', './modules/telegram/client.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.method === 'POST' && url.pathname.endsWith('/monitor/share-target')) {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const files = formData.getAll('pdfs').filter(value => value instanceof File && (value.type === 'application/pdf' || /\.pdf$/i.test(value.name)));
      if (!files.length) return Response.redirect(new URL('./?share-error=pdf', event.request.url), 303);
      const cache = await caches.open(CACHE);
      const ids = [];
      for (const file of files) {
        const id = crypto.randomUUID();
        const fileUrl = new URL('./shared-pdf/' + id, event.request.url);
        await cache.put(fileUrl, new Response(file, { headers: { 'Content-Type': 'application/pdf', 'X-KEDEN44-Filename': encodeURIComponent(file.name || 'document.pdf') } }));
        ids.push(id);
      }
      return Response.redirect(new URL('./?shared=' + encodeURIComponent(ids.join(',')), event.request.url), 303);
    })());
    return;
  }
  if (event.request.method === 'GET' && url.pathname.includes('/monitor/shared-pdf/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const response = await cache.match(event.request);
      if (response) await cache.delete(event.request);
      return response || new Response('PDF not found', { status: 404 });
    })());
    return;
  }
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(items => {
    const existing = items.find(item => item.url.includes('/monitor/'));
    return existing ? existing.focus() : clients.openWindow('/monitor/');
  }));
});
