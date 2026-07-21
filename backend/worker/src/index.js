const MARKET_WIDGET = "mercados/precios-mercados-tiempo-real";
const GENERATION_WIDGET = "generacion/estructura-generacion";
const REE_BASE_URL = "https://apidatos.ree.es/en/datos";
const TIME_ZONE = "Europe/Madrid";
const ALLOWED_ORIGINS = new Set([
  "https://powerwindow.energy",
  "https://www.powerwindow.energy"
]);
const REE_RANGE_CHUNK_DAYS = 30;

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

    if (url.pathname === "/api/generation") {
      return handleGeneration(request, env, url, ctx);
    }

    if (url.pathname === "/api/statistics/seasons") {
      return handleSeasonStatistics(request, env, url, ctx);
    }

    if (url.pathname === "/api/connectors") {
      return handleConnectors(request);
    }

    if (url.pathname === "/api/connectors/mock/pair") {
      return handleMockPair(request, env);
    }

    if (url.pathname === "/api/devices") {
      return handleDevices(request, env, url);
    }

    if (url.pathname === "/api/charge-plans") {
      return handleChargePlans(request, env);
    }

    const commandMatch = url.pathname.match(/^\/api\/devices\/([^/]+)\/commands$/);
    if (commandMatch) {
      return handleDeviceCommand(request, env, commandMatch[1]);
    }

    return jsonResponse({ error: "ruta no encontrada" }, 404, request);
  }
};

async function handleConnectors(request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  return jsonResponse(
    {
      connectors: [
        {
          id: "mock",
          name: "Wallbox demo",
          status: "available",
          capabilities: ["schedule", "start", "stop"],
          credentialMode: "none"
        }
      ]
    },
    200,
    request
  );
}

