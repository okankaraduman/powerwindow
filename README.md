# Power Window

A small static app that uses Red Electrica de Espana's REData API to find the cheapest
time window for flexible electricity use in Spain.

## Run locally

Run the Worker backend:

```sh
cd /Users/okankaraduman/Documents/Electricity/backend
npx wrangler dev
```

Then serve the frontend:

```sh
cd /Users/okankaraduman/Documents/Electricity
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

The production frontend calls `https://api.powerwindow.energy/api/market`.

During local development, if you want the static frontend to use local Wrangler instead of
falling back to direct REE requests, set the browser override once:

```js
localStorage.setItem("POWER_WINDOW_API_BASE", "http://localhost:8787/api")
```

Then refresh the page.

## Android install

Power Window is now treated as a web-first Android PWA. On Android Chrome, open the
production site and use the in-app install prompt or Chrome's install menu. The app has a
manifest and service worker, so it can be launched like a normal Android app after install.

A native Android app can come later if the PWA proves useful enough to justify Play Store
work, notifications, and native background scheduling.

## Data

The backend requests:

```text
https://apidatos.ree.es/en/datos/mercados/precios-mercados-tiempo-real
```

The Cloudflare Worker caches successful responses in KV by date. If the backend or REE API
is unavailable, the frontend clearly switches to demo mode unless browser-cached data is
available.

## Notes

This is not affiliated with Red Electrica. Prices are used as market signals and are not a
complete household bill calculation.

## Parked iOS work

The old SwiftUI sketch remains in `ios/BestTimePower`, but it is not the active product
track. Current focus is the web app and Android PWA install flow.
