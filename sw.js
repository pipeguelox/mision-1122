// Service worker: guarda la app en el celular para que abra rápido y sin internet.
const VERSION = "mision-1122-v4";
const ARCHIVOS = ["./", "index.html", "estilos.css", "datos.js", "app.js", "medios.js", "antioquia.json", "rios.json",
  "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Primero intenta internet (para tener la última versión); si no hay, usa lo guardado.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(VERSION).then(c => c.put(e.request, copia)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
