const CACHE = 'iwish-v2-agenda-supabase';
const CORE = ['./', './index.html', './styles.css', './experience.css', './appearance.js', './planner.css', './planner-core.js', './planner-store.js', './planner.js', './routine-core.js', './routine-ui.js', './routine.css', './app.js', './welcome.js', './welcome-verses.js', './journal-store.js', './journal.js', './vendor/supabase-2.57.4.min.js', './config.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('iwish-') && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const staticPaths = CORE.map(path => new URL(path, self.registration.scope).pathname);
  // Account/API responses must never enter the shared offline cache.
  if (url.origin !== self.location.origin || !staticPaths.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'REMINDER') return;
  self.registration.showNotification(event.data.title || 'I Wish', {
    body: event.data.body || 'Tienes algo pendiente.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: event.data.tag || 'iwish-reminder'
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => list[0]?.focus() || clients.openWindow('./')));
});
