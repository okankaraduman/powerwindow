import assert from "node:assert/strict";
import test from "node:test";

import { APPLIANCES, CATALOG_METADATA, VEHICLE_BRANDS } from "../data/catalog.mjs";

test("catalog keeps the existing planner coverage in one source", () => {
  const vehicles = Object.entries(VEHICLE_BRANDS).flatMap(([brand, models]) =>
    models.map((model) => ({ brand, ...model }))
  );

  assert.equal(APPLIANCES.length, 9);
  assert.equal(Object.keys(VEHICLE_BRANDS).length, 24);
  assert.equal(vehicles.length, 79);
  assert.ok(APPLIANCES.every((item) => item.id && item.kw > 0 && item.defaultDuration > 0));
  assert.ok(vehicles.every((item) => item.brand && item.model && item.batteryKwh > 0));
  assert.equal(new Set(vehicles.map((item) => `${item.brand}:${item.model}`)).size, vehicles.length);
});

test("vehicle pages remain gated until primary sources are recorded", () => {
  assert.equal(CATALOG_METADATA.vehiclePublicationStatus, "planner-only");
  assert.ok(
    Object.values(VEHICLE_BRANDS)
      .flat()
      .every((vehicle) => vehicle.sourceStatus === "needs-primary-verification")
  );
});