async function handleMockPair(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = connectorBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const body = await readJsonBody(request);
  const userId = normalizeUserId(body.userId);
  if (!userId) {
    return jsonResponse({ error: "falta userId" }, 400, request);
  }

  const existing = await firstDeviceForProvider(env, userId, "mock");
  if (existing) {
    return jsonResponse({ account: null, device: existing, reused: true }, 200, request);
  }

  const now = new Date().toISOString();
  const account = {
    id: newId("acct"),
    userId,
    provider: "mock",
    externalAccountId: `mock-account:${userId}`,
    displayName: "Entorno de pruebas de Power Window",
    status: "connected",
    createdAt: now,
    updatedAt: now,
    metadata: { credentialMode: "none", sandbox: true }
  };
  const device = {
    id: newId("dev"),
    connectorAccountId: account.id,
    userId,
    provider: "mock",
    externalDeviceId: `mock-wallbox:${userId}`,
    displayName: cleanText(body.displayName, 60) || "Wallbox demo",
    kind: "charger",
    status: "available",
    maxKw: clampNumber(body.maxKw, 1, 22, 7.4),
    createdAt: now,
    updatedAt: now,
    metadata: {
      capabilities: ["schedule", "start", "stop"],
      connector: "mock"
    }
  };

  await env.MARKET_DB.prepare(
    `INSERT INTO connector_accounts (
      id, user_id, provider, external_account_id, display_name, status,
      created_at, updated_at, metadata_json
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  )
    .bind(
      account.id,
      account.userId,
      account.provider,
      account.externalAccountId,
      account.displayName,
      account.status,
      account.createdAt,
      account.updatedAt,
      JSON.stringify(account.metadata)
    )
    .run();

  await insertDevice(env, device);

  return jsonResponse({ account, device, reused: false }, 201, request);
}

async function handleDevices(request, env, url) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = connectorBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const userId = normalizeUserId(url.searchParams.get("userId"));
  if (!userId) {
    return jsonResponse({ error: "falta userId" }, 400, request);
  }

  const { results } = await env.MARKET_DB.prepare(
    `SELECT * FROM devices
      WHERE user_id = ?1
      ORDER BY created_at DESC`
  )
    .bind(userId)
    .all();

  return jsonResponse({ devices: results.map(rowToDevice) }, 200, request);
}

async function handleChargePlans(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = connectorBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const body = await readJsonBody(request);
  const userId = normalizeUserId(body.userId);
  if (!userId) {
    return jsonResponse({ error: "falta userId" }, 400, request);
  }

  const device = await deviceForUser(env, cleanText(body.deviceId, 80), userId);
  if (!device) {
    return jsonResponse({ error: "dispositivo no encontrado" }, 404, request);
  }

  if (!isValidDateValue(body.date || "")) {
    return jsonResponse({ error: "la fecha debe tener formato YYYY-MM-DD" }, 400, request);
  }

  const startHour = clampInteger(body.startHour, 0, 23, null);
  const durationHours = clampInteger(body.durationHours, 1, 12, null);
  if (startHour === null || durationHours === null || startHour + durationHours > 24) {
    return jsonResponse({ error: "franja de carga no válida" }, 400, request);
  }

  const now = new Date().toISOString();
  const plan = {
    id: newId("plan"),
    userId,
    deviceId: device.id,
    date: body.date,
    startHour,
    durationHours,
    targetKwh: clampNumber(body.targetKwh, 0.1, 150, 0),
    chargerKw: clampNumber(body.chargerKw, 1, 22, device.maxKw || 7.4),
    windowLabel: cleanText(body.windowLabel, 40) || `${startHour}:00`,
    estimatedCost: clampNumber(body.estimatedCost, 0, 1000, 0),
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
    metadata: safeObject(body.metadata)
  };

  const command = {
    id: newId("cmd"),
    userId,
    deviceId: device.id,
    planId: plan.id,
    provider: device.provider,
    command: "set_schedule",
    status: "accepted",
    requestedAt: now,
    completedAt: now,
    request: {
      date: plan.date,
      startHour: plan.startHour,
      durationHours: plan.durationHours,
      targetKwh: plan.targetKwh,
      chargerKw: plan.chargerKw
    },
    response: {
      connector: device.provider,
      message: "Programación demo aceptada",
      windowLabel: plan.windowLabel
    }
  };

  await env.MARKET_DB.prepare(
    `INSERT INTO charge_plans (
      id, user_id, device_id, date, start_hour, duration_hours, target_kwh,
      charger_kw, window_label, estimated_cost, status, created_at, updated_at, metadata_json
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
  )
    .bind(
      plan.id,
      plan.userId,
      plan.deviceId,
      plan.date,
      plan.startHour,
      plan.durationHours,
      plan.targetKwh,
      plan.chargerKw,
      plan.windowLabel,
      plan.estimatedCost,
      plan.status,
      plan.createdAt,
      plan.updatedAt,
      JSON.stringify(plan.metadata)
    )
    .run();

  await insertCommand(env, command);
  await updateDeviceStatus(env, device.id, userId, "scheduled", {
    ...device.metadata,
    lastPlanId: plan.id,
    nextWindow: plan.windowLabel
  });
  const updatedDevice = await deviceForUser(env, device.id, userId);

  return jsonResponse({ plan, command, device: updatedDevice }, 201, request);
}

async function handleDeviceCommand(request, env, deviceId) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = connectorBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const body = await readJsonBody(request);
  const userId = normalizeUserId(body.userId);
  if (!userId) {
    return jsonResponse({ error: "falta userId" }, 400, request);
  }

  const commandName = cleanText(body.command, 32);
  const nextStatusByCommand = {
    start: "charging",
    stop: "available",
    pause: "paused",
    resume: "charging"
  };
  const nextStatus = nextStatusByCommand[commandName];
  if (!nextStatus) {
    return jsonResponse({ error: "comando no compatible" }, 400, request);
  }

  const device = await deviceForUser(env, cleanText(deviceId, 80), userId);
  if (!device) {
    return jsonResponse({ error: "dispositivo no encontrado" }, 404, request);
  }

  const now = new Date().toISOString();
  const command = {
    id: newId("cmd"),
    userId,
    deviceId: device.id,
    planId: null,
    provider: device.provider,
    command: commandName,
    status: "accepted",
    requestedAt: now,
    completedAt: now,
    request: safeObject(body),
    response: {
      connector: device.provider,
      message: `Comando demo ${commandName} aceptado`
    }
  };

  await insertCommand(env, command);
  await updateDeviceStatus(env, device.id, userId, nextStatus, {
    ...device.metadata,
    lastCommandId: command.id
  });
  const updatedDevice = await deviceForUser(env, device.id, userId);

  return jsonResponse({ command, device: updatedDevice }, 202, request);
}

