const STATS_API_BASE =
  storedStatsApiBase() ||
  (window.location.hostname === "powerwindow.energy" ||
  window.location.hostname === "www.powerwindow.energy"
    ? "https://api.powerwindow.energy/api"
    : "/api");
const STATS_REE_API_BASE = "https://apidatos.ree.es/en/datos";
const STATS_MARKET_WIDGET = "mercados/precios-mercados-tiempo-real";
const STATS_GENERATION_WIDGET = "generacion/estructura-generacion";
const STATS_TIME_ZONE = "Europe/Madrid";
const GENERATION_TITLE_ES = {
  Hydro: "Hidráulica",
  Nuclear: "Nuclear",
  Coal: "Carbón",
  "Diesel engines": "Motores diésel",
  "Gas turbine": "Turbina de gas",
  "Steam turbine": "Turbina de vapor",
  "Combined cycle": "Ciclo combinado",
  Wind: "Eólica",
  "Solar photovoltaic": "Solar fotovoltaica",
  "Thermal solar": "Solar térmica",
  "Other renewables": "Otras renovables",
  Cogeneration: "Cogeneración",
  "Non-renewable waste": "Residuos no renovables",
  "Renewable waste": "Residuos renovables",
  "Total generation": "Generación total"
};

const statsEls = {
  dateInput: document.querySelector("#statsDateInput"),
  refreshButton: document.querySelector("#statsRefreshButton"),
  controlHint: document.querySelector("#statsControlHint"),
  heroTitle: document.querySelector("#statsHeroTitle"),
  heroReason: document.querySelector("#statsHeroReason"),
  dataStatus: document.querySelector("#statsDataStatus"),
  dataNote: document.querySelector("#statsDataNote"),
  lastUpdated: document.querySelector("#statsLastUpdated"),
  renewableRate: document.querySelector("#renewableRate"),
  renewableHint: document.querySelector("#renewableHint"),
  windSolarRate: document.querySelector("#windSolarRate"),
  windSolarHint: document.querySelector("#windSolarHint"),
  lowestPvpcHour: document.querySelector("#lowestPvpcHour"),
  lowestPvpcHint: document.querySelector("#lowestPvpcHint"),
  timingSpread: document.querySelector("#timingSpread"),
  timingSpreadHint: document.querySelector("#timingSpreadHint"),
  generationMixNote: document.querySelector("#generationMixNote"),
  renewableStack: document.querySelector("#renewableStack"),
  nonRenewableStack: document.querySelector("#nonRenewableStack"),
  generationMixList: document.querySelector("#generationMixList"),
  priceShapeNote: document.querySelector("#priceShapeNote"),
  priceChart: document.querySelector("#statsPriceChart")
};

initStatistics();

function storedStatsApiBase() {
  try {
    return localStorage.getItem("POWER_WINDOW_API_BASE");
  } catch {
    return "";
  }
}

function initStatistics() {
  const today = madridDateString(0);
  statsEls.dateInput.value = today;
  statsEls.dateInput.max = today;
  statsEls.refreshButton.addEventListener("click", () => loadStatistics(statsEls.dateInput.value));
  statsEls.dateInput.addEventListener("change", () => loadStatistics(statsEls.dateInput.value));
  loadStatistics(today);
}

async function loadStatistics(dateValue) {
  const date = isValidDateValue(dateValue) ? dateValue : madridDateString(0);
  statsEls.dateInput.value = date;
  setLoadingState(date);

  try {
    const [marketResponse, generationResponse] = await Promise.all([
      fetchMarketData(date),
      fetchGenerationData(date)
    ]);
    const marketPoints = parseMarketData(marketResponse.payload);
    const generationMix = parseGenerationMix(generationResponse.payload);

    if (!marketPoints.length) throw new Error("No PVPC market series found");
    if (!generationMix.rows.length || generationMix.total <= 0) {
      throw new Error("No generation mix series found");
    }

    renderStatistics({
      date,
      market: marketStats(marketPoints),
      generation: generationMix,
      cacheStatus: aggregateCacheStatus([marketResponse.cacheStatus, generationResponse.cacheStatus]),
      cachedAt: latestIso([marketResponse.cachedAt, generationResponse.cachedAt])
    });
  } catch (error) {
    renderStatisticsError(error);
  }
}

