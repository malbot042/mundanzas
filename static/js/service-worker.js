const CACHE_VERSION = "v1";
const CACHE_NAME = `mudanzas-${CACHE_VERSION}`;

// Rutas del "app shell" que se cachean desde la instalación para que la app
// arranque sin conexión desde la primera visita.
const PRECACHE_URLS = [
    "/",
    "/nueva/",
    "/static/css/base.css",
    "/static/js/htmx.min.js",
    "/static/js/alpine.min.js",
    "/static/js/offline.js",
    "/static/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Los POST (crear/editar mudanza, sincronización) los gestiona offline.js;
    // el service worker solo cachea lecturas (GET).
    if (request.method !== "GET") return;

    // Navegación entre páginas (listado, formulario, edición, impresión):
    // red primero, y si falla, se sirve la copia cacheada o el listado ("/").
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
        );
        return;
    }

    // Estáticos y demás peticiones same-origin: cache primero, con
    // revalidación en segundo plano cuando hay red.
    if (new URL(request.url).origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request)
                    .then((response) => {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                        return response;
                    })
                    .catch(() => cached);
                return cached || fetchPromise;
            })
        );
    }
});
