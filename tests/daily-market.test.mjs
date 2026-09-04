import assert from "node:assert/strict";
import test from "node:test";

import {
  bestWindow,
  dailyStats,
  formatHourRange,
  madridDate,
  parseMarketData,
} from "../shared/daily-market.mjs";
import { updateDailyLastmod } from "../shared/sitemap.mjs";

test("parseMarketData selects PVPC and averages sub-hour values", () => {
  const payload = {
    included: [
      {
        type: "Spot market price",
        attributes: { values: [{ datetime: "2026-09-04T00:00:00+02:00", value: 999 }] },
      },
      {
        type: "PVPC",
        attributes: {
          title: "PVPC",
          values: [
            { datetime: "2026-09-04T00:00:00+02:00", value: 100 },
            { datetime: "2026-09-04T00:15:00+02:00", value: 120 },
            { datetime: "2026-09-04T01:00:00+02:00", value: 80 },
          ],
        },
      },
    ],
  };

  assert.deepEqual(
    parseMarketData(payload).map(({ hour, price }) => ({ hour, price })),
    [
      { hour: 0, price: 110 },
      { hour: 1, price: 80 },
    ]
  );
});

test("dailyStats and bestWindow calculate the useful daily facts", () => {
  const points = [100, 40, 20, 60].map((price, hour) => ({
    hour,
    price,
    datetime: `2026-09-04T0${hour}:00:00+02:00`,
  }));

  const stats = dailyStats(points);
  assert.equal(stats.min.hour, 2);
  assert.equal(stats.max.hour, 0);
  assert.equal(stats.average, 55);
  assert.equal(stats.spreadPercent, 80);

  const window = bestWindow(points, 2, 1);
  assert.equal(window.start, 1);
  assert.equal(window.avgPrice, 30);
  assert.equal(window.cost, 0.06);
});

test("date and hour labels use Madrid and locale conventions", () => {
  const lateUtc = Date.parse("2026-09-04T22:30:00Z");
  assert.equal(madridDate(0, lateUtc), "2026-09-05");
  assert.equal(formatHourRange(14, 2, "es"), "14:00–16:00");
  assert.equal(formatHourRange(14, 2, "en"), "2 PM–4 PM");
});

test("tomorrow follows the Madrid calendar across the autumn DST change", () => {
  const shortlyAfterMidnight = Date.parse("2026-10-24T22:30:00Z");
  assert.equal(madridDate(0, shortlyAfterMidnight), "2026-10-25");
  assert.equal(madridDate(1, shortlyAfterMidnight), "2026-10-26");
});

test("daily sitemap dates change without touching stable pages", () => {
  const xml = `<urlset>
    <url><loc>https://powerwindow.energy/precio-luz-hoy</loc><lastmod>2026-08-18</lastmod></url>
    <url><loc>https://powerwindow.energy/methodology</loc><lastmod>2026-07-25</lastmod></url>
  </urlset>`;
  const updated = updateDailyLastmod(xml, "2026-09-04");
  assert.match(updated, /precio-luz-hoy<\/loc><lastmod>2026-09-04/);
  assert.match(updated, /methodology<\/loc><lastmod>2026-07-25/);
});
