import assert from "node:assert/strict";
import test from "node:test";
import { getProviderOffers, parseOctopusOffers, parseTotalEnergyOffers } from "../backend/worker/src/provider-offers.js";
import worker from "../backend/worker/src/index.js";

const octopus = ["OCTORELAX", "OCTO3"].map((code, index) => JSON.stringify({
  code: `${code}-2026-W39`,
  prices: { fixedTerm: [0.12, 0.12], variableTerm: index ? [0.165, 0.125, 0.111] : [0.129, 0.129, 0.129] },
})).join("");

function totalPage(marker, values) {
  return values.map((row) => `<strong>Precios Luz A tu Aire ${marker} sin impuestos</strong><table><tbody><tr><td>Potencia ≤ 10 kW</td>${row.map((value) => `<td>${value}</td>`).join("")}</tr></tbody></table>`).join("");
}
const flat = totalPage("Siempre", [[0.08, 0.08, 0.10], [0.09, 0.09, 0.11], [0.10, 0.10, 0.12]]);
const period = totalPage("Ahorro", [[0.08, 0.08, 0.16, 0.10, 0.07], [0.09, 0.09, 0.17, 0.11, 0.08], [0.10, 0.10, 0.18, 0.12, 0.09]]);

test("provider parsers keep source prices and annual usage tiers", () => {
  assert.equal(parseOctopusOffers(octopus).length, 2);
  const offers = parseTotalEnergyOffers(flat, period);
  assert.equal(offers.length, 6);
  assert.equal(offers[5].peakRate, 0.18);
  assert.equal(offers[5].minAnnualKwh, 5000);
  assert.equal(offers[5].maxAnnualKwh, null);
});

test("incomplete provider markup yields no offers", () => {
  assert.equal(parseOctopusOffers(octopus.replace("0.111", "null")).length, 1);
  assert.equal(parseTotalEnergyOffers(flat, "").length, 3);
});

test("old cached offers disappear when provider fetch fails", async () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  const env = { MARKET_CACHE: {
    async get() { return { checkedAt: "2026-09-20T00:00:00Z", offers: [{ id: "old", checkedAt: "2026-09-20T00:00:00Z" }] }; },
    async put() {},
  } };
  const result = await getProviderOffers(env, async () => ({ ok: false }), now);
  assert.deepEqual(result.offers, []);
});

test("daily check stores verified offers from two provider pages", async () => {
  let cached;
  let calls = 0;
  const env = { MARKET_CACHE: {
    async get() { return cached; },
    async put(_key, value) { cached = JSON.parse(value); },
  } };
  const now = Date.parse("2026-09-24T12:00:00Z");
  const fetcher = async (url) => {
    calls += 1;
    return { ok: true, text: async () => url.includes("octopus") ? octopus : url.includes("siempre") ? flat : period };
  };
  const fresh = await getProviderOffers(env, fetcher, now);
  assert.equal(fresh.offers.length, 8);
  assert.equal(fresh.offers.find((offer) => offer.id === "totalenergies-period-2").peakRate, 0.18);
  await getProviderOffers(env, fetcher, now + 60 * 60 * 1000);
  assert.equal(calls, 3);
});

test("scheduled provider check does not publish to X without its explicit flag", async () => {
  const now = Date.parse("2026-09-24T05:00:00Z");
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.ok(String(url).includes("octopusenergy.es") || String(url).includes("totalenergies.es"));
    return { ok: true, text: async () => String(url).includes("octopus") ? octopus : String(url).includes("siempre") ? flat : period };
  };
  try {
    await worker.scheduled({ scheduledTime: now }, { MARKET_CACHE: { async get() { return null; }, async put() {} } });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 3);
});
