// Iris: keeps a copy of every file in the browser, so the work starts without internet once it has started with it.
// The libraries and the face model never change at these addresses, so the kept copy is used first. The work's own
// files (index.html, sketch.js) are fetched fresh whenever the internet answers, so updates still arrive.
const CACHE = 'iris-1';
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const KEEP = [
  './', 'index.html', 'sketch.js',
  'https://cdn.jsdelivr.net/npm/p5@1.11.1/lib/p5.min.js',
  MP + '/vision_bundle.mjs',
  MP + '/wasm/vision_wasm_internal.js', MP + '/wasm/vision_wasm_internal.wasm',
  MP + '/wasm/vision_wasm_nosimd_internal.js', MP + '/wasm/vision_wasm_nosimd_internal.wasm',
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
];

self.addEventListener('install', (ev) => {
  // one by one, so a file that can't be fetched now doesn't stop the others being kept
  ev.waitUntil(caches.open(CACHE).then((c) => Promise.all(KEEP.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const own = new URL(req.url).origin === self.location.origin;
  if (own) {   // the work itself: fresh when possible (asking the server, not the browser's short-term cache, so an
    // update shows on the next reload), the kept copy when offline
    ev.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
  } else {     // libraries and the model: the kept copy first
    ev.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
