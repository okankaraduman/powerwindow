import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { annualGenerationRange, annualGenerationPeriods, annualForecastPeriods, mergeAnnualGenerationPayloads, summarizeAnnualGeneration, forecastAnnualGeneration, formatGenerationKwh } from "../shared/annual-generation.mjs";
import worker from "../backend/worker/src/index.js";

const range = { startYear: 2021, endYear: 2025 };
function fixture({ startYear, endYear } = range) {
  return { included: [
    ["Wind", "Renovable", 60.125],
    ["Nuclear", "No-Renovable", 40],
    ["Fuel + Gas", "No-Renovable", -0.001],
    ["Total generation", "total", 100.124]
  ].map(([title, type, value]) => ({ attributes: {
    title, type, values: Array.from({ length: endYear - startYear + 1 }, (_, index) => ({
      datetime: `${startYear + index}-01-01T00:00:00+01:00`, value
    }))
  } })) };
}

function payloadForRequest(payload, url) {
  const startYear = Number(url.searchParams.get("start_date").slice(0, 4));
  const endYear = Number(url.searchParams.get("end_date").slice(0, 4));
  return { included: payload.included.map((item) => ({ ...item, attributes: {
    ...item.attributes, values: item.attributes.values.filter((point) => {
      const year = Number(point.datetime.slice(0, 4));
      return year >= startYear && year <= endYear;
    })
  } })) };
}

test("keeps five complete years and adds the current Madrid year through today", () => {
  assert.deepEqual(annualGenerationRange(new Date("2026-09-08T00:00:00Z")),
    { startYear: 2021, endYear: 2026, endDate: "2026-09-08" });
  assert.deepEqual(annualGenerationRange(new Date("2025-12-31T23:30:00Z")),
    { startYear: 2021, endYear: 2026, endDate: "2026-01-01" });
  assert.deepEqual(annualGenerationRange(new Date("2025-12-31T22:30:00Z")),
    { startYear: 2020, endYear: 2025, endDate: "2025-12-31" });
});

test("includes available current-year totals while keeping missing YTD data unavailable", () => {
  const ytdRange = annualGenerationRange(new Date("2026-09-08T00:00:00Z"));
  const years = summarizeAnnualGeneration(fixture(ytdRange), ytdRange);
  assert.equal(years.length, 6);
  assert.equal(years[5].year, 2026);
  assert.equal(years[5].available, true);
  const missingYtd = summarizeAnnualGeneration(fixture(), ytdRange);
  assert.equal(missingYtd.filter((year) => year.available).length, 5);
  assert.deepEqual(missingYtd[5], { year: 2026, available: false });
});

test("projects each generation type from the median historical same-date fraction", () => {
  const years = [
    { year: 2023, available: true, renewableMwh: 100, nonRenewableMwh: 80 },
    { year: 2024, available: true, renewableMwh: 120, nonRenewableMwh: 70 },
    { year: 2025, available: true, renewableMwh: 140, nonRenewableMwh: 60 },
    { year: 2026, available: true, renewableMwh: 90, nonRenewableMwh: 30 }
  ];
  const historical = [
    { year: 2023, available: true, renewableMwh: 50, nonRenewableMwh: 40 },
    { year: 2024, available: true, renewableMwh: 72, nonRenewableMwh: 42 },
    { year: 2025, available: true, renewableMwh: 98, nonRenewableMwh: 42 }
  ];
  const estimate = forecastAnnualGeneration(years, historical, 2026);
  assert.equal(estimate.renewableMwh, 150);
  assert.equal(estimate.nonRenewableMwh, 50);
  assert.equal(estimate.totalMwh, 200);
  assert.deepEqual(estimate.referenceYears, [2023, 2024, 2025]);
  assert.equal(forecastAnnualGeneration(years, historical.slice(0, 1), 2026), null);
  assert.equal(forecastAnnualGeneration(years.slice(0, 3), historical, 2026), null);
  assert.deepEqual(annualForecastPeriods({ endYear: 2024, endDate: "2024-02-29" })[0],
    { year: 2023, startDate: "2023-01-01", endDate: "2023-02-28" });
});

test("sums classifications without double-counting totals or dropping signed corrections", () => {
  const years = summarizeAnnualGeneration(fixture(), range);
  assert.equal(years.length, 5);
  assert.deepEqual(years.map((year) => year.year), [2021, 2022, 2023, 2024, 2025]);
  for (const year of years) {
    assert.equal(year.available, true);
    assert.equal(year.renewableMwh, 60.125);
    assert.equal(year.nonRenewableMwh, 39.999);
    assert.equal(year.totalMwh, 100.124);
    assert.equal(year.renewableShare + year.nonRenewableShare, 1);
  }
});

test("missing, null, duplicate, or unreconciled yearly data is unavailable, not zero", () => {
  for (const mutate of [
    (p) => p.included[0].attributes.values.shift(),
    (p) => { p.included[0].attributes.values[0].value = null; },
    (p) => { p.included[0].attributes.values[0].value = "invalid"; },
    (p) => p.included[0].attributes.values.push(p.included[0].attributes.values[0]),
    (p) => { p.included[3].attributes.values[0].value = 200; }
  ]) {
    const payload = fixture();
    mutate(payload);
    const years = summarizeAnnualGeneration(payload, range);
    assert.deepEqual(years[0], { year: 2021, available: false });
    assert.equal(years[1].available, true);
  }
  assert.ok(summarizeAnnualGeneration({}, range).every((year) => !year.available));
});

