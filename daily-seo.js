import {
  bestWindow,
  dailyStats,
  formatDateHuman,
  formatHourRange,
  formatMoney,
  formatPrice,
  madridDate,
  parseMarketData,
} from "./shared/daily-market.mjs";

const DAILY_API_BASE =
  window.POWER_WINDOW_API_BASE ||
  (window.location.hostname === "powerwindow.energy" ||
  window.location.hostname === "www.powerwindow.energy"
    ? "https://api.powerwindow.energy/api"
    : "");
const DAILY_REE_BASE = "https://apidatos.ree.es/en/datos";
const DAILY_MARKET_WIDGET = "mercados/precios-mercados-tiempo-real";

initDailySeoPage();

async function initDailySeoPage() {
  const root = document.querySelector("[data-daily-seo]");
  if (!root) return;

  const lang = root.dataset.lang || document.documentElement.lang || "es";
  const dayOffset = Number(root.dataset.dayOffset || 0);
  const dateValue = madridDate(dayOffset);
  const labels = labelsFor(lang, dayOffset);
  const hasServerData = document.body.dataset.serverRendered === "true";

  setText("seoDateLabel", formatDateHuman(dateValue, lang));
  if (!hasServerData) setText("seoStatus", labels.loading);

  try {
    const payload = await fetchMarketPayload(dateValue);
    const points = parseMarketData(payload);
    if (points.length < 12) throw new Error(labels.noData);

    const stats = dailyStats(points);
    const dishwasher = bestWindow(points, 2, 0.8);
    const ev = bestWindow(points, 3, 7.4);
    const ac = bestWindow(points, 4, 1.2);

    setText("seoStatus", labels.ready);
    setText("seoMinPrice", formatPrice(stats.min.price, lang));
    setText("seoAveragePrice", formatPrice(stats.average, lang));
    setText("seoMaxPrice", formatPrice(stats.max.price, lang));
    setText("seoCheapestHour", formatHourRange(stats.min.hour, 1, lang));
    setText("seoCheapestWindow", formatHourRange(dishwasher.start, 2, lang));
    setText("seoSpread", `${Math.round(stats.spreadPercent)}%`);
    setText("seoEvCost", formatMoney(ev.cost, lang));
    setText("seoDishwasherCost", formatMoney(dishwasher.cost, lang));
    setText("seoAcWindow", formatHourRange(ac.start, 4, lang));
    setText("seoUpdatedAt", labels.updated(stats.updatedAt));
    setText("seoSummary", labels.summary(stats, ev, dishwasher));
    renderHourlyList(points, stats, lang);
  } catch (error) {
    if (hasServerData) {
      console.warn("Keeping server-rendered PVPC data after client refresh failed", error);
      return;
    }
    setText("seoStatus", labels.error);
    setText("seoSummary", error.message || labels.noData);
  }
}

async function fetchMarketPayload(dateValue) {
  if (DAILY_API_BASE) {
    const backendUrl = new URL(`${DAILY_API_BASE.replace(/\/$/, "")}/market`, window.location.origin);
    backendUrl.searchParams.set("date", dateValue);
    try {
      const response = await fetch(backendUrl, { headers: { Accept: "application/json" } });
      if (response.ok) {
        const data = await response.json();
        if (data.payload) return data.payload;
      }
    } catch {
      // Fall through to REE so local static testing still hydrates the page.
    }
  }

  const start = `${dateValue}T00:00`;
  const end = `${dateValue}T23:59`;
  const reeUrl = `${DAILY_REE_BASE}/${DAILY_MARKET_WIDGET}?start_date=${start}&end_date=${end}&time_trunc=hour`;
  const reeResponse = await fetch(reeUrl, { headers: { Accept: "application/json" } });
  if (!reeResponse.ok) throw new Error(`REE ${reeResponse.status}`);
  const payload = await reeResponse.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].detail || "REE returned an error");
  return payload;
}

function renderHourlyList(points, stats, lang) {
  const list = document.querySelector("#seoHourlyList");
  if (!list) return;

  const lowLimit = stats.min.price + (stats.max.price - stats.min.price) * 0.25;
  const highLimit = stats.min.price + (stats.max.price - stats.min.price) * 0.75;
  list.innerHTML = points
    .map((point) => {
      const tone = point.price <= lowLimit ? "low" : point.price >= highLimit ? "high" : "mid";
      return `
        <li class="daily-hour daily-hour--${tone}">
          <span>${formatHourRange(point.hour, 1, lang)}</span>
          <strong>${formatPrice(point.price, lang)}</strong>
        </li>
      `;
    })
    .join("");
}

function labelsFor(lang, dayOffset) {
  if (lang === "en") {
    const dayName = dayOffset === 1 ? "tomorrow" : "today";
    return {
      loading: "Loading PVPC data",
      ready: "Live PVPC data",
      error: "PVPC data unavailable",
      noData: "Hourly PVPC data could not be loaded.",
      updated: (value) => (value ? `Last hourly value: ${formatDateHuman(value.slice(0, 10), "en")}` : "Updated from REE data"),
      summary: (stats, ev, dishwasher) =>
        `For ${dayName}, the lowest PVPC hour is ${formatHourRange(stats.min.hour, 1, "en")} at ${formatPrice(stats.min.price, "en")}. The highest hour is ${formatHourRange(stats.max.hour, 1, "en")} at ${formatPrice(stats.max.price, "en")}. A 3-hour 7.4 kW EV charge is estimated at ${formatMoney(ev.cost, "en")} in the best window, while a 2-hour dishwasher run is estimated at ${formatMoney(dishwasher.cost, "en")}.`,
    };
  }

  const dayName = dayOffset === 1 ? "mañana" : "hoy";
  return {
    loading: "Cargando datos PVPC",
    ready: "Datos PVPC en directo",
    error: "Datos PVPC no disponibles",
    noData: "No se pudieron cargar los precios PVPC horarios.",
    updated: (value) => (value ? `Último valor horario: ${formatDateHuman(value.slice(0, 10), "es")}` : "Actualizado con datos de REE"),
    summary: (stats, ev, dishwasher) =>
      `Para ${dayName}, la hora PVPC más barata es ${formatHourRange(stats.min.hour, 1, "es")} a ${formatPrice(stats.min.price, "es")}. La hora más cara es ${formatHourRange(stats.max.hour, 1, "es")} a ${formatPrice(stats.max.price, "es")}. Una carga de coche eléctrico de 3 horas a 7,4 kW se estima en ${formatMoney(ev.cost, "es")} en la mejor ventana, y un lavavajillas de 2 horas se estima en ${formatMoney(dishwasher.cost, "es")}.`,
  };
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
