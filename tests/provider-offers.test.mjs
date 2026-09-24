import assert from "node:assert/strict";
import test from "node:test";
import { getProviderOffers, parseEndesaOffers, parseNaturgyOffers, parseOctopusOffers, parseTotalEnergyOffers } from "../backend/worker/src/provider-offers.js";
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
const naturgy = `Tarifa Por Uso Luz Precios sin impuestos
  <span class="sticky-text-block__price-value"><span>0,112000</span><span class="sticky-text-block__price-unit">€/kWh</span></span>
  <p><b>P1</b> 0,123030 €/kW*día</p><p><b>P2</b> 0,061562 €/kW*día</p>`;
const endesa = `Precios sin impuestos
  <h3 class="commodity-card-xs__content__body__information__product__title">Tarifa Luz 24h Online</h3>
  <p class="commodity-card-xs__content__body__information__price__detail__info__text">T. de energía</p>
  <p class="price newprice" aria-label="Precio actual  0,128561">0,128561</p>
  <p>T. potencia hora valle</p><p class="price newprice" aria-label="Precio actual  2,849000">2,849000</p>
  <p>T. potencia hora punta-llano</p><p class="price newprice" aria-label="Precio actual  2,849000">2,849000</p>`;

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

test("Naturgy and Endesa require complete energy and power prices", () => {
  assert.equal(parseNaturgyOffers(naturgy)[0].powerDay, 0.184592);
  assert.equal(parseNaturgyOffers(naturgy)[0].maxPowerKw, 10);
  assert.equal(parseEndesaOffers(endesa)[0].flatRate, 0.128561);
  assert.ok(Math.abs(parseEndesaOffers(endesa)[0].powerDay * 30.42 - 5.698) < 0.000001);
  assert.deepEqual(parseNaturgyOffers(naturgy.replace("0,061562", "missing")), []);
  assert.deepEqual(parseEndesaOffers(endesa.replace("2,849000", "missing")), []);
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

test("daily check stores verified offers from four providers", async () => {
  let cached;
  let calls = 0;
  const env = { MARKET_CACHE: {
    async get() { return cached; },
    async put(_key, value) { cached = JSON.parse(value); },
  } };
  const now = Date.parse("2026-09-24T12:00:00Z");
  const fetcher = async (url) => {
    calls += 1;
    return { ok: true, text: async () => url.includes("octopus") ? octopus : url.includes("siempre") ? flat : url.includes("programa") ? period : url.includes("naturgy") ? naturgy : endesa };
  };
  const fresh = await getProviderOffers(env, fetcher, now);
  assert.equal(fresh.offers.length, 10);
  assert.equal(fresh.offers.find((offer) => offer.id === "totalenergies-period-2").peakRate, 0.18);
  assert.equal(fresh.offers.find((offer) => offer.id === "endesa-24h-online").flatRate, 0.128561);
  await getProviderOffers(env, fetcher, now + 60 * 60 * 1000);
  assert.equal(calls, 5);
});

test("scheduled provider check does not publish to X without its explicit flag", async () => {
  const now = Date.parse("2026-09-24T05:00:00Z");
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.ok(["octopusenergy.es", "totalenergies.es", "naturgy.es", "endesa.com"].some((domain) => String(url).includes(domain)));
    return { ok: true, text: async () => String(url).includes("octopus") ? octopus : String(url).includes("siempre") ? flat : String(url).includes("programa") ? period : String(url).includes("naturgy") ? naturgy : endesa };
  };
  try {
    await worker.scheduled({ scheduledTime: now }, { MARKET_CACHE: { async get() { return null; }, async put() {} } });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 5);
});
