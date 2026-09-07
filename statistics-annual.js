import { annualGenerationRange, annualGenerationPeriods, mergeAnnualGenerationPayloads, summarizeAnnualGeneration, formatGenerationKwh } from "./shared/annual-generation.mjs";

const english = document.documentElement.lang === "en";
const locale = english ? "en-GB" : "es-ES";
const copy = english ? {
  loading: "Loading annual generation…", unavailable: "Annual generation is unavailable. Try Update again.",
  missing: "Data unavailable for this year", renewable: "Renewable", nonRenewable: "Non-renewable",
  total: "Total", cached: "Cached REE data", network: "REE data", stale: "Cached REE data; refresh unavailable",
  period: "Five complete years + current year to date", updated: "Updated",
  ytd: "Year to date", through: "Requested through", provisional: "Partial year; latest available REE data",
  chart: "Yearly renewable and non-renewable generation", axis: "Billion kWh", partial: "Dashed lines: year to date"
} : {
  loading: "Cargando generación anual…", unavailable: "La generación anual no está disponible. Pulsa Actualizar para reintentar.",
  missing: "Datos no disponibles para este año", renewable: "Renovable", nonRenewable: "No renovable",
  total: "Total", cached: "Datos REE en caché", network: "Datos REE", stale: "Datos REE en caché; actualización no disponible",
  period: "Cinco años completos + año en curso", updated: "Actualizado",
  ytd: "En curso", through: "Solicitado hasta", provisional: "Año parcial; últimos datos disponibles de REE",
  chart: "Generación anual renovable y no renovable", axis: "Miles de millones de kWh", partial: "Líneas discontinuas: año en curso"
};
const status = document.querySelector("#annualGenerationStatus");
const list = document.querySelector("#annualGenerationList");
const chart = document.querySelector("#annualGenerationChart");
let loading = false;
let chartData = null;
new ResizeObserver(() => {
  if (chartData) renderAnnualChart(...chartData);
}).observe(chart);

document.querySelector("#statsRefreshButton").addEventListener("click", () => loadAnnualGeneration(true));
loadAnnualGeneration();

async function loadAnnualGeneration(forceRefresh = false) {
  if (loading) return;
  loading = true;
  status.textContent = copy.loading;
  list.replaceChildren();
  chartData = null;
  chart.replaceChildren();
  list.setAttribute("aria-busy", "true");
  try {
    const range = annualGenerationRange();
    const response = await fetchAnnualGeneration(range, forceRefresh);
    const years = summarizeAnnualGeneration(response.payload, range);
    if (!years.some((year) => year.available)) throw new Error("No annual generation data");
    years.forEach((year) => renderYear(year, { ...range, endDate: response.endDate || range.endDate }));
    chartData = [years, range];
    renderAnnualChart(...chartData);
    const source = response.cacheStatus === "stale" ? copy.stale :
      response.cacheStatus === "hit" ? copy.cached : copy.network;
    const updated = response.cachedAt && !Number.isNaN(Date.parse(response.cachedAt))
      ? ` · ${copy.updated}: ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(response.cachedAt))}`
      : "";
    status.textContent = `${range.startYear}–${range.endYear} · ${copy.period} · ${source}${updated}`;
  } catch {
    status.textContent = copy.unavailable;
  } finally {
    list.setAttribute("aria-busy", "false");
    loading = false;
  }
}

async function fetchAnnualGeneration(range, forceRefresh) {
  let apiBase;
  try { apiBase = localStorage.getItem("POWER_WINDOW_API_BASE"); } catch { /* Storage is optional. */ }
  apiBase ||= ["powerwindow.energy", "www.powerwindow.energy"].includes(window.location.hostname)
    ? "https://api.powerwindow.energy/api" : "/api";
  const url = new URL(`${apiBase.replace(/\/$/, "")}/statistics/years`, window.location.origin);
  if (forceRefresh) url.searchParams.set("refresh", "1");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json();
      if (data.endYear === range.endYear && data.endDate &&
          summarizeAnnualGeneration(data.payload, range).some((year) => year.available)) return data;
    }
  } catch { /* Static hosting can use REE directly. */ }
  const payloads = await Promise.allSettled(annualGenerationPeriods(range).map(async (period) => {
    const reeUrl = new URL("https://apidatos.ree.es/en/datos/generacion/estructura-generacion");
    reeUrl.searchParams.set("start_date", `${period.startDate}T00:00`);
    reeUrl.searchParams.set("end_date", `${period.endDate}T23:59`);
    reeUrl.searchParams.set("time_trunc", "year");
    const response = await fetch(reeUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("REE request failed");
    return response.json();
  }));
  const payload = mergeAnnualGenerationPayloads(payloads
    .filter((result) => result.status === "fulfilled").map((result) => result.value));
  return { ...range, payload, cacheStatus: "network", cachedAt: new Date().toISOString() };
}

