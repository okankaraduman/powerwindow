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
  days: 7,
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
  laundry: {
    savings: 0.28870796563531994,
    best: "2 PM-4 PM",
    worst: "8 PM-10 PM",
  },
  weekly: {
    low: 15.093291205061076,
    high: 19.776800166520974,
  },
};

const missionEls = {
  dishwasherSavings: document.querySelector("#dishwasherSavings"),
  dishwasherSavingsNote: document.querySelector("#dishwasherSavingsNote"),
  evSavings: document.querySelector("#evSavings"),
  evSavingsNote: document.querySelector("#evSavingsNote"),
  laundrySavings: document.querySelector("#laundrySavings"),
  laundrySavingsNote: document.querySelector("#laundrySavingsNote"),
  weeklySavings: document.querySelector("#weeklySavings"),
  weeklySavingsNote: document.querySelector("#weeklySavingsNote"),
  missionDataNote: document.querySelector("#missionDataNote"),
};

renderFallbackMissionNumbers();
loadMissionNumbers();

async function loadMissionNumbers() {
  try {
    const selectedDate = new Date();
    const dateValue = formatDateInput(selectedDate);
    const payload = await fetchMissionMarketData(dateValue);
    const points = parseMissionMarketData(payload);
    if (!points.length) throw new Error("Sin datos horarios de mercado");

    const dishwasher = savingsExample(points, 2, 0.8);
    const ev = savingsExample(points, 3, 7.4);
    const laundry = savingsExample(points, 2, 0.7);
    const week = await weeklyBasketExample(selectedDate);

    renderMissionNumbers({
      date: dateValue,
      days: week.days,
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
      laundry: {
        savings: laundry.savings,
        best: formatWindow(laundry.best.start, 2),
        worst: formatWindow(laundry.worst.start, 2),
      },
      weekly: week.weekly,
    });
    missionEls.missionDataNote.textContent =
      `Hoy usa los precios horarios de ${dateValue}. La cesta semanal promedia ${week.days} día${week.days === 1 ? "" : "s"} disponible${week.days === 1 ? "" : "s"} de este mes y aplica 2 usos de lavavajillas, 1 lavadora y 3-4 recargas de coche eléctrico.`;
  } catch {
    renderFallbackMissionNumbers();
    missionEls.missionDataNote.textContent =
      "Mostrando el último ejemplo semanal incluido, del 7 de julio de 2026, porque los datos horarios en directo no están disponibles en esta sesión del navegador.";
  }
}

function renderFallbackMissionNumbers() {
  renderMissionNumbers(FALLBACK_EXAMPLE);
}

function renderMissionNumbers(example) {
  missionEls.dishwasherSavings.textContent = formatMoney(example.dishwasher.savings);
  missionEls.dishwasherSavingsNote.textContent =
    `Lavavajillas: ${example.dishwasher.best} en lugar de ${example.dishwasher.worst}`;
  missionEls.evSavings.textContent = formatMoney(example.ev.savings);
  missionEls.evSavingsNote.textContent = `Coche eléctrico: ${example.ev.best} en lugar de ${example.ev.worst}`;
  missionEls.laundrySavings.textContent = formatMoney(example.laundry.savings);
  missionEls.laundrySavingsNote.textContent =
    `Lavadora: ${example.laundry.best} en lugar de ${example.laundry.worst}`;
  missionEls.weeklySavings.textContent = formatMoneyRange(example.weekly.low, example.weekly.high);
  missionEls.weeklySavingsNote.textContent =
    `Media de ${example.days || 1} día${(example.days || 1) === 1 ? "" : "s"}: 2 lavavajillas, 1 lavadora, 3-4 recargas de coche`;
}

async function weeklyBasketExample(selectedDate) {
  const days = await fetchMissionMonthData(formatDateInput(selectedDate));

  if (!days.length) {
    return { days: 1, weekly: FALLBACK_EXAMPLE.weekly };
  }

  const averageDishwasher = average(days.map((day) => day.dishwasher));
  const averageEv = average(days.map((day) => day.ev));
  const averageLaundry = average(days.map((day) => day.laundry));
  return {
    days: days.length,
    weekly: {
      low: averageDishwasher * 2 + averageLaundry + averageEv * 3,
      high: averageDishwasher * 2 + averageLaundry + averageEv * 4,
    },
  };
}

async function fetchMissionMonthData(dateValue) {
  const backendURL = new URL(`${MISSION_API_BASE.replace(/\/$/, "")}/market/month`, window.location.origin);
  backendURL.searchParams.set("date", dateValue);

  try {
    const response = await fetch(backendURL, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.days)) {
        return data.days
          .map((day) => {
            const points = parseMissionMarketData(day.payload);
            if (!points.length) return null;
            return {
              dishwasher: savingsExample(points, 2, 0.8).savings,
              ev: savingsExample(points, 3, 7.4).savings,
              laundry: savingsExample(points, 2, 0.7).savings,
            };
          })
          .filter(Boolean);
      }
    }
  } catch {
    // Fall back to client-side fanout when running without the Worker locally.
  }

  return fetchMissionMonthDataByDay(dateValue);
}

async function fetchMissionMonthDataByDay(dateValue) {
  const results = await Promise.allSettled(
    monthToDateValues(dateValue).map(async (dayValue) => {
      const payload = await fetchMissionMarketData(dayValue);
      const points = parseMissionMarketData(payload);
      if (!points.length) throw new Error(`Sin datos horarios para ${dayValue}`);
      return {
        dishwasher: savingsExample(points, 2, 0.8).savings,
        ev: savingsExample(points, 3, 7.4).savings,
        laundry: savingsExample(points, 2, 0.7).savings,
      };
    })
  );

  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
}

function monthToDateValues(dateValue) {
  const [, , day] = dateValue.split("-").map(Number);
  return Array.from({ length: day }, (_, index) => `${dateValue.slice(0, 8)}${String(index + 1).padStart(2, "0")}`);
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
  if (!response.ok) throw new Error(`La solicitud a REE falló con estado ${response.status}`);

  const data = await response.json();
  if (data.errors?.length) throw new Error(data.errors[0].detail || "REE devolvió un error");
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
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoneyRange(low, high) {
  if (Math.abs(low - high) < 0.005) return formatMoney(low);
  return `${formatMoney(low)}-${formatMoney(high)}`;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