async function handleMarket(request, env, url, ctx) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = marketBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const date = url.searchParams.get("date");
  if (!date) {
    return jsonResponse({ error: "falta fecha" }, 400, request);
  }

  if (!isValidDateValue(date)) {
    return jsonResponse({ error: "la fecha debe tener formato YYYY-MM-DD" }, 400, request);
  }

  if (date > madridDateString(1)) {
    return jsonResponse(
      { error: "los datos REE de precios diarios solo están disponibles hasta mañana" },
      400,
      request
    );
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";
  try {
    const result = await marketEntryForDate(env, date, { forceRefresh, ctx });
    return marketResponse(result.cacheStatus, result.entry, request);
  } catch (error) {
    return jsonResponse({ error: error.message || "la solicitud a REE ha fallado" }, 502, request);
  }
}

async function handleMarketMonth(request, env, url, ctx) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = marketBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const date = url.searchParams.get("date") || madridDateString(0);
  if (!isValidDateValue(date)) {
    return jsonResponse({ error: "la fecha debe tener formato YYYY-MM-DD" }, 400, request);
  }

  if (date > madridDateString(1)) {
    return jsonResponse(
      { error: "los datos REE de precios diarios solo están disponibles hasta mañana" },
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
    return jsonResponse({ error: reason?.message || "no hay datos de mercado disponibles" }, 502, request);
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

async function handleGeneration(request, env, url, ctx) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = marketBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const date = url.searchParams.get("date") || madridDateString(0);
  if (!isValidDateValue(date)) {
    return jsonResponse({ error: "la fecha debe tener formato YYYY-MM-DD" }, 400, request);
  }

  if (date > madridDateString(0)) {
    return jsonResponse(
      { error: "los datos REE del mix de generación solo están disponibles hasta hoy" },
      400,
      request
    );
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";
  try {
    const result = await generationEntryForDate(env, date, { forceRefresh, ctx });
    return jsonResponse(
      {
        source: "ree",
        cacheStatus: result.cacheStatus,
        cachedAt: result.entry.cachedAt,
        payload: result.entry.payload
      },
      200,
      request
    );
  } catch (error) {
    return jsonResponse({ error: error.message || "la solicitud a REE ha fallado" }, 502, request);
  }
}

async function handleSeasonStatistics(request, env, url, ctx) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "método no permitido" }, 405, request);
  }

  const bindingError = marketBindingError(env);
  if (bindingError) {
    return jsonResponse({ error: bindingError }, 500, request);
  }

  const date = url.searchParams.get("date") || madridDateString(0);
  if (!isValidDateValue(date)) {
    return jsonResponse({ error: "la fecha debe tener formato YYYY-MM-DD" }, 400, request);
  }

  if (date > madridDateString(0)) {
    return jsonResponse({ error: "las estadísticas estacionales solo llegan hasta hoy" }, 400, request);
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";
  try {
    const ranges = seasonRangesForDate(date);
    const result = await seasonStatisticsEntry(env, ranges, { forceRefresh, ctx });
    return jsonResponse(
      {
        source: "ree",
        cacheStatus: result.cacheStatus,
        cachedAt: result.entry.cachedAt,
        seasons: result.entry.payload.seasons
      },
      200,
      request
    );
  } catch (error) {
    return jsonResponse({ error: error.message || "la solicitud a REE ha fallado" }, 502, request);
  }
}

async function seasonStatisticsEntry(env, ranges, options = {}) {
  const cacheKey = `statistics:seasons:${ranges
    .map((range) => `${range.id}:${range.startDate}:${range.endDate}`)
    .join(":")}`;
  const forceRefresh = options.forceRefresh === true;
  const ttlSeconds = seasonStatisticsCacheTtl(ranges);
  const cached = forceRefresh ? null : await readCache(env, cacheKey);

  if (cached) {
    if (isFreshCacheEntry(cached, ttlSeconds)) {
      return { cacheStatus: "hit", entry: cached };
    }

    scheduleSeasonStatisticsRefresh(env, cacheKey, ranges, options.ctx);
    return { cacheStatus: "stale", entry: cached };
  }

  const entry = await refreshSeasonStatistics(env, cacheKey, ranges);
  return { cacheStatus: "miss", entry };
}