function renderYear(year, range) {
  const card = document.createElement("article");
  card.className = "annual-generation-card";
  const heading = document.createElement("h3");
  heading.textContent = year.year;
  const label = document.createElement("div");
  label.append(heading);
  if (year.year === range.endYear) {
    const badge = document.createElement("small");
    badge.textContent = copy.ytd;
    label.append(badge);
  }
  card.append(label);
  if (!year.available) {
    const message = document.createElement("p");
    message.textContent = copy.missing;
    card.append(message);
  } else {
    const percent = (value) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
    const energy = (value) => formatGenerationKwh(value, locale);
    const content = document.createElement("div");
    content.className = "annual-generation-detail";
    content.innerHTML = `
      <dl class="annual-generation-values">
        <div><dt>${copy.renewable} · ${percent(year.renewableShare)}</dt><dd>${energy(year.renewableMwh)}</dd></div>
        <div><dt>${copy.nonRenewable} · ${percent(year.nonRenewableShare)}</dt><dd>${energy(year.nonRenewableMwh)}</dd></div>
        <div><dt>${copy.total}</dt><dd>${energy(year.totalMwh)}</dd></div>
      </dl>`;
    if (year.year === range.endYear) {
      const period = document.createElement("p");
      period.className = "annual-generation-period";
      const endDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
        .format(new Date(`${range.endDate}T12:00:00Z`));
      period.textContent = `${copy.through} ${endDate} · ${copy.provisional}`;
      content.prepend(period);
    }
    card.append(content);
  }
  list.append(card);
}

function renderAnnualChart(years, range) {
  const width = Math.max(280, chart.clientWidth);
  const height = 280;
  const left = 42;
  const right = width - 24;
  const top = 20;
  const bottom = height - 36;
  const available = years.filter((year) => year.available);
  const maxValue = Math.max(...available.flatMap((year) => [year.renewableMwh, year.nonRenewableMwh]));
  const step = Math.max(1, Math.ceil(maxValue / 4 / 10000000)) * 10000000;
  const x = (index) => left + (index / (years.length - 1)) * (right - left);
  const y = (value) => bottom - (value / (step * 4)) * (bottom - top);
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${copy.chart}. ${copy.axis}. ${copy.partial}.`);
  const add = (tag, attributes, text) => {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text != null) node.textContent = text;
    svg.append(node);
    return node;
  };
  for (let tick = 0; tick <= 4; tick++) {
    const value = tick * step;
    add("line", { x1: left, x2: right, y1: y(value), y2: y(value), class: "annual-chart-grid" });
    add("text", { x: left - 10, y: y(value) + 4, "text-anchor": "end", class: "annual-chart-axis" },
      new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1000000));
  }
  years.forEach((year, index) => add("text", {
    x: x(index), y: height - 10, "text-anchor": "middle", class: "annual-chart-axis"
  }, `${year.year}${year.year === range.endYear ? "*" : ""}`));
  for (const [key, label, color] of [
    ["renewableMwh", copy.renewable, "#176b50"],
    ["nonRenewableMwh", copy.nonRenewable, "#a96925"]
  ]) {
    years.forEach((year, index) => {
      if (!year.available) return;
      const previous = years[index - 1];
      if (previous?.available) add("line", {
        x1: x(index - 1), y1: y(previous[key]), x2: x(index), y2: y(year[key]),
        stroke: color, "stroke-width": 3,
        "stroke-dasharray": year.year === range.endYear ? "6 5" : "none"
      });
      const point = add("circle", {
        cx: x(index), cy: y(year[key]), r: 4, stroke: color, "stroke-width": 2,
        fill: year.year === range.endYear ? "#fff" : color
      });
      const title = document.createElementNS(svgNS, "title");
      title.textContent = `${year.year}${year.year === range.endYear ? ` · ${copy.ytd}` : ""} · ${label}: ${formatGenerationKwh(year[key], locale)}`;
      point.append(title);
    });
  }
  const legend = document.createElement("div");
  legend.className = "annual-chart-legend";
  legend.innerHTML = `<span class="annual-chart-renewable">${copy.renewable}</span><span class="annual-chart-nonrenewable">${copy.nonRenewable}</span>`;
  const axisLabel = document.createElement("p");
  axisLabel.className = "annual-generation-period";
  axisLabel.textContent = copy.axis;
  const note = document.createElement("p");
  note.className = "annual-generation-period";
  note.textContent = `* ${range.endYear} · ${copy.partial}`;
  chart.replaceChildren(legend, axisLabel, svg, note);
}
