# Power Window

A small static app that uses Red Electrica de Espana's REData API to find the cheapest
time window for flexible electricity use in Spain.

## Run locally

Run the backend API:

```sh
cd /Users/okankaraduman/Documents/Electricity/backend
go run ./cmd/server
```

Then serve the frontend:

```sh
cd /Users/okankaraduman/Documents/Electricity
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

The frontend calls `/api/market` in production. During local development, if the backend is
not available through the same origin, set the browser override once:

```js
localStorage.setItem("POWER_WINDOW_API_BASE", "http://localhost:8080/api")
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

The app requests:

```text
https://apidatos.ree.es/en/datos/mercados/precios-mercados-tiempo-real
```

If the API is unavailable or the selected date has no usable hourly data, the app clearly
switches to demo mode.

## Notes

This is not affiliated with Red Electrica. Prices are used as market signals and are not a
complete household bill calculation.

## iOS

A native SwiftUI version lives in `ios/BestTimePower`. Create a new SwiftUI iOS app in
Xcode named `BestTimePower`, then copy those Swift files into the project.
