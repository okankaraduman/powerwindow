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
const STATS_REE_RANGE_CHUNK_DAYS = 30;

const statsEls = {
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
  statsEls.refreshButton.addEventListener("click", () => loadSeasonStatistics({ forceRefresh: true }));
  loadSeasonStatistics();
}

async function loadSeasonStatistics(options = {}) {
  setLoadingState();

  try {
    const response = await fetchSeasonStatistics(options);
    const seasons = response.seasons.map(summarizeSeason).sort(seasonSort);
    if (seasons.length < 2) throw new Error("Could not load both seasons");

    renderSeasonStatistics({
      seasons,
      cacheStatus: response.cacheStatus,
      cachedAt: response.cachedAt
    });
  } catch (error) {
    renderStatisticsError(error);
  }
}

function setLoadingState() {
  statsEls.refreshButton.disabled = true;
  statsEls.dataStatus.textContent = "Loading";
  statsEls.dataNote.textContent = "Fetching seasonal ranges";
  statsEls.lastUpdated.textContent = "Last update pending";
  statsEls.heroTitle.textContent = "Loading seasons...";
  statsEls.heroReason.textContent =
    "Fetching cached REE price and generation data for summer and winter.";
  statsEls.priceChart.classList.remove("season-hour-chart");
}

async function fetchSeasonStatistics(options = {}) {
  const backendURL = new URL(`${STATS_API_BASE.replace(/\/$/, "")}/statistics/seasons`, window.location.origin);
  if (options.forceRefresh) backendURL.searchParams.set("refresh", "1");

  try {
    const response = await fetch(backendURL, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.seasons) && data.seasons.length) return data;
    }
  } catch {
    // Fall back to direct REE range data when local backend routing is unavailable.
  }

  const ranges = seasonRangesForDate(madridDateString(0));
  const seasons = await Promise.all(
    ranges.map(async (range) => {
      const [marketPayload, generationPayload] = await Promise.all([
        fetchReeChunkedRangeWidget(STATS_MARKET_WIDGET, range.startDate, range.endDate, "hour"),
        fetchReeChunkedRangeWidget(STATS_GENERATION_WIDGET, range.startDate, range.endDate, "day")
      ]);
      const cachedAt = new Date().toISOString();
      return {
        ...range,
        market: { cachedAt, payload: marketPayload },
        generation: { cachedAt, payload: generationPayload }
      };
    })
  );

  return {
    source: "ree",
    cacheStatus: "network",
    cachedAt: new Date().toISOString(),
    seasons
  };
}

async function fetchReeChunkedRangeWidget(widget, startDate, endDate, timeTrunc) {
  const chunks = chunkDateRange(startDate, endDate, STATS_REE_RANGE_CHUNK_DAYS);
  const payloads = [];
  for (const chunk of chunks) {
    payloads.push(await fetchReeRangeWidget(widget, chunk.startDate, chunk.endDate, timeTrunc));
  }
  return mergeReePayloads(payloads);
}