function setLoadingState(date) {
  statsEls.refreshButton.disabled = true;
  statsEls.dataStatus.textContent = "Cargando";
  statsEls.dataNote.textContent = `Obteniendo ${date}`;
  statsEls.lastUpdated.textContent = "Actualización pendiente";
  statsEls.heroTitle.textContent = "Cargando estadísticas...";
  statsEls.heroReason.textContent = "Obteniendo datos cacheados de precio y generación de REE.";
}

function renderStatistics({ date, market, generation, cacheStatus, cachedAt }) {
  const dayContext = date === madridDateString(0) ? "hoy hasta ahora" : "ese día";
  const topTechnology = generation.rows[0];
  const renewableShare = generation.renewable / generation.total;
  const windSolarShare = generation.windSolar / generation.total;
  const timingSpread = ((market.highest.price - market.lowest.price) / 1000) * 10;
  const spreadPercent = market.highest.price
    ? ((market.highest.price - market.lowest.price) / market.highest.price) * 100
    : 0;

  statsEls.refreshButton.disabled = false;
  statsEls.dataStatus.textContent = sourceLabel(cacheStatus);
  statsEls.dataNote.textContent =
    `${date}: PVPC y estructura de generación, ${sourceLabel(cacheStatus).toLowerCase()}`;
  statsEls.lastUpdated.textContent = cachedAt ? `Cacheado: ${formatDateTime(cachedAt)}` : "Hora de caché no disponible";
  statsEls.controlHint.textContent =
    date === madridDateString(0)
      ? "Hoy puede cambiar a medida que REE actualiza precios y generación."
      : "Las fechas pasadas se tratan como estables una vez cacheadas.";

  statsEls.heroTitle.textContent = `${formatPercent(renewableShare)} renovable`;
  statsEls.heroReason.textContent =
    `Para ${dayContext}, la hora PVPC más barata es ${formatHour(market.lowest.hour)} a ${formatEuroPerKwh(market.lowest.price / 1000)}. ` +
    `${topTechnology.title} es la principal fuente de generación con ${formatPercent(topTechnology.share)}.`;

  statsEls.renewableRate.textContent = formatPercent(renewableShare);
  statsEls.renewableHint.textContent =
    `${formatEnergy(generation.renewable)} renovables de ${formatEnergy(generation.total)} de generación total.`;
  statsEls.windSolarRate.textContent = formatPercent(windSolarShare);
  statsEls.windSolarHint.textContent =
    `${formatEnergy(generation.windSolar)} procedieron de eólica y solar.`;
  statsEls.lowestPvpcHour.textContent = formatHour(market.lowest.hour);
  statsEls.lowestPvpcHint.textContent =
    `${formatEuroPerKwh(market.lowest.price / 1000)} de componente de precio.`;
  statsEls.timingSpread.textContent = formatMoney(timingSpread);
  statsEls.timingSpreadHint.textContent =
    `Un consumo flexible de 10 kWh cambia alrededor de un ${formatPercent(spreadPercent / 100)} entre la hora más barata y la más cara.`;

  statsEls.generationMixNote.textContent =
    `Fuente principal: ${topTechnology.title}. Última actualización de REE: ${formatDateTime(generation.lastUpdated)}.`;
  renderGenerationStack(generation);
  renderGenerationRows(generation);

  statsEls.priceShapeNote.textContent =
    `Componente PVPC medio: ${formatEuroPerKwh(market.average / 1000)}. Hora más cara: ${formatHour(market.highest.hour)}. Precios en €/kWh.`;
  renderPriceChart(market.points, market.lowest.hour, market.highest.hour);
}

function renderStatisticsError(error) {
  statsEls.refreshButton.disabled = false;
  statsEls.dataStatus.textContent = "No disponible";
  statsEls.dataNote.textContent = "No se pudieron cargar las estadísticas";
  statsEls.lastUpdated.textContent = error.message || "Error desconocido";
  statsEls.heroTitle.textContent = "No hay estadísticas disponibles";
  statsEls.heroReason.textContent =
    "Prueba otra fecha o actualiza cuando los datos de REE estén disponibles a través de la caché del backend.";
  statsEls.renewableRate.textContent = "--";
  statsEls.windSolarRate.textContent = "--";
  statsEls.lowestPvpcHour.textContent = "--";
  statsEls.timingSpread.textContent = "--";
  statsEls.generationMixList.innerHTML = "";
  statsEls.priceChart.innerHTML = "";
}

