# Power Window API

Cloudflare Worker backend for Power Window. It wraps the REData market endpoint and
persists responses by date in Cloudflare KV.

## Local Worker run

```sh
cd /Users/okankaraduman/Documents/Electricity/backend
npx wrangler dev
```

API:

```text
GET http://localhost:8787/api/market?date=2026-07-06
GET http://localhost:8787/api/market?date=2026-07-06&refresh=1
GET http://localhost:8787/api/market/month?date=2026-07-06
GET http://localhost:8787/healthz
```

## Deploy

```sh
cd /Users/okankaraduman/Documents/Electricity/backend
npx wrangler deploy
```

The Worker needs this KV binding in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MARKET_CACHE"
id = "01aae04ae16d486da0ae2c56322bc426"
```

If you ever need to recreate it:

```sh
npx wrangler kv namespace create MARKET_CACHE --binding MARKET_CACHE
```

The production API URL is:

```text
https://api.powerwindow.energy
```

The `routes` entry in `wrangler.toml` keeps that hostname attached as a Worker custom
domain.

## Persistence

Successful REE responses are stored in Cloudflare KV by date.

- Past dates are treated as stable and served from KV indefinitely.
- Today and tomorrow are refreshed periodically, but stale KV data is returned immediately
  while the Worker refreshes in the background.
- `refresh=1` forces a synchronous refresh for a single date.
- `/api/market/month?date=YYYY-MM-DD` returns cached day payloads from the first day of
  that month through the selected date, so clients do not fan out many date requests.

If REE is unavailable and cached data exists, the API returns the cache instead of failing
the request.

## Go reference server

The old Go server is kept as a local reference implementation, but Cloudflare production
uses the Worker above.

```sh
cd backend
go run ./cmd/server
```

API:

```text
GET http://localhost:8080/api/market?date=2026-07-06
GET http://localhost:8080/api/market?date=2026-07-06&refresh=1
GET http://localhost:8080/healthz
```