async function fetchReeRangeWidget(widget, startDate, endDate, timeTrunc) {
  const url = `${STATS_REE_API_BASE}/${widget}?start_date=${startDate}T00:00&end_date=${endDate}T23:59&time_trunc=${timeTrunc}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`REE request failed with ${response.status}`);
  const data = await response.json();
  if (data.errors?.length) throw new Error(data.errors[0].detail || "REE returned an error");
  return data;
}

function mergeReePayloads(payloads) {
  const validPayloads = payloads.filter(Boolean);
  if (validPayloads.length <= 1) return validPayloads[0] || {};

  const first = validPayloads[0];
  const series = new Map();
  validPayloads.forEach((payload) => {
    const included = Array.isArray(payload.included) ? payload.included : [];
    included.forEach((item) => {
      const key = `${item.type || ""}:${item.id || ""}:${item.attributes?.title || ""}`;
      const values = Array.isArray(item.attributes?.values) ? item.attributes.values : [];
      const existing = series.get(key);
      if (existing) {
        existing.attributes.values.push(...values);
        return;
      }

      series.set(key, {
        ...item,
        attributes: {
          ...(item.attributes || {}),
          values: [...values]
        }
      });
    });
  });

  const lastUpdate = latestIso(
    validPayloads
      .map((payload) => payload.data?.attributes?.["last-update"])
      .filter(Boolean)
  );

  return {
    ...first,
    data: {
      ...(first.data || {}),
      attributes: {
        ...(first.data?.attributes || {}),
        ...(lastUpdate ? { "last-update": lastUpdate } : {})
      }
    },
    included: Array.from(series.values()).map((item) => ({
      ...item,
      attributes: {
        ...(item.attributes || {}),
        values: dedupeValuesByDatetime(item.attributes?.values || [])
      }
    }))
  };
}

function dedupeValuesByDatetime(values) {
  const byDatetime = new Map();
  values.forEach((value) => {
    if (!value?.datetime) return;
    byDatetime.set(value.datetime, value);
  });
  return Array.from(byDatetime.values()).sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime))
  );
}

function summarizeSeason(season) {
  const marketPoints = parseMarketPoints(season.market?.payload);
  const generation = parseGenerationMix(season.generation?.payload);

  if (!marketPoints.length) throw new Error(`No PVPC series for ${season.id}`);
  if (!generation.rows.length || generation.total <= 0) {
    throw new Error(`No generation mix for ${season.id}`);
  }

  const market = marketStats(marketPoints);
  return {
    ...season,
    label: seasonLabel(season),
    shortLabel: season.id === "summer" ? "Summer" : "Winter",
    dateLabel: formatDateRange(season.startDate, season.endDate),
    market,
    generation
  };
}

function renderSeasonStatistics({ seasons, cacheStatus, cachedAt }) {
  const summer = seasons.find((season) => season.id === "summer") || seasons[0];
  const winter = seasons.find((season) => season.id === "winter") || seasons[1];
  const cheaper = summer.market.average <= winter.market.average ? summer : winter;
  const pricier = cheaper === summer ? winter : summer;
  const priceDiff = Math.abs(summer.market.average - winter.market.average);
  const tenKwhDiff = (priceDiff / 1000) * 10;
  const moreRenewable =
    summer.generation.renewableShare >= winter.generation.renewableShare ? summer : winter;
  const lessRenewable = moreRenewable === summer ? winter : summer;

  statsEls.refreshButton.disabled = false;
  statsEls.dataStatus.textContent = sourceLabel(cacheStatus);
  statsEls.dataNote.textContent = `${summer.label}: ${summer.dateLabel} · ${winter.label}: ${winter.dateLabel}`;
  statsEls.lastUpdated.textContent = cachedAt ? `Cached: ${formatDateTime(cachedAt)}` : "Cached time unavailable";
  statsEls.controlHint.textContent =
    `${summer.label} includes ${summer.market.dayCount} price days; ${winter.label} includes ${winter.market.dayCount} days.`;

  statsEls.heroTitle.textContent = `${cheaper.shortLabel} is cheaper`;
  statsEls.heroReason.textContent =
    `${cheaper.label} has an average PVPC component of ${formatEuroPerKwh(cheaper.market.average / 1000)}, versus ${formatEuroPerKwh(pricier.market.average / 1000)} in ${pricier.label}. ` +
    `For a 10 kWh flexible load, the average difference is ${formatMoney(tenKwhDiff)}.`;

  statsEls.renewableRate.textContent = formatEuroPerKwh(summer.market.average / 1000);
  statsEls.renewableHint.textContent =
    `${summer.label}: lowest ${formatEuroPerKwh(summer.market.lowest.price / 1000)} on ${formatDateTime(summer.market.lowest.datetime)}.`;
  statsEls.windSolarRate.textContent = formatEuroPerKwh(winter.market.average / 1000);
  statsEls.windSolarHint.textContent =
    `${winter.label}: lowest ${formatEuroPerKwh(winter.market.lowest.price / 1000)} on ${formatDateTime(winter.market.lowest.datetime)}.`;
  statsEls.lowestPvpcHour.textContent = moreRenewable.shortLabel;
  statsEls.lowestPvpcHint.textContent =
    `${moreRenewable.label}: ${formatPercent(moreRenewable.generation.renewableShare)} renewable; ${lessRenewable.label}: ${formatPercent(lessRenewable.generation.renewableShare)}.`;
  statsEls.timingSpread.textContent = formatMoney(tenKwhDiff);
  statsEls.timingSpreadHint.textContent =
    `${cheaper.shortLabel} is ${formatEuroPerKwh(priceDiff / 1000)} cheaper per kWh on average than ${pricier.shortLabel}.`;

  statsEls.generationMixNote.textContent =
    `${summer.label}: ${formatPercent(summer.generation.renewableShare)} renewable. ${winter.label}: ${formatPercent(winter.generation.renewableShare)} renewable.`;
  renderGenerationStack(summer);
  renderGenerationRows([summer, winter]);

  statsEls.priceShapeNote.textContent =
    `Average by hour in ${summer.label} and ${winter.label}. Amber bars: summer; blue bars: winter. Prices in €/kWh.`;
  renderPriceChart(summer, winter);
}

function renderStatisticsError(error) {
  statsEls.refreshButton.disabled = false;
  statsEls.dataStatus.textContent = "Unavailable";
  statsEls.dataNote.textContent = "Seasonal statistics could not be loaded";
  statsEls.lastUpdated.textContent = error.message || "Unknown error";
  statsEls.heroTitle.textContent = "No statistics available";
  statsEls.heroReason.textContent =
    "Refresh later or try again once the backend cache has the seasonal ranges.";
  statsEls.renewableRate.textContent = "--";
  statsEls.windSolarRate.textContent = "--";
  statsEls.lowestPvpcHour.textContent = "--";
  statsEls.timingSpread.textContent = "--";
  statsEls.generationMixList.innerHTML = "";
  statsEls.priceChart.innerHTML = "";
}

function renderGenerationStack(season) {
  const renewableShare = clampShare(season.generation.renewableShare);
  statsEls.renewableStack.style.width = `${renewableShare * 100}%`;
  statsEls.renewableStack.textContent = `${season.shortLabel} renewable ${formatPercent(renewableShare)}`;
  statsEls.nonRenewableStack.style.width = `${(1 - renewableShare) * 100}%`;
  statsEls.nonRenewableStack.textContent = `Other ${formatPercent(1 - renewableShare)}`;
}

function renderGenerationRows(seasons) {
  statsEls.generationMixList.innerHTML = "";
  seasons.forEach((season) => {
    const item = document.createElement("article");
    item.className = "mix-row season-card";

    const header = document.createElement("div");
    header.className = "mix-row-header";

    const title = document.createElement("strong");
    title.textContent = season.label;
    const value = document.createElement("span");
    value.textContent = season.dateLabel;
    header.append(title, value);

    const summary = document.createElement("p");
    summary.className = "season-card-summary";
    summary.textContent =
      `${formatPercent(season.generation.renewableShare)} renewable · ${formatPercent(season.generation.windSolarShare)} solar + wind · ${formatEnergy(season.generation.total)} total`;

    const rows = document.createElement("div");
    rows.className = "season-tech-list";
    season.generation.rows.slice(0, 5).forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "season-tech-row";
      rowEl.innerHTML = `
        <span>${escapeHTML(row.title)}</span>
        <strong>${formatPercent(row.share)}</strong>
      `;
      rows.append(rowEl);
    });

    item.append(header, summary, rows);
    statsEls.generationMixList.append(item);
  });
}

function renderPriceChart(summer, winter) {
  statsEls.priceChart.innerHTML = "";
  statsEls.priceChart.classList.add("season-hour-chart");
  const prices = [...summer.market.hourlyAverages, ...winter.market.hourlyAverages].map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);

  Array.from({ length: 24 }, (_, hour) => {
    const summerPoint = summer.market.hourlyAverages.find((point) => point.hour === hour);
    const winterPoint = winter.market.hourlyAverages.find((point) => point.hour === hour);
    const group = document.createElement("div");
    group.className = "season-hour-group";

    const bars = document.createElement("div");
    bars.className = "season-hour-bars";
    bars.append(
      seasonPriceBar(summerPoint, min, range, "summer-price-bar", summer.label),
      seasonPriceBar(winterPoint, min, range, "winter-price-bar", winter.label)
    );

    const label = document.createElement("small");
    label.textContent = formatShortHour(hour);
    group.append(bars, label);
    statsEls.priceChart.append(group);
  });
}

function seasonPriceBar(point, min, range, className, label) {
  const bar = document.createElement("span");
  bar.className = className;
  const price = point?.price || 0;
  bar.style.height = `${18 + ((price - min) / range) * 78}%`;
  bar.title = `${label} · ${formatHour(point?.hour || 0)}: ${formatPriceKwh(price)}`;
  return bar;
}

function parseMarketPoints(data) {
  const included = Array.isArray(data?.included) ? data.included : [];
  const pvpc = findSeries(included, ["PVPC"]);
  const spot = findSeries(included, ["Spot market price", "spot"]);
  const series = hasValues(pvpc) ? pvpc : spot;
  if (!series?.attributes?.values?.length) return [];

  return series.attributes.values
    .map((item) => {
      const match = item.datetime?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):/);
      const value = Number(item.value);
      if (!match || !Number.isFinite(value)) return null;
      return {
        datetime: item.datetime,
        date: match[1],
        hour: Number(match[2]),
        price: value
      };
    })
    .filter(Boolean);
}

function parseGenerationMix(data) {
  const included = Array.isArray(data?.included) ? data.included : [];
  const rawRows = included
    .map((item) => {
      const attributes = item.attributes || {};
      const value = Array.isArray(attributes.values)
        ? attributes.values.reduce((sum, point) => sum + Number(point.value || 0), 0)
        : 0;
      return {
        title: attributes.title || item.type || "Unknown",
        value,
        color: attributes.color,
        type: attributes.type || "",
        lastUpdated: attributes["last-update"] || data.data?.attributes?.["last-update"] || ""
      };
    })
    .filter((row) => row.value > 0);

  const totalRow = rawRows.find((row) => row.type === "total" || row.title.toLowerCase() === "total generation");
  const rows = rawRows.filter((row) => row !== totalRow);
  const total = totalRow?.value || rows.reduce((sum, row) => sum + row.value, 0);

  const enriched = rows
    .map((row) => ({
      ...row,
      share: total > 0 ? row.value / total : 0
    }))
    .sort((a, b) => b.value - a.value);
  const renewable = enriched.filter((row) => isRenewable(row)).reduce((sum, row) => sum + row.value, 0);
  const windSolar = enriched.filter((row) => isWindOrSolar(row)).reduce((sum, row) => sum + row.value, 0);

  return {
    rows: enriched,
    total,
    renewable,
    windSolar,
    renewableShare: total > 0 ? renewable / total : 0,
    windSolarShare: total > 0 ? windSolar / total : 0,
    lastUpdated: latestIso(rawRows.map((row) => row.lastUpdated))
  };
}

function marketStats(points) {
  const lowest = points.reduce((best, point) => (point.price < best.price ? point : best), points[0]);
  const highest = points.reduce((worst, point) => (point.price > worst.price ? point : worst), points[0]);
  const average = points.reduce((sum, point) => sum + point.price, 0) / points.length;
  const uniqueDays = new Set(points.map((point) => point.date));
  return {
    points,
    lowest,
    highest,
    average,
    dayCount: uniqueDays.size,
    hourlyAverages: hourlyAverages(points)
  };
}

function hourlyAverages(points) {
  const buckets = new Map();
  points.forEach((point) => {
    const bucket = buckets.get(point.hour) || { total: 0, count: 0 };
    bucket.total += point.price;
    bucket.count += 1;
    buckets.set(point.hour, bucket);
  });
  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = buckets.get(hour);
    return {
      hour,
      price: bucket?.count ? bucket.total / bucket.count : 0
    };
  });
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
  return title.includes("wind") || title.includes("solar");
}

function seasonRangesForDate(dateValue) {
  const { year, month } = parseDateParts(dateValue);
  const summerYear = month < 6 ? year - 1 : year;
  const summerStart = dateFromParts(summerYear, 6, 1);
  const summerNaturalEnd = dateFromParts(summerYear, 8, 31);
  const summerEnd =
    dateValue >= summerStart && dateValue < summerNaturalEnd ? dateValue : summerNaturalEnd;

  let winterStart;
  let winterEnd;
  if (month === 12) {
    winterStart = dateFromParts(year, 12, 1);
    winterEnd = dateValue;
  } else if (month <= 2) {
    winterStart = dateFromParts(year - 1, 12, 1);
    winterEnd = dateValue;
  } else {
    winterStart = dateFromParts(year - 1, 12, 1);
    winterEnd = dateFromParts(year, 2, lastDayOfMonth(year, 2));
  }

  return [
    { id: "summer", startDate: summerStart, endDate: summerEnd, complete: summerEnd === summerNaturalEnd },
    { id: "winter", startDate: winterStart, endDate: winterEnd, complete: month > 2 && month < 12 }
  ];
}

function chunkDateRange(startDate, endDate, maxDays) {
  const chunks = [];
  let cursor = dateToEpochDay(startDate);
  const end = dateToEpochDay(endDate);

  while (cursor <= end) {
    const chunkEnd = Math.min(end, cursor + maxDays - 1);
    chunks.push({
      startDate: epochDayToDate(cursor),
      endDate: epochDayToDate(chunkEnd)
    });
    cursor = chunkEnd + 1;
  }

  return chunks;
}

function seasonSort(a, b) {
  const order = { summer: 0, winter: 1 };
  return (order[a.id] ?? 9) - (order[b.id] ?? 9);
}

function seasonLabel(season) {
  const startYear = Number(season.startDate.slice(0, 4));
  const endYear = Number(season.endDate.slice(0, 4));
  if (season.id === "summer") {
    return `Summer ${startYear}${season.complete ? "" : " so far"}`;
  }
  return `Winter ${startYear}-${String(endYear).slice(2)}${season.complete ? "" : " so far"}`;
}

function sourceLabel(cacheStatus) {
  const labels = {
    miss: "Fresh REE data",
    network: "Direct REE data",
    stale: "Stale cache",
    database: "Backend database",
    hit: "Backend cache",
    cache: "Backend cache"
  };
  return labels[cacheStatus] || "Backend cache";
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

function parseDateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function dateFromParts(year, month, day) {
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function dateToEpochDay(value) {
  const { year, month, day } = parseDateParts(value);
  return Math.floor(Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000));
}

function epochDayToDate(epochDay) {
  const date = new Date(epochDay * 24 * 60 * 60 * 1000);
  return dateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampShare(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatPercent(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value || 0);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(value || 0);
}

function formatEuroPerKwh(value) {
  return `${new Intl.NumberFormat("en-GB", {
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

function formatDateRange(startDate, endDate) {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "unknown";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: STATS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}
