const CACHE_NAME = "power-window-v69";
const APP_ASSETS = [
  "/",
  "/index.html",
  "/compare",
  "/compare.html",
  "/precio-luz-hoy",
  "/precio-luz-hoy.html",
  "/precio-luz-manana",
  "/precio-luz-manana.html",
  "/precio-luz-coche-electrico",
  "/precio-luz-coche-electrico.html",
  "/mejor-hora-lavadora",
  "/mejor-hora-lavadora.html",
  "/statistics",
  "/methodology",
  "/mission",
  "/about",
  "/privacy",
  "/en/",
  "/en/index.html",
  "/en/compare",
  "/en/compare.html",
  "/consumo-electrico-hogar",
  "/consumo-electrico-hogar.html",
  "/en/home-electricity-use-spain",
  "/en/home-electricity-use-spain.html",
  "/en/electricity-charges-spain",
  "/en/electricity-charges-spain.html",
  "/en/electricity-price-spain-today",
  "/en/electricity-price-spain-today.html",
  "/en/electricity-price-spain-tomorrow",
  "/en/electricity-price-spain-tomorrow.html",
  "/en/ev-charging-electricity-price-spain",
  "/en/ev-charging-electricity-price-spain.html",
  "/en/best-time-washing-machine-spain",
  "/en/best-time-washing-machine-spain.html",
  "/en/statistics",
  "/en/methodology",
  "/en/mission",
  "/en/about",
  "/en/privacy",
  "/styles.css",
  "/navigation.css",
  "/about.css",
  "/navigation.js",
  "/app.js",
  "/app.en.js",
  "/analytics.js",
  "/analytics.en.js",
  "/daily-seo.js",
  "/shared/daily-market.mjs",
  "/shared/sitemap.mjs",
  "/data/catalog.mjs",
  "/compare.js",
  "/statistics.js",
  "/statistics.en.js",
  "/statistics-annual.js",
  "/statistics-capacity.js",
  "/shared/annual-generation.mjs",
  "/shared/installed-capacity.mjs",
  "/shared/contract-pricing.mjs",
  "/mission.js",
  "/mission.en.js",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/manifest.en.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/store/assets/feature-graphic.png",
  "/store/assets/play-store-qr.png",
  "/store/assets/google-play-badge-es.png",
  "/store/assets/google-play-badge-en.png"
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
