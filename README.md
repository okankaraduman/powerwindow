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

## Check on iPhone without Xcode

1. Keep the local server running on your computer.
2. Make sure your iPhone is on the same Wi-Fi network.
3. Find your computer's local IP address.
4. Open `http://YOUR_LOCAL_IP:8000` in Safari on the iPhone.
5. Use Share -> Add to Home Screen.

For a true installable/offline PWA on iPhone, serve it over HTTPS. Localhost works on the
computer, but a phone visiting a LAN IP may not allow every PWA feature over plain HTTP.

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

## iOS

A native SwiftUI version lives in `ios/BestTimePower`. Create a new SwiftUI iOS app in
Xcode named `BestTimePower`, then copy those Swift files into the project.
