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
const FALLBACK_EXAMPLE = {
  date: "2026-07-07",
  dishwasher: {
    savings: 0.3299519607260799,
    best: "2 PM-4 PM",
    worst: "8 PM-10 PM",
  },
  ev: {
    savings: 4.16885877552452,
    best: "2 PM-5 PM",
    worst: "7 PM-10 PM",
  },
  monthly: 23.27447431661968,
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

renderFallbackMissionNumbers();
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

    renderMissionNumbers({
      dishwasher: {
        savings: dishwasher.savings,
        best: formatWindow(dishwasher.best.start, 2),
        worst: formatWindow(dishwasher.worst.start, 2),
      },
      ev: {
        savings: ev.savings,
        best: formatWindow(ev.best.start, 3),
        worst: formatWindow(ev.worst.start, 3),
      },
      monthly,
    });
    missionEls.missionDataNote.textContent =
      `Calculated from ${dateValue} hourly prices using bill-impact defaults: 21% VAT, 5.1127% electricity tax, and 0.075 EUR/kWh adders.`;
  } catch {
    renderFallbackMissionNumbers();
    missionEls.missionDataNote.textContent =
      "Showing the latest bundled example from 7 July 2026 because live hourly data is not available in this browser session.";
  }
}

function renderFallbackMissionNumbers() {
  renderMissionNumbers(FALLBACK_EXAMPLE);
}

function renderMissionNumbers(example) {
  missionEls.dishwasherSavings.textContent = formatMoney(example.dishwasher.savings);
  missionEls.dishwasherSavingsNote.textContent =
    `Dishwasher: ${example.dishwasher.best} instead of ${example.dishwasher.worst}`;
  missionEls.evSavings.textContent = formatMoney(example.ev.savings);
  missionEls.evSavingsNote.textContent = `EV: ${example.ev.best} instead of ${example.ev.worst}`;
  missionEls.monthlySavings.textContent = formatMoney(example.monthly);
  missionEls.monthlySavingsNote.textContent = "20 dishwasher runs + 4 EV top-ups";
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
