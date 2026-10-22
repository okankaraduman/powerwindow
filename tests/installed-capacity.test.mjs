import assert from "node:assert/strict";
import test from "node:test";
import { summarizeInstalledCapacity } from "../shared/installed-capacity.mjs";
import worker from "../backend/worker/src/index.js";

const payload = { included: [
  { attributes: { title: "Wind", values: [
    { datetime: "2026-08-01T00:00:00+02:00", value: 30000 },
    { datetime: "2026-09-01T00:00:00+02:00", value: 31000 }
  ] } },
  { attributes: { title: "Solar photovoltaic", values: [
    { datetime: "2026-08-01T00:00:00+02:00", value: 21000 },
    { datetime: "2026-09-01T00:00:00+02:00", value: 22000 }
  ] } },
  { attributes: { title: "Total renewable", type: "total", values: [
    { datetime: "2026-09-01T00:00:00+02:00", value: 53000 }
  ] } },
  { attributes: { title: "Total installed capacity", type: "total", values: [
    { datetime: "2026-09-01T00:00:00+02:00", value: 53000 }
  ] } }
] };

test("capacity is a latest-date MW snapshot, not a sum across months or aggregate rows", () => {
  assert.deepEqual(summarizeInstalledCapacity(payload), {
    date: "2026-09-01", totalMw: 53000,
    technologies: [{ name: "Wind", mw: 31000 }, { name: "Solar photovoltaic", mw: 22000 }]
  });
  assert.equal(summarizeInstalledCapacity({ included: [] }), null);
});

test("capacity endpoint caches a valid snapshot and serves stale data on upstream failure", async (t) => {
  const values = new Map();
  const env = { MARKET_CACHE: {
    get: async (key) => values.get(key),
    put: async (key, value) => values.set(key, JSON.parse(value))
  } };
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.ok(String(url).includes("/generacion/potencia-instalada-generacion?"));
    assert.equal(url.searchParams.get("time_trunc"), "month");
    return Response.json(payload);
  });
  const request = (query = "") => new Request(`https://api.powerwindow.energy/api/statistics/capacity${query}`);
  const first = await (await worker.fetch(request(), env, {})).json();
  assert.equal(first.cacheStatus, "miss");
  assert.equal(first.totalMw, 53000);
  assert.equal((await (await worker.fetch(request(), env, {})).json()).cacheStatus, "hit");
  globalThis.fetch.mock.mockImplementation(async () => { throw new Error("Upstream unavailable"); });
  assert.equal((await (await worker.fetch(request("?refresh=1"), env, {})).json()).cacheStatus, "stale");
  assert.equal((await worker.fetch(new Request(request(), { method: "POST" }), env, {})).status, 405);
});
