// Proost : coquille de l'appli disponible hors ligne.
// Pages : réseau d'abord, sinon index.html en cache. Fichiers de build (hachés) : cache d'abord.
// Les données Supabase ne passent jamais par ce cache. Les photos déjà vues sont gardées à part
// (cache « proost-photos », réseau d'abord) pour rester visibles hors ligne ; vidé à la déconnexion.
// Nom du cache et liste des fichiers : complétés au build (voir vite.config.ts)
const CACHE = "proost-__BUILD__";
const PHOTOS = "proost-photos";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/apple-touch-icon.png", ...__ASSETS__];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PHOTOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Polices Google : cache d'abord
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  // Photos (URL signées) : réseau d'abord, repli sur la dernière version vue ; clé sans le jeton
  if (url.pathname.includes("/storage/v1/object/sign/photos/")) {
    const key = url.origin + url.pathname;
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(PHOTOS).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then(hit => hit || Response.error())));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord, repli sur la coquille
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put("/", copy)); return res;
    }).catch(() => caches.match("/")));
    return;
  }

  // Fichiers de build et icônes : cache d'abord
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
