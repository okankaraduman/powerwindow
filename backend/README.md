# Power Window API

Cloudflare Worker backend for Power Window. It wraps the REData market endpoint and
persists responses by date in Cloudflare D1, with Cloudflare KV as the fast edge cache.

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
GET http://localhost:8787/api/connectors
POST http://localhost:8787/api/connectors/mock/pair
GET http://localhost:8787/api/devices?userId=pw_example_user
POST http://localhost:8787/api/charge-plans
POST http://localhost:8787/api/devices/{deviceId}/commands
GET http://localhost:8787/healthz
```

## Deploy

```sh
cd /Users/okankaraduman/Documents/Electricity/backend
npx wrangler deploy
```

The Worker needs these bindings in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MARKET_CACHE"
id = "01aae04ae16d486da0ae2c56322bc426"

[[d1_databases]]
binding = "MARKET_DB"
database_name = "powerwindow-market"
database_id = "3c9cc7ff-a086-4e80-9e3b-f925acbd5f29"
```

If you ever need to recreate the KV namespace:

```sh
npx wrangler kv namespace create MARKET_CACHE --binding MARKET_CACHE
```

If you ever need to recreate the D1 database:

```sh
npx wrangler d1 create powerwindow-market
npx wrangler d1 migrations apply powerwindow-market --remote
```

The production API URL is:

```text
https://api.powerwindow.energy
```

The `routes` entry in `wrangler.toml` keeps that hostname attached as a Worker custom
domain.

## Persistence

Reads follow this ladder:

```text
Cloudflare KV -> Cloudflare D1 -> REE API
```

Successful REE responses are written to D1 first, then copied to KV. If KV is empty but D1
has the date, the Worker serves D1 and repopulates KV.

- Past dates are treated as stable and served from persistence indefinitely.
- Today and tomorrow are refreshed periodically, but stale persisted data is returned
  immediately while the Worker refreshes in the background.
- `refresh=1` forces a synchronous refresh for a single date.
- `/api/market/month?date=YYYY-MM-DD` returns cached day payloads from the first day of
  that month through the selected date, so clients do not fan out many date requests.

If REE is unavailable and cached data exists, the API returns the cache instead of failing
the request.

## Charger connector MVP

The first charger integration is a mock connector. It does not store real charger or car
credentials. It creates a D1-backed account, device, charge plan, and command log so the
product flow can be tested safely before adding Enode, Easee, or OCPP.

Reads and writes use these tables:

- `connector_accounts`
- `devices`
- `charge_plans`
- `charge_commands`

The mock connector supports:

- Pairing a `Mock Wallbox`
- Sending the selected Power Window as a charge schedule
- Start and stop commands
- Persisted command logs in D1

Real connector implementations should keep the same API shape and swap the provider adapter
behind the Worker. Android and the web app should never hold charger credentials directly.

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
