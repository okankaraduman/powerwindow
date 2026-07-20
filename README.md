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

## Charger connector MVP

The backend includes a demo charger connector for testing the smart-charging flow without
real charger credentials. The planner can connect a `Demo Wallbox`, send the selected best
window as a charge plan, and issue start/stop commands. These are persisted in D1 through
`connector_accounts`, `devices`, `charge_plans`, and `charge_commands`.

This demo path is the contract for later real connectors such as Enode, Easee partner API,
or OCPP. The Android app remains a WebView wrapper, so it exercises the same backend flow as
the website.

## Store release prep

Release-prep assets live under `store/`:

- Privacy policy page: `/privacy`
- Play listing draft: `store/play-store-listing.md`
- Data Safety draft: `store/data-safety.md`
- Store icon, feature graphic, and screenshots: `store/assets/`
- Android release checklist: `store/release-checklist.md`

The Android project now includes a Gradle wrapper, adaptive launcher icon, and release
signing configuration. A real release still needs a local keystore and a signed AAB build.

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
https://apidatos.ree.es/en/datos/generacion/estructura-generacion
```

The Cloudflare Worker reads market and generation data in this order: KV cache, D1 database, then REE.
Successful REE responses are stored in D1 and copied into KV. Historical dates are served
from our persistence indefinitely, while today and tomorrow can return cached data
immediately and refresh in the background. The mission page uses the month endpoint so
visitors do not fan out separate requests for every day in the current month.

The statistics page uses the same backend cache to show daily PVPC price shape, lowest price
hour, renewable generation rate, wind plus solar share, and the generation mix.

## Notes

This is not affiliated with Red Electrica. Prices are used as market signals and are not a
complete household bill calculation.

## Parked iOS work

The old SwiftUI sketch remains in `ios/BestTimePower`, but it is not the active product
track. Current focus is the web app, Android PWA install flow, and the Android wrapper in
`android/`.
