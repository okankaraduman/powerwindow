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

  setText("seoDateLabel", formatDateHuman(dateValue, lang));
  setText("seoStatus", labels.loading);

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

function parseMarketData(data) {
  const included = Array.isArray(data?.included) ? data.included : [];
  const pvpc = findSeries(included, ["PVPC"]);
  const spot = findSeries(included, ["Spot market price", "spot"]);
  const series = hasValues(pvpc) ? pvpc : spot;
  if (!series?.attributes?.values?.length) return [];

  const hourly = new Map();
  series.attributes.values.forEach((item) => {
    const hour = Number(String(item.datetime || "").match(/T(\d{2}):/)?.[1]);
    const value = Number(item.value);
    if (!Number.isFinite(hour) || !Number.isFinite(value)) return;
    const current = hourly.get(hour) || { total: 0, count: 0, datetime: item.datetime };
    current.total += value;
    current.count += 1;
    hourly.set(hour, current);
  });

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourly.get(hour);
    if (!bucket) return null;
    return {
      hour,
      datetime: bucket.datetime,
      price: bucket.total / bucket.count,
    };
  }).filter(Boolean);
}

function findSeries(series, names) {
  const normalized = names.map((name) => name.toLowerCase());
  return series.find((item) => {
    const title = String(item?.attributes?.title || item?.type || "").toLowerCase();
    return normalized.some((name) => title.includes(name));
  });
}

function hasValues(series) {
  return Array.isArray(series?.attributes?.values) && series.attributes.values.length > 0;
}

function dailyStats(points) {
  const prices = points.map((point) => point.price);
  const min = points.reduce((best, point) => (point.price < best.price ? point : best), points[0]);
  const max = points.reduce((worst, point) => (point.price > worst.price ? point : worst), points[0]);
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const spreadPercent = max.price > 0 ? ((max.price - min.price) / max.price) * 100 : 0;
  const updatedAt = points.reduce((latest, point) => {
    const value = new Date(point.datetime).getTime();
    return Number.isFinite(value) && value > latest ? value : latest;
  }, 0);
  return { min, max, average, spreadPercent, updatedAt: updatedAt ? new Date(updatedAt).toISOString() : "" };
}

function bestWindow(points, duration, kw) {
  const maxStart = Math.max(0, points.length - duration);
  let best = null;
  for (let start = 0; start <= maxStart; start += 1) {
    const slice = points.slice(start, start + duration);
    const avgPrice = slice.reduce((sum, point) => sum + point.price, 0) / slice.length;
    const cost = slice.reduce((sum, point) => sum + (point.price / 1000) * kw, 0);
    const item = { start, duration, avgPrice, cost };
    if (!best || item.avgPrice < best.avgPrice) best = item;
  }
  return best || { start: 0, duration, avgPrice: 0, cost: 0 };
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

function madridDate(offset) {
  const base = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDateHuman(value, lang) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatHourRange(start, duration, lang) {
  const end = start + duration;
  return `${formatHour(start, lang)}-${formatHour(end, lang)}`;
}

function formatHour(hour, lang) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 || 12;
  return lang === "en" ? `${display} ${suffix}` : `${display} ${suffix}`;
}

function formatPrice(value, lang) {
  return `${new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format((value || 0) / 1000)} €/kWh`;
}

function formatMoney(value, lang) {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
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
