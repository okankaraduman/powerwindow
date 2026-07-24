const CACHE_NAME = "power-window-v45";
const APP_ASSETS = [
  "/",
  "/index.html",
  "/compare",
  "/compare.html",
  "/statistics",
  "/methodology",
  "/mission",
  "/privacy",
  "/en/",
  "/en/index.html",
  "/en/compare",
  "/en/compare.html",
  "/en/statistics",
  "/en/methodology",
  "/en/mission",
  "/en/privacy",
  "/styles.css",
  "/app.js",
  "/app.en.js",
  "/analytics.js",
  "/analytics.en.js",
  "/compare.js",
  "/statistics.js",
  "/statistics.en.js",
  "/mission.js",
  "/mission.en.js",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/manifest.en.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/store/assets/feature-graphic.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestURL = new URL(event.request.url);

  if (requestURL.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
      );
    })
  );
});