test("annual and both seasonal displays convert MWh to localized kWh", () => {
  for (const [locale, filename, expected] of [
    ["en-GB", "statistics.en.js", "1,234,567 kWh"],
    ["es-ES", "statistics.js", "1.234.567 kWh"]
  ]) {
    assert.equal(formatGenerationKwh(1234.567, locale), expected);
    const source = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8")
      .replace("initStatistics();", "");
    const context = vm.createContext({ window: { location: { hostname: "localhost" } },
      document: { querySelector: () => ({}) } });
    vm.runInContext(source, context);
    assert.equal(context.formatEnergy(1234.567), expected);
    assert.equal(context.formatEnergy(0), "0 kWh");
    assert.equal(context.formatEnergy(NaN), "--");
  }
});

test("annual endpoint caches full data and serves stale data on refresh failure", async (t) => {
  const currentRange = annualGenerationRange();
  const payload = fixture(currentRange);
  const values = new Map();
  const env = { MARKET_CACHE: {
    get: async (key) => values.get(key),
    put: async (key, value) => values.set(key, JSON.parse(value))
  } };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    calls++;
    assert.equal(url.searchParams.get("time_trunc"), "year");
    assert.ok([...annualGenerationPeriods(currentRange), ...annualForecastPeriods(currentRange)].some((period) =>
      url.searchParams.get("start_date") === `${period.startDate}T00:00` &&
      url.searchParams.get("end_date") === `${period.endDate}T23:59`));
    return Response.json(payloadForRequest(payload, url));
  });
  const request = (query = "") => new Request(`https://api.powerwindow.energy/api/statistics/years${query}`);
  const fresh = await worker.fetch(request(), env, {});
  assert.equal(fresh.status, 200);
  const freshData = await fresh.json();
  assert.equal(freshData.cacheStatus, "miss");
  assert.equal(freshData.historicalYtd.length, 3);
  assert.equal((await (await worker.fetch(request(), env, {})).json()).cacheStatus, "hit");
  assert.equal(calls, 5);
  const key = [...values.keys()][0];
  values.get(key).cachedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  assert.equal((await (await worker.fetch(request(), env, {})).json()).cacheStatus, "miss");
  assert.equal(calls, 10, "YTD cache must refresh after 30 minutes");
  values.get(key).endDate = `${currentRange.endYear}-01-01`;
  if (currentRange.endDate === values.get(key).endDate) values.get(key).endDate = `${currentRange.endYear - 1}-12-31`;
  assert.equal((await (await worker.fetch(request(), env, {})).json()).cacheStatus, "miss");
  assert.equal(calls, 15, "YTD cache must refresh when its cutoff date changes");
  globalThis.fetch.mock.mockImplementation(async () => { throw new Error("Upstream unavailable"); });
  const oldCutoff = `${currentRange.endYear}-01-01`;
  values.get(key).endDate = oldCutoff;
  const stale = await (await worker.fetch(request("?refresh=1"), env, {})).json();
  assert.equal(stale.cacheStatus, "stale");
  assert.equal(stale.endDate, oldCutoff, "Stale data must retain its actual requested cutoff");
  values.clear();
  assert.equal((await worker.fetch(request(), env, {})).status, 502);
  assert.equal((await worker.fetch(new Request(request(), { method: "POST" }), env, {})).status, 405);
});

test("incomplete annual data is returned without persisting an incomplete historical cache", async (t) => {
  const payload = fixture(annualGenerationRange());
  payload.included[0].attributes.values.shift();
  t.mock.method(globalThis, "fetch", async (url) => Response.json(payloadForRequest(payload, url)));
  const env = { MARKET_CACHE: {
    get: async () => null,
    put: async () => assert.fail("Incomplete data must not be cached")
  } };
  const response = await worker.fetch(new Request("https://api.powerwindow.energy/api/statistics/years"), env, {});
  assert.equal(response.status, 200);
});

test("splits historical and current-year requests and merges all six years", () => {
  const ytdRange = annualGenerationRange(new Date("2026-09-08T00:00:00Z"));
  assert.deepEqual(annualGenerationPeriods(ytdRange), [
    { startDate: "2021-01-01", endDate: "2025-12-31" },
    { startDate: "2026-01-01", endDate: "2026-09-08" }
  ]);
  const historical = fixture();
  const current = fixture({ startYear: 2026, endYear: 2026 });
  const merged = mergeAnnualGenerationPayloads([historical, current]);
  assert.equal(summarizeAnnualGeneration(merged, ytdRange).filter((year) => year.available).length, 6);
  assert.equal(historical.included[0].attributes.values.length, 5, "Merge must not mutate cached payloads");
});

test("current-year upstream failure preserves completed years without caching partial data", async (t) => {
  const currentRange = annualGenerationRange();
  const payload = fixture(currentRange);
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.searchParams.get("start_date").startsWith(String(currentRange.endYear))) throw new Error("YTD unavailable");
    return Response.json(payloadForRequest(payload, url));
  });
  const response = await worker.fetch(new Request("https://api.powerwindow.energy/api/statistics/years"), {
    MARKET_CACHE: { get: async () => null, put: async () => assert.fail("Must not cache missing YTD") }
  }, {});
  assert.equal(response.status, 200);
  const years = summarizeAnnualGeneration((await response.json()).payload, currentRange);
  assert.equal(years.filter((year) => year.available).length, 5);
  assert.equal(years[5].available, false);
});
