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

Power Window is web-first, with two Android paths:

- PWA install: on Android Chrome, open the production site and use the in-app install prompt
  or Chrome's install menu. The app has a manifest and service worker, so it can be launched
  like a normal Android app after install.
- Native wrapper: open `/Users/okankaraduman/Documents/Electricity/android` in Android
  Studio. This is a small WebView app that loads `https://powerwindow.energy/`.

The native wrapper is the current Android starting point. A Trusted Web Activity is the
better Play Store path once the app has final icons, screenshots, privacy policy, and Digital
Asset Links.

## EV charging model

The EV planner estimates energy from the selected battery size and state-of-charge change:

```text
energy needed = battery kWh * ((target % - current %) / 100)
```

Charger power is in kW. Energy added is in kWh. Preset vehicle battery sizes are approximate,
and the `Custom` option lets users enter a different battery size for missing models or trims.

## Data

The backend requests:

```text
https://apidatos.ree.es/en/datos/mercados/precios-mercados-tiempo-real
```

The Cloudflare Worker persists successful responses in KV by date. Historical dates are
served from KV indefinitely, while today and tomorrow can return cached data immediately and
refresh in the background. The mission page uses the month endpoint so visitors do not fan
out separate requests for every day in the current month.

## Notes

This is not affiliated with Red Electrica. Prices are used as market signals and are not a
complete household bill calculation.

## Parked iOS work

The old SwiftUI sketch remains in `ios/BestTimePower`, but it is not the active product
track. Current focus is the web app, Android PWA install flow, and the Android wrapper in
`android/`.
