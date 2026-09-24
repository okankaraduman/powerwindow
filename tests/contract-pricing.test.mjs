import assert from "node:assert/strict";
import test from "node:test";
import { contractRate } from "../shared/contract-pricing.mjs";

const rates = { flat: "0.15", peak: "0.24", mid: "0.16", valley: "0.09" };

test("flat contracts never gain a cheaper hour", () => {
  assert.equal(contractRate("flat", rates, "2026-09-24", 2), 0.15);
  assert.equal(contractRate("flat", rates, "2026-09-24", 20), 0.15);
});

test("three-period contract uses weekday hours and weekend valley", () => {
  assert.equal(contractRate("period", rates, "2026-09-24", 2), 0.09);
  assert.equal(contractRate("period", rates, "2026-09-24", 9), 0.16);
  assert.equal(contractRate("period", rates, "2026-09-24", 12), 0.24);
  assert.equal(contractRate("period", rates, "2026-09-26", 12), 0.09);
});

test("missing contract prices do not silently become zero", () => {
  assert.equal(contractRate("unknown", rates, "2026-09-24", 12), null);
  assert.equal(contractRate("flat", { flat: "" }, "2026-09-24", 12), null);
  assert.equal(contractRate("period", { ...rates, peak: "" }, "2026-09-24", 12), null);
  assert.equal(contractRate("hourly", rates, "2026-09-24", 12, 0.17), 0.17);
});
