# Power Window API

Go backend for Power Window. It wraps the REData market endpoint and persists responses by
date in a JSON cache file.

## Local run

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

## Environment

```text
PORT=8080
CACHE_PATH=data/market-cache.json
ALLOWED_ORIGINS=*
REE_BASE_URL=https://apidatos.ree.es/en/datos
TIMEZONE=Europe/Madrid
```

## Cache TTL

- Tomorrow: 15 minutes
- Today: 30 minutes
- Past dates: 30 days

If REE is unavailable and stale cached data exists, the API returns the stale cache instead
of failing the request.

## Cloudflare Containers

Cloudflare's standard Pages Functions and Workers runtime are JavaScript/TypeScript based.
For this Go backend, use Cloudflare Containers on a Workers Paid plan.

```sh
cd backend
npm install
npx wrangler login
npx wrangler deploy
```

After deploy, add a Worker route for:

```text
powerwindow.energy/api/*
```

The frontend calls `/api/market`, so keeping the API on the same domain avoids extra CORS
configuration. The Worker wrapper forwards `/api/*` and `/healthz` into the Go container.

Cloudflare Containers are started and controlled by a Worker. The Go process stores cache
data in `CACHE_PATH`. For stricter durability across container replacement and multiple
instances, the next step is moving the cache store to Cloudflare KV, D1, or Durable Object
storage.