async function refreshSeasonStatistics(env, cacheKey, ranges) {
  const seasons = await Promise.all(
    ranges.map(async (range) => {
      const [marketPayload, generationPayload] = await Promise.all([
        fetchREEChunkedRangeWidget(MARKET_WIDGET, range.startDate, range.endDate, "hour"),
        fetchREEChunkedRangeWidget(GENERATION_WIDGET, range.startDate, range.endDate, "day")
      ]);

      return {
        ...range,
        market: {
          cachedAt: new Date().toISOString(),
          payload: marketPayload
        },
        generation: {
          cachedAt: new Date().toISOString(),
          payload: generationPayload
        }
      };
    })
  );
  const entry = { cachedAt: new Date().toISOString(), payload: { seasons } };
  await writeCache(env, cacheKey, entry);
  return entry;
}

function scheduleSeasonStatisticsRefresh(env, cacheKey, ranges, ctx) {
  if (!ctx) return;
  if (seasonStatisticsCacheTtl(ranges) === Infinity) return;
  ctx.waitUntil(refreshSeasonStatisticsWithLock(env, cacheKey, ranges));
}

async function refreshSeasonStatisticsWithLock(env, cacheKey, ranges) {
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
    await refreshSeasonStatistics(env, cacheKey, ranges);
  } finally {
    await env.MARKET_CACHE.delete(lockKey);
  }
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

  const stored = forceRefresh ? null : await readDatabase(env, date);
  if (stored) {
    await writeCache(env, cacheKey, stored);
    if (!isFreshCacheEntry(stored, ttlSeconds)) {
      scheduleCacheRefresh(env, cacheKey, date, options.ctx);
    }
    return { cacheStatus: "database", entry: stored };
  }

  try {
    const entry = await refreshMarketData(env, cacheKey, date);
    return { cacheStatus: "miss", entry };
  } catch (error) {
    const stale = await readCache(env, cacheKey);
    if (stale) {
      return { cacheStatus: "stale", entry: stale };
    }

    const storedFallback = await readDatabase(env, date);
    if (storedFallback) {
      await writeCache(env, cacheKey, storedFallback);
      return { cacheStatus: "database", entry: storedFallback };
    }

    throw error;
  }
}

async function refreshMarketData(env, cacheKey, date) {
  const payload = await fetchREE(date);
  const entry = { cachedAt: new Date().toISOString(), payload };
  await writeDatabase(env, date, entry);
  await writeCache(env, cacheKey, entry);
  return entry;
}

function scheduleCacheRefresh(env, cacheKey, date, ctx) {
  if (!ctx || date < madridDateString(0)) return;

  ctx.waitUntil(refreshMarketDataWithLock(env, cacheKey, date));
}

async function refreshMarketDataWithLock(env, cacheKey, date) {
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
    await refreshMarketData(env, cacheKey, date);
  } finally {
    await env.MARKET_CACHE.delete(lockKey);
  }
}

async function generationEntryForDate(env, date, options = {}) {
  const cacheKey = `generation:${date}`;
  const forceRefresh = options.forceRefresh === true;
  const ttlSeconds = generationCacheTtlForDate(date);
  const cached = forceRefresh ? null : await readCache(env, cacheKey);

  if (cached) {
    if (isFreshCacheEntry(cached, ttlSeconds)) {
      return { cacheStatus: "hit", entry: cached };
    }

    scheduleGenerationCacheRefresh(env, cacheKey, date, options.ctx);
    return { cacheStatus: "stale", entry: cached };
  }

  const stored = forceRefresh ? null : await readDailyPayload(env, "generation", date);
  if (stored) {
    await writeCache(env, cacheKey, stored);
    if (!isFreshCacheEntry(stored, ttlSeconds)) {
      scheduleGenerationCacheRefresh(env, cacheKey, date, options.ctx);
    }
    return { cacheStatus: "database", entry: stored };
  }

  try {
    const entry = await refreshGenerationData(env, cacheKey, date);
    return { cacheStatus: "miss", entry };
  } catch (error) {
    const stale = await readCache(env, cacheKey);
    if (stale) {
      return { cacheStatus: "stale", entry: stale };
    }

    const storedFallback = await readDailyPayload(env, "generation", date);
    if (storedFallback) {
      await writeCache(env, cacheKey, storedFallback);
      return { cacheStatus: "database", entry: storedFallback };
    }

    throw error;
  }
}

