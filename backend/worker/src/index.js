const MARKET_WIDGET = "mercados/precios-mercados-tiempo-real";
const REE_BASE_URL = "https://apidatos.ree.es/en/datos";
const TIME_ZONE = "Europe/Madrid";
const ALLOWED_ORIGINS = new Set([
  "https://powerwindow.energy",
  "https://www.powerwindow.energy"
]);

const MINUTE = 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === "/healthz") {
      return jsonResponse({ status: "ok" }, 200, request);
    }

    if (url.pathname === "/api/market") {
      return handleMarket(request, env, url, ctx);
    }

    if (url.pathname === "/api/market/month") {
      return handleMarketMonth(request, env, url, ctx);
    }

    return jsonResponse({ error: "not found" }, 404, request);
  }
};

async function handleMarket(request, env, url, ctx) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "method not allowed" }, 405, request);
  }

  if (!env.MARKET_CACHE) {
    return jsonResponse({ error: "MARKET_CACHE KV binding is not configured" }, 500, request);
  }

  const date = url.searchParams.get("date");
  if (!date) {
    return jsonResponse({ error: "missing date" }, 400, request);
  }

  if (!isValidDateValue(date)) {
    return jsonResponse({ error: "date must be YYYY-MM-DD" }, 400, request);
  }

  if (date > madridDateString(1)) {
    return jsonResponse(
      { error: "REE day-ahead data is only available through tomorrow" },
      400,
      request
    );
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";
  try {
    const result = await marketEntryForDate(env, date, { forceRefresh, ctx });
    return marketResponse(result.cacheStatus, result.entry, request);
  } catch (error) {
    return jsonResponse({ error: error.message || "REE request failed" }, 502, request);
  }
}

async function handleMarketMonth(request, env, url, ctx) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "method not allowed" }, 405, request);
  }

  if (!env.MARKET_CACHE) {
    return jsonResponse({ error: "MARKET_CACHE KV binding is not configured" }, 500, request);
  }

  const date = url.searchParams.get("date") || madridDateString(0);
  if (!isValidDateValue(date)) {
    return jsonResponse({ error: "date must be YYYY-MM-DD" }, 400, request);
  }

  if (date > madridDateString(1)) {
    return jsonResponse(
      { error: "REE day-ahead data is only available through tomorrow" },
      400,
      request
    );
  }

  const dates = monthToDateValues(date);
  const settled = await Promise.allSettled(
    dates.map(async (dateValue) => {
      const result = await marketEntryForDate(env, dateValue, { ctx });
      return {
        date: dateValue,
        cacheStatus: result.cacheStatus,
        cachedAt: result.entry.cachedAt,
        payload: result.entry.payload
      };
    })
  );
  const days = settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (!days.length) {
    const reason = settled.find((result) => result.status === "rejected")?.reason;
    return jsonResponse({ error: reason?.message || "No market data available" }, 502, request);
  }

  return jsonResponse(
    {
      source: "ree",
      cacheStatus: aggregateCacheStatus(days.map((day) => day.cacheStatus)),
      days
    },
    200,
    request
  );
}

async function marketEntryForDate(env, date, options = {}) {
  const cacheKey = `market:${date}`;
  const forceRefresh = options.forceRefresh === true;
  const ttlSeconds = cacheTtlForDate(date);
  const cached = forceRefresh ? null : await readCache(env, cacheKey);

  if (cached) {
    if (isFreshCacheEntry(cached, ttlSeconds)) {
      return { cacheStatus: "hit", entry: cached };
    }

    scheduleCacheRefresh(env, cacheKey, date, options.ctx);
    return { cacheStatus: "stale", entry: cached };
  }

  try {
    const entry = await refreshMarketCache(env, cacheKey, date);
    return { cacheStatus: "miss", entry };
  } catch (error) {
    const stale = await readCache(env, cacheKey);
    if (stale) {
      return { cacheStatus: "stale", entry: stale };
    }

    throw error;
  }
}

async function refreshMarketCache(env, cacheKey, date) {
  const payload = await fetchREE(date);
  const entry = { cachedAt: new Date().toISOString(), payload };
  await env.MARKET_CACHE.put(cacheKey, JSON.stringify(entry));
  return entry;
}

function scheduleCacheRefresh(env, cacheKey, date, ctx) {
  if (!ctx || date < madridDateString(0)) return;

  ctx.waitUntil(refreshMarketCacheWithLock(env, cacheKey, date));
}

async function refreshMarketCacheWithLock(env, cacheKey, date) {
  const lockKey = `refresh:${cacheKey}`;
  const existingLock = await env.MARKET_CACHE.get(lockKey, { type: "json" });
  if (existingLock?.startedAt && Date.now() - existingLock.startedAt < 2 * MINUTE * 1000) {
    return;
  }

  await env.MARKET_CACHE.put(
    lockKey,
    JSON.stringify({ startedAt: Date.now() }),
    { expirationTtl: 2 * MINUTE }
  );

  try {
    await refreshMarketCache(env, cacheKey, date);
  } finally {
    await env.MARKET_CACHE.delete(lockKey);
  }
}

function isFreshCacheEntry(entry, ttlSeconds) {
  if (ttlSeconds === Infinity) return true;
  return Date.now() - Date.parse(entry.cachedAt) <= ttlSeconds * 1000;
}

async function fetchREE(date) {
  const endpoint = new URL(`${REE_BASE_URL}/${MARKET_WIDGET}`);
  endpoint.searchParams.set("start_date", `${date}T00:00`);
  endpoint.searchParams.set("end_date", `${date}T23:59`);
  endpoint.searchParams.set("time_trunc", "hour");

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PowerWindow/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`REE returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length) {
    throw new Error(payload.errors[0].detail || "REE returned an error");
  }

  return payload;
}

async function readCache(env, key) {
  try {
    const value = await env.MARKET_CACHE.get(key, { type: "json" });
    if (!value?.cachedAt || !value?.payload || Number.isNaN(Date.parse(value.cachedAt))) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function marketResponse(cacheStatus, entry, request) {
  return jsonResponse(
    {
      source: "ree",
      cacheStatus,
      cachedAt: entry.cachedAt,
      payload: entry.payload
    },
    200,
    request
  );
}

function cacheTtlForDate(date) {
  const today = madridDateString(0);
  const tomorrow = madridDateString(1);

  if (date === tomorrow) return 15 * MINUTE;
  if (date === today) return 30 * MINUTE;
  if (date < today) return Infinity;
  return 5 * MINUTE;
}

function monthToDateValues(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return Array.from({ length: day }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index + 1));
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  });
}

function aggregateCacheStatus(statuses) {
  if (statuses.includes("miss")) return "miss";
  if (statuses.includes("stale")) return "stale";
  return "hit";
}

function isValidDateValue(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function madridDateString(offsetDays) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = Number(partValue(parts, "year"));
  const month = Number(partValue(parts, "month"));
  const day = Number(partValue(parts, "day"));
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));

  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function partValue(parts, type) {
  return parts.find((part) => part.type === type)?.value || "0";
}

function jsonResponse(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request)
    }
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
