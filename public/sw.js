/* Cookin service worker: offline app shell + cached reads.
 *
 * - Navigations: network first, fall back to the cached app shell, so the app
 *   opens in the grocery store with no signal.
 * - Built assets (/assets/*, hashed by Vite) and icons: cache first.
 * - /api/* is never touched: the store keeps its own offline copy and queue,
 *   and a stale cached sync response would be wrong.
 * - Cross-origin requests (NYT images, fonts) are left to the browser.
 */
const VERSION = 'v1';
const SHELL = `cookin-shell-${VERSION}`;
const ASSETS = `cookin-assets-${VERSION}`;
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL, ASSETS]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    // Don't cache a sign-in page (Cloudflare Access redirects) as the app shell.
    if (res && res.ok && !res.redirected) cache.put(fallbackUrl ?? request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackUrl ?? request);
    if (hit) return hit;
    if (fallbackUrl) {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) (await caches.open(ASSETS)).put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Single-page app: every route is served by index.html.
    event.respondWith(networkFirst(request, SHELL, '/index.html'));
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