async function refreshGenerationData(env, cacheKey, date) {
  const payload = await fetchREEGeneration(date);
  const entry = { cachedAt: new Date().toISOString(), payload };
  await writeDailyPayload(env, "generation", date, entry);
  await writeCache(env, cacheKey, entry);
  return entry;
}

function scheduleGenerationCacheRefresh(env, cacheKey, date, ctx) {
  if (!ctx || date < madridDateString(0)) return;

  ctx.waitUntil(refreshGenerationDataWithLock(env, cacheKey, date));
}

async function refreshGenerationDataWithLock(env, cacheKey, date) {
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
    await refreshGenerationData(env, cacheKey, date);
  } finally {
    await env.MARKET_CACHE.delete(lockKey);
  }
}

function isFreshCacheEntry(entry, ttlSeconds) {
  if (ttlSeconds === Infinity) return true;
  return Date.now() - Date.parse(entry.cachedAt) <= ttlSeconds * 1000;
}

async function fetchREE(date) {
  return fetchREERangeWidget(MARKET_WIDGET, date, date, "hour");
}

async function fetchREEGeneration(date) {
  return fetchREEWidget(GENERATION_WIDGET, date, "day");
}

async function fetchREEWidget(widget, date, timeTrunc) {
  return fetchREERangeWidget(widget, date, date, timeTrunc);
}

async function fetchREEChunkedRangeWidget(widget, startDate, endDate, timeTrunc) {
  const chunks = chunkDateRange(startDate, endDate, REE_RANGE_CHUNK_DAYS);
  const payloads = [];
  for (const chunk of chunks) {
    payloads.push(await fetchREERangeWidget(widget, chunk.startDate, chunk.endDate, timeTrunc));
  }
  return mergeREEPayloads(payloads);
}

async function fetchREERangeWidget(widget, startDate, endDate, timeTrunc) {
  const endpoint = new URL(`${REE_BASE_URL}/${widget}`);
  endpoint.searchParams.set("start_date", `${startDate}T00:00`);
  endpoint.searchParams.set("end_date", `${endDate}T23:59`);
  endpoint.searchParams.set("time_trunc", timeTrunc);

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

function mergeREEPayloads(payloads) {
  const validPayloads = payloads.filter(Boolean);
  if (validPayloads.length <= 1) return validPayloads[0] || {};

  const first = validPayloads[0];
  const series = new Map();
  validPayloads.forEach((payload) => {
    const included = Array.isArray(payload.included) ? payload.included : [];
    included.forEach((item) => {
      const key = `${item.type || ""}:${item.id || ""}:${item.attributes?.title || ""}`;
      const existing = series.get(key);
      const values = Array.isArray(item.attributes?.values) ? item.attributes.values : [];
      if (existing) {
        existing.attributes.values.push(...values);
        return;
      }

      series.set(key, {
        ...item,
        attributes: {
          ...(item.attributes || {}),
          values: [...values]
        }
      });
    });
  });

  const lastUpdate = latestIso(
    validPayloads
      .map((payload) => payload.data?.attributes?.["last-update"])
      .filter(Boolean)
  );

  return {
    ...first,
    data: {
      ...(first.data || {}),
      attributes: {
        ...(first.data?.attributes || {}),
        ...(lastUpdate ? { "last-update": lastUpdate } : {})
      }
    },
    included: Array.from(series.values()).map((item) => ({
      ...item,
      attributes: {
        ...(item.attributes || {}),
        values: dedupeValuesByDatetime(item.attributes?.values || [])
      }
    }))
  };
}

function dedupeValuesByDatetime(values) {
  const byDatetime = new Map();
  values.forEach((value) => {
    if (!value?.datetime) return;
    byDatetime.set(value.datetime, value);
  });
  return Array.from(byDatetime.values()).sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime))
  );
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

