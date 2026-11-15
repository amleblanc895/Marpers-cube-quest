// Marper's Cube Quest — offline support
const CACHE = 'cube-quest-v1';
const FILES = ['./', './index.html', './music.mp3', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/icon-32.png', './icons/icon-16.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// iPhone Safari asks for audio in byte ranges; answer those from the cached file
async function rangeResponse(req, res) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  const size = buf.byteLength;
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const url = req.url.split('#')[0];
    let res = await cache.match(url, { ignoreSearch: true });
    if (!res && req.mode === 'navigate') res = await cache.match('./index.html');
    if (!res) {
      try { const net = await fetch(req); if (net.ok && !req.headers.has('range')) cache.put(req, net.clone()); return net; }
      catch (err) { return new Response('Offline', { status: 503 }); }
    }
    if (req.headers.has('range')) return rangeResponse(req, res);
    return res;
  })());
});