function renderGenerationStack(generation) {
  const renewableShare = clampShare(generation.renewable / generation.total);
  statsEls.renewableStack.style.width = `${renewableShare * 100}%`;
  statsEls.renewableStack.textContent = `Renovable ${formatPercent(renewableShare)}`;
  statsEls.nonRenewableStack.style.width = `${(1 - renewableShare) * 100}%`;
  statsEls.nonRenewableStack.textContent = `Resto ${formatPercent(1 - renewableShare)}`;
}

function renderGenerationRows(generation) {
  statsEls.generationMixList.innerHTML = "";
  generation.rows.slice(0, 10).forEach((row) => {
    const item = document.createElement("article");
    item.className = "mix-row";

    const header = document.createElement("div");
    header.className = "mix-row-header";

    const title = document.createElement("strong");
    title.textContent = row.title;
    const value = document.createElement("span");
    value.textContent = `${formatPercent(row.share)} · ${formatEnergy(row.value)}`;
    header.append(title, value);

    const meter = document.createElement("div");
    meter.className = "mix-meter";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(2, row.share * 100)}%`;
    fill.style.background = safeColor(row.color);
    meter.append(fill);

    item.append(header, meter);
    statsEls.generationMixList.append(item);
  });
}

function renderPriceChart(points, lowestHour, highestHour) {
  statsEls.priceChart.innerHTML = "";
  const prices = points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);

  points.forEach((point) => {
    const bar = document.createElement("div");
    bar.className = "stats-price-bar";
    if (point.hour === lowestHour) bar.classList.add("best");
    if (point.hour === highestHour) bar.classList.add("high");

    const fill = document.createElement("span");
    fill.style.height = `${18 + ((point.price - min) / range) * 78}%`;
    fill.title = `${formatHour(point.hour)}: ${formatPriceKwh(point.price)}`;

    const label = document.createElement("small");
    label.textContent = formatShortHour(point.hour);
    bar.append(fill, label);
    statsEls.priceChart.append(bar);
  });
}

async function fetchMarketData(date) {
  const backendURL = new URL(`${STATS_API_BASE.replace(/\/$/, "")}/market`, window.location.origin);
  backendURL.searchParams.set("date", date);

  try {
    const response = await fetch(backendURL, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
      if (data.payload) return data;
    }
  } catch {
    // Fall back to direct REE data when local backend routing is unavailable.
  }

  return {
    source: "ree",
    cacheStatus: "network",
    cachedAt: new Date().toISOString(),
    payload: await fetchReeWidget(STATS_MARKET_WIDGET, date, "hour")
  };
}

async function fetchGenerationData(date) {
  const backendURL = new URL(`${STATS_API_BASE.replace(/\/$/, "")}/generation`, window.location.origin);
  backendURL.searchParams.set("date", date);

  try {
    const response = await fetch(backendURL, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
      if (data.payload) return data;
    }
  } catch {
    // Fall back to direct REE data when local backend routing is unavailable.
  }

  return {
    source: "ree",
    cacheStatus: "network",
    cachedAt: new Date().toISOString(),
    payload: await fetchReeWidget(STATS_GENERATION_WIDGET, date, "day")
  };
}

async function fetchReeWidget(widget, date, timeTrunc) {
  const url = `${STATS_REE_API_BASE}/${widget}?start_date=${date}T00:00&end_date=${date}T23:59&time_trunc=${timeTrunc}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`La solicitud a REE falló con estado ${response.status}`);
  const data = await response.json();
  if (data.errors?.length) throw new Error(data.errors[0].detail || "REE devolvió un error");
  return data;
}

function parseMarketData(data) {
  const included = Array.isArray(data.included) ? data.included : [];
  const pvpc = findSeries(included, ["PVPC"]);
  const spot = findSeries(included, ["Spot market price", "spot"]);
  const series = hasValues(pvpc) ? pvpc : spot;
  if (!series?.attributes?.values?.length) return [];

  const hourly = new Map();
  series.attributes.values.forEach((item) => {
    const hour = Number(item.datetime?.match(/T(\d{2}):/)?.[1]);
    const value = Number(item.value);
    if (!Number.isFinite(hour) || !Number.isFinite(value)) return;
    const bucket = hourly.get(hour) || { total: 0, count: 0 };
    bucket.total += value;
    bucket.count += 1;
    hourly.set(hour, bucket);
  });

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourly.get(hour);
    if (!bucket) return null;
    return { hour, price: bucket.total / bucket.count };
  }).filter(Boolean);
}