async function writeCache(env, key, entry) {
  await env.MARKET_CACHE.put(key, JSON.stringify(entry));
}

async function readDatabase(env, date) {
  try {
    const row = await env.MARKET_DB.prepare(
      "SELECT cached_at, payload_json FROM market_days WHERE date = ?1"
    )
      .bind(date)
      .first();

    if (!row?.cached_at || !row?.payload_json || Number.isNaN(Date.parse(row.cached_at))) {
      return null;
    }

    return {
      cachedAt: row.cached_at,
      payload: JSON.parse(row.payload_json)
    };
  } catch {
    return null;
  }
}

async function writeDatabase(env, date, entry) {
  await env.MARKET_DB.prepare(
    `INSERT INTO market_days (date, cached_at, payload_json, updated_at)
      VALUES (?1, ?2, ?3, ?2)
      ON CONFLICT(date) DO UPDATE SET
        cached_at = excluded.cached_at,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at`
  )
    .bind(date, entry.cachedAt, JSON.stringify(entry.payload))
    .run();
}

async function readDailyPayload(env, kind, date) {
  try {
    const row = await env.MARKET_DB.prepare(
      "SELECT cached_at, payload_json FROM ree_daily_payloads WHERE kind = ?1 AND date = ?2"
    )
      .bind(kind, date)
      .first();

    if (!row?.cached_at || !row?.payload_json || Number.isNaN(Date.parse(row.cached_at))) {
      return null;
    }

    return {
      cachedAt: row.cached_at,
      payload: JSON.parse(row.payload_json)
    };
  } catch {
    return null;
  }
}

async function writeDailyPayload(env, kind, date, entry) {
  try {
    await env.MARKET_DB.prepare(
      `INSERT INTO ree_daily_payloads (kind, date, cached_at, payload_json, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?3)
        ON CONFLICT(kind, date) DO UPDATE SET
          cached_at = excluded.cached_at,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at`
    )
      .bind(kind, date, entry.cachedAt, JSON.stringify(entry.payload))
      .run();
  } catch {
    // The endpoint can still serve from KV if the generic D1 table has not been migrated yet.
  }
}

async function firstDeviceForProvider(env, userId, provider) {
  const row = await env.MARKET_DB.prepare(
    `SELECT * FROM devices
      WHERE user_id = ?1 AND provider = ?2
      ORDER BY created_at DESC
      LIMIT 1`
  )
    .bind(userId, provider)
    .first();

  return row ? rowToDevice(row) : null;
}

async function deviceForUser(env, deviceId, userId) {
  if (!deviceId) return null;
  const row = await env.MARKET_DB.prepare(
    `SELECT * FROM devices
      WHERE id = ?1 AND user_id = ?2
      LIMIT 1`
  )
    .bind(deviceId, userId)
    .first();

  return row ? rowToDevice(row) : null;
}

