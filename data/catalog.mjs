export const CATALOG_METADATA = Object.freeze({
  version: 1,
  lastReviewed: "2026-09-04",
  vehiclePublicationStatus: "planner-only",
  vehiclePublicationNote:
    "Battery values are approximate planner defaults. Verify each variant against a primary manufacturer source before publishing an indexable vehicle page.",
});

export const APPLIANCES = Object.freeze([
  catalogItem("dishwasher", 0.8, 2, "Lavavajillas", "Dishwasher"),
  catalogItem("washing-machine", 1.2, 2, "Lavadora", "Washing machine"),
  catalogItem("dryer", 2.2, 2, "Secadora", "Dryer"),
  catalogItem("air-conditioning", 1.2, 4, "Aire acondicionado", "Air conditioning"),
  catalogItem("ev-plug", 2.3, 8, "Coche eléctrico con enchufe", "EV from a domestic plug"),
  catalogItem("ev-slow", 3.7, 6, "Carga lenta de coche eléctrico", "Slow EV charging"),
  catalogItem("ev-wallbox", 7.4, 3, "Cargador doméstico de coche eléctrico", "Home EV wallbox"),
  catalogItem("ev-three-phase", 11, 2, "Carga trifásica de coche eléctrico", "Three-phase EV charging"),
  catalogItem("heat-pump", 1.5, 4, "Bomba de calor", "Heat pump"),
]);

export const VEHICLE_BRANDS = deepFreeze({
  Audi: [
    vehicle("Q4 e-tron 45", 77),
    vehicle("Q6 e-tron", 94.9),
    vehicle("Q8 e-tron 55", 106),
  ],
  BMW: [
    vehicle("i3 120 Ah", 37.9),
    vehicle("i4 eDrive40", 81.1),
    vehicle("iX1 xDrive30", 64.7),
    vehicle("iX3", 73.8),
  ],
  BYD: [
    vehicle("Dolphin", 60.4),
    vehicle("Atto 3", 60.5),
    vehicle("Seal", 82.5),
    vehicle("Seal U", 71.8),
  ],
  Citroen: [
    vehicle("e-C3", 44),
    vehicle("e-C4", 50),
    vehicle("e-Berlingo", 50),
  ],
  Cupra: [
    vehicle("Born 58", 58),
    vehicle("Born 77", 77),
    vehicle("Tavascan", 77),
  ],
  Dacia: [vehicle("Spring", 26.8)],
  Fiat: [
    vehicle("500e", 37.3),
    vehicle("600e", 51),
  ],
  Ford: [
    vehicle("Explorer EV", 77),
    vehicle("Mustang Mach-E Standard", 72),
    vehicle("Mustang Mach-E Extended", 91),
  ],
  Hyundai: [
    vehicle("Kona Electric 48", 48.4),
    vehicle("Kona Electric 65", 65.4),
    vehicle("Ioniq 5 Standard", 58),
    vehicle("Ioniq 5 Long Range", 77.4),
    vehicle("Ioniq 6 Long Range", 77.4),
  ],
  Jeep: [vehicle("Avenger Electric", 51)],
  Kia: [
    vehicle("Niro EV", 64.8),
    vehicle("EV3 Standard", 58.3),
    vehicle("EV3 Long Range", 81.4),
    vehicle("EV4 Standard", 58.3),
    vehicle("EV4 Long Range", 81.4),
    vehicle("EV6 Long Range", 77.4),
    vehicle("EV9", 99.8),
  ],
  Mazda: [vehicle("MX-30", 30)],
  Mercedes: [
    vehicle("EQA 250+", 70.5),
    vehicle("EQB 250+", 70.5),
    vehicle("EQE 350+", 90.6),
  ],
  MG: [
    vehicle("MG4 Standard", 50.8),
    vehicle("MG4 Long Range", 61.7),
    vehicle("MG4 Extended Range", 74.4),
    vehicle("ZS EV Standard", 49),
    vehicle("ZS EV Long Range", 68.3),
  ],
  Mini: [
    vehicle("Cooper E", 36.6),
    vehicle("Cooper SE", 49.2),
  ],
  Nissan: [
    vehicle("Leaf 40", 39),
    vehicle("Leaf e+", 59),
    vehicle("Ariya 63", 63),
    vehicle("Ariya 87", 87),
  ],
  Opel: [
    vehicle("Corsa Electric", 51),
    vehicle("Mokka Electric", 51),
    vehicle("Astra Electric", 54),
  ],
  Peugeot: [
    vehicle("e-208", 51),
    vehicle("e-2008", 54),
    vehicle("e-308", 54),
    vehicle("e-Rifter", 50),
  ],
  Polestar: [
    vehicle("2 Standard Range", 67),
    vehicle("2 Long Range", 79),
  ],
  Tesla: [
    vehicle("Model 3 RWD", 57.5),
    vehicle("Model 3 Long Range", 75),
    vehicle("Model Y RWD", 57.5),
    vehicle("Model Y Long Range", 75),
  ],
  Renault: [
    vehicle("5 E-Tech 40", 40),
    vehicle("5 E-Tech 52", 52),
    vehicle("Zoe ZE50", 52),
    vehicle("Megane E-Tech", 60),
    vehicle("Scenic E-Tech", 87),
  ],
  Skoda: [
    vehicle("Enyaq 60", 58),
    vehicle("Enyaq 85", 77),
  ],
  Volkswagen: [
    vehicle("ID.3 Pro", 58),
    vehicle("ID.3 Pro S", 77),
    vehicle("ID.4 Pro", 77),
    vehicle("ID.5 Pro", 77),
    vehicle("ID.7 Pro", 77),
  ],
  Volvo: [
    vehicle("EX30 Single Motor", 49),
    vehicle("EX30 Extended Range", 64),
    vehicle("EX40", 79),
  ],
});

function catalogItem(id, kw, defaultDuration, es, en) {
  return Object.freeze({
    id,
    kw,
    defaultDuration,
    labels: Object.freeze({ es, en }),
    sourceStatus: "approximate-editable-default",
  });
}

function vehicle(model, batteryKwh) {
  return { model, batteryKwh, sourceStatus: "needs-primary-verification" };
}

function deepFreeze(value) {
  Object.values(value).forEach((item) => {
    if (Array.isArray(item)) item.forEach(Object.freeze);
    Object.freeze(item);
  });
  return Object.freeze(value);
}