function parseGenerationMix(data) {
  const included = Array.isArray(data.included) ? data.included : [];
  const rawRows = included
    .map((item) => {
      const attributes = item.attributes || {};
      const value = Array.isArray(attributes.values)
        ? attributes.values.reduce((sum, point) => sum + Number(point.value || 0), 0)
        : 0;
      return {
        title: generationTitle(attributes.title || item.type || "Desconocido"),
        value,
        color: attributes.color,
        type: attributes.type || "",
        lastUpdated: attributes["last-update"] || data.data?.attributes?.["last-update"] || ""
      };
    })
    .filter((row) => row.value > 0);

  const totalRow = rawRows.find((row) => {
    const title = row.title.toLowerCase();
    return row.type === "total" || title === "total generation" || title === "generación total";
  });
  const rows = rawRows.filter((row) => row !== totalRow);
  const total = totalRow?.value || rows.reduce((sum, row) => sum + row.value, 0);

  const enriched = rows
    .map((row) => ({
      ...row,
      share: total > 0 ? row.value / total : 0
    }))
    .sort((a, b) => b.value - a.value);

  return {
    rows: enriched,
    total,
    renewable: enriched.filter((row) => isRenewable(row)).reduce((sum, row) => sum + row.value, 0),
    windSolar: enriched.filter((row) => isWindOrSolar(row)).reduce((sum, row) => sum + row.value, 0),
    lastUpdated: latestIso(rawRows.map((row) => row.lastUpdated))
  };
}

function marketStats(points) {
  const lowest = points.reduce((best, point) => (point.price < best.price ? point : best), points[0]);
  const highest = points.reduce((worst, point) => (point.price > worst.price ? point : worst), points[0]);
  const average = points.reduce((sum, point) => sum + point.price, 0) / points.length;
  return { points, lowest, highest, average };
}

function findSeries(included, names) {
  return included.find((item) => {
    const title = `${item.type || ""} ${item.attributes?.title || ""}`.toLowerCase();
    return names.some((name) => title.includes(name.toLowerCase()));
  });
}

function hasValues(series) {
  return Array.isArray(series?.attributes?.values) && series.attributes.values.length > 0;
}

function isRenewable(row) {
  const type = row.type.toLowerCase();
  return type.includes("renovable") && !type.includes("no-renovable");
}

function isWindOrSolar(row) {
  const title = row.title.toLowerCase();
  return title.includes("eólica") || title.includes("solar");
}

function generationTitle(title) {
  return GENERATION_TITLE_ES[title] || title;
}

function aggregateCacheStatus(statuses) {
  if (statuses.includes("miss") || statuses.includes("network")) return "fresh";
  if (statuses.includes("stale")) return "stale";
  if (statuses.includes("database")) return "database";
  return "cache";
}

function sourceLabel(cacheStatus) {
  const labels = {
    fresh: "Datos REE recientes",
    stale: "Caché antigua",
    database: "Base de datos backend",
    cache: "Caché del backend"
  };
  return labels[cacheStatus] || "Caché del backend";
}

function latestIso(values) {
  return values
    .filter((value) => value && !Number.isNaN(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "";
}

function madridDateString(offsetDays) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STATS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = Number(partValue(parts, "year"));
  const month = Number(partValue(parts, "month"));
  const day = Number(partValue(parts, "day"));
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function partValue(parts, type) {
  return parts.find((part) => part.type === type)?.value || "0";
}

function isValidDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function clampShare(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#12836f";
}

function formatPercent(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value || 0);
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(value || 0);
}

function formatEuroPerKwh(value) {
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(value || 0)} €/kWh`;
}

function formatPriceKwh(value) {
  return formatEuroPerKwh((value || 0) / 1000);
}

function formatEnergy(value) {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)} TWh`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} GWh`;
  return `${value.toFixed(0)} MWh`;
}

function formatHour(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const value = normalized % 12 || 12;
  return `${value} ${suffix}`;
}

function formatShortHour(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  return String(normalized).padStart(2, "0");
}

function formatDateTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "desconocida";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: STATS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