async function insertDevice(env, device) {
  await env.MARKET_DB.prepare(
    `INSERT INTO devices (
      id, connector_account_id, user_id, provider, external_device_id,
      display_name, kind, status, max_kw, metadata_json, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
  )
    .bind(
      device.id,
      device.connectorAccountId,
      device.userId,
      device.provider,
      device.externalDeviceId,
      device.displayName,
      device.kind,
      device.status,
      device.maxKw,
      JSON.stringify(device.metadata || {}),
      device.createdAt,
      device.updatedAt
    )
    .run();
}

async function updateDeviceStatus(env, deviceId, userId, status, metadata) {
  await env.MARKET_DB.prepare(
    `UPDATE devices
      SET status = ?1, metadata_json = ?2, updated_at = ?3
      WHERE id = ?4 AND user_id = ?5`
  )
    .bind(status, JSON.stringify(metadata || {}), new Date().toISOString(), deviceId, userId)
    .run();
}

async function insertCommand(env, command) {
  await env.MARKET_DB.prepare(
    `INSERT INTO charge_commands (
      id, user_id, device_id, plan_id, provider, command, status,
      requested_at, completed_at, request_json, response_json
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  )
    .bind(
      command.id,
      command.userId,
      command.deviceId,
      command.planId,
      command.provider,
      command.command,
      command.status,
      command.requestedAt,
      command.completedAt,
      JSON.stringify(command.request || {}),
      JSON.stringify(command.response || {})
    )
    .run();
}

function rowToDevice(row) {
  return {
    id: row.id,
    connectorAccountId: row.connector_account_id,
    userId: row.user_id,
    provider: row.provider,
    externalDeviceId: row.external_device_id,
    displayName: row.display_name,
    kind: row.kind,
    status: row.status,
    maxKw: Number(row.max_kw),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: parseJsonObject(row.metadata_json)
  };
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

function generationCacheTtlForDate(date) {
  const today = madridDateString(0);
  if (date === today) return 30 * MINUTE;
  if (date < today) return Infinity;
  return 5 * MINUTE;
}

function seasonStatisticsCacheTtl(ranges) {
  const today = madridDateString(0);
  return ranges.some((range) => range.endDate >= today) ? 30 * MINUTE : Infinity;
}

function seasonRangesForDate(dateValue) {
  const { year, month } = parseDateParts(dateValue);
  const summerYear = month < 6 ? year - 1 : year;
  const summerStart = dateFromParts(summerYear, 6, 1);
  const summerNaturalEnd = dateFromParts(summerYear, 8, 31);
  const summerEnd =
    dateValue >= summerStart && dateValue < summerNaturalEnd ? dateValue : summerNaturalEnd;

  let winterStart;
  let winterEnd;
  if (month === 12) {
    winterStart = dateFromParts(year, 12, 1);
    winterEnd = dateValue;
  } else if (month <= 2) {
    winterStart = dateFromParts(year - 1, 12, 1);
    winterEnd = dateValue;
  } else {
    winterStart = dateFromParts(year - 1, 12, 1);
    winterEnd = dateFromParts(year, 2, lastDayOfMonth(year, 2));
  }

  return [
    {
      id: "summer",
      startDate: summerStart,
      endDate: summerEnd,
      complete: summerEnd === summerNaturalEnd
    },
    {
      id: "winter",
      startDate: winterStart,
      endDate: winterEnd,
      complete: month > 2 && month < 12
    }
  ];
}

function chunkDateRange(startDate, endDate, maxDays) {
  const chunks = [];
  let cursor = dateToEpochDay(startDate);
  const end = dateToEpochDay(endDate);

  while (cursor <= end) {
    const chunkEnd = Math.min(end, cursor + maxDays - 1);
    chunks.push({
      startDate: epochDayToDate(cursor),
      endDate: epochDayToDate(chunkEnd)
    });
    cursor = chunkEnd + 1;
  }

  return chunks;
}

function dateToEpochDay(value) {
  const { year, month, day } = parseDateParts(value);
  return Math.floor(Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000));
}

function epochDayToDate(epochDay) {
  const date = new Date(epochDay * 24 * 60 * 60 * 1000);
  return dateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseDateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function dateFromParts(year, month, day) {
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function latestIso(values) {
  return values
    .filter((value) => value && !Number.isNaN(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "";
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
  if (statuses.includes("database")) return "database";
  return "hit";
}

function marketBindingError(env) {
  const missing = [];
  if (!env.MARKET_CACHE) missing.push("MARKET_CACHE KV");
  if (!env.MARKET_DB) missing.push("MARKET_DB D1");
  if (!missing.length) return "";
  return `binding ${missing.join(" y ")} sin configurar`;
}

function connectorBindingError(env) {
  return env.MARKET_DB ? "" : "binding MARKET_DB D1 sin configurar";
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeUserId(value) {
  const cleaned = cleanText(value, 80);
  return /^[A-Za-z0-9:_-]{8,80}$/.test(cleaned) ? cleaned : "";
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function safeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return safeObject(parsed);
  } catch {
    return {};
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
