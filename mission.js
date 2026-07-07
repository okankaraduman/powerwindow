const MISSION_API_BASE =
  window.location.hostname === "powerwindow.energy" ||
  window.location.hostname === "www.powerwindow.energy"
    ? "https://api.powerwindow.energy/api"
    : "/api";
const MISSION_REE_API_BASE = "https://apidatos.ree.es/en/datos";
const MISSION_MARKET_WIDGET = "mercados/precios-mercados-tiempo-real";
const BILL_DEFAULTS = {
  vat: 21,
  electricityTax: 5.1127,
  adder: 0.075,
};

const missionEls = {
  dishwasherSavings: document.querySelector("#dishwasherSavings"),
  dishwasherSavingsNote: document.querySelector("#dishwasherSavingsNote"),
  evSavings: document.querySelector("#evSavings"),
  evSavingsNote: document.querySelector("#evSavingsNote"),
  monthlySavings: document.querySelector("#monthlySavings"),
  monthlySavingsNote: document.querySelector("#monthlySavingsNote"),
  missionDataNote: document.querySelector("#missionDataNote"),
};

loadMissionNumbers();

async function loadMissionNumbers() {
  try {
    const dateValue = formatDateInput(new Date());
    const payload = await fetchMissionMarketData(dateValue);
    const points = parseMissionMarketData(payload);
    if (!points.length) throw new Error("No hourly market data");

    const dishwasher = savingsExample(points, 2, 0.8);
    const ev = savingsExample(points, 3, 7.4);
    const monthly = dishwasher.savings * 20 + ev.savings * 4;

    missionEls.dishwasherSavings.textContent = formatMoney(dishwasher.savings);
    missionEls.dishwasherSavingsNote.textContent =
      `Dishwasher: ${formatWindow(dishwasher.best.start, 2)} instead of ${formatWindow(dishwasher.worst.start, 2)}`;
    missionEls.evSavings.textContent = formatMoney(ev.savings);
    missionEls.evSavingsNote.textContent =
      `EV: ${formatWindow(ev.best.start, 3)} instead of ${formatWindow(ev.worst.start, 3)}`;
    missionEls.monthlySavings.textContent = formatMoney(monthly);
    missionEls.monthlySavingsNote.textContent = "20 dishwasher runs + 4 EV top-ups";
    missionEls.missionDataNote.textContent =
      `Calculated from ${dateValue} hourly prices using bill-impact defaults: 21% VAT, 5.1127% electricity tax, and 0.075 EUR/kWh adders.`;
  } catch {
    missionEls.dishwasherSavings.textContent = "Live data unavailable";
    missionEls.evSavings.textContent = "--";
    missionEls.monthlySavings.textContent = "--";
    missionEls.missionDataNote.textContent =
      "The examples use live hourly market data when available. Try again after the REE/backend response is reachable.";
  }
}

async function fetchMissionMarketData(dateValue) {
  const backendURL = new URL(`${MISSION_API_BASE.replace(/\/$/, "")}/market`, window.location.origin);
  backendURL.searchParams.set("date", dateValue);

  try {
    const backendResponse = await fetch(backendURL, { headers: { Accept: "application/json" } });
    if (backendResponse.ok) {
      const data = await backendResponse.json();
      if (data.payload) return data.payload;
    }
  } catch {
    // Fall through to direct REE data when local development or backend routing is unavailable.
  }

  const start = `${dateValue}T00:00`;
  const end = `${dateValue}T23:59`;
  const url = `${MISSION_REE_API_BASE}/${MISSION_MARKET_WIDGET}?start_date=${start}&end_date=${end}&time_trunc=hour`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`REE request failed with ${response.status}`);

  const data = await response.json();
  if (data.errors?.length) throw new Error(data.errors[0].detail || "REE returned an error");
  return data;
}

function parseMissionMarketData(data) {
  const included = Array.isArray(data.included) ? data.included : [];
  const pvpc = findMissionSeries(included, ["PVPC"]);
  const spot = findMissionSeries(included, ["Spot market price", "spot"]);
  const series = hasMissionValues(pvpc) ? pvpc : spot;
  if (!series?.attributes?.values?.length) return [];

  const hourly = new Map();
  series.attributes.values.forEach((item) => {
    const hour = Number(item.datetime.match(/T(\d{2}):/)?.[1]);
    if (!Number.isFinite(hour)) return;
    const current = hourly.get(hour) || { total: 0, count: 0 };
    current.total += Number(item.value);
    current.count += 1;
    hourly.set(hour, current);
  });

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourly.get(hour);
    if (!bucket) return null;
    return { hour, price: bucket.total / bucket.count };
  }).filter(Boolean);
}

function findMissionSeries(included, names) {
  return included.find((item) => {
    const title = `${item.type || ""} ${item.attributes?.title || ""}`.toLowerCase();
    return names.some((name) => title.includes(name.toLowerCase()));
  });
}

function hasMissionValues(series) {
  return Array.isArray(series?.attributes?.values) && series.attributes.values.length > 0;
}

function savingsExample(points, duration, kw) {
  const ranked = rankMissionWindows(points, duration, kw);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  return {
    best,
    worst,
    savings: Math.max(0, worst.cost - best.cost),
  };
}

function rankMissionWindows(points, duration, kw) {
  const maxStart = Math.max(0, points.length - duration);
  return Array.from({ length: maxStart + 1 }, (_, start) => {
    const slice = points.slice(start, start + duration);
    const marketCost = slice.reduce((sum, point) => sum + (point.price / 1000) * kw, 0);
    const kwh = kw * slice.length;
    return {
      start,
      avgPrice: average(slice.map((point) => point.price)),
      cost: estimateBillImpact(marketCost, kwh),
    };
  }).sort((a, b) => {
    if (a.avgPrice !== b.avgPrice) return a.avgPrice - b.avgPrice;
    return a.start - b.start;
  });
}

function estimateBillImpact(marketCost, kwh) {
  const beforeTaxes = marketCost + kwh * BILL_DEFAULTS.adder;
  const withElectricityTax = beforeTaxes * (1 + BILL_DEFAULTS.electricityTax / 100);
  return withElectricityTax * (1 + BILL_DEFAULTS.vat / 100);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatWindow(start, duration) {
  return `${formatHour(start)}-${formatHour(start + duration)}`;
}

function formatHour(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 || 12;
  return `${display} ${suffix}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
