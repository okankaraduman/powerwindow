import { summarizeInstalledCapacity } from "./shared/installed-capacity.mjs";

const english = document.documentElement.lang === "en";
const locale = english ? "en-GB" : "es-ES";
const copy = english ? {
  loading: "Loading installed capacity…", unavailable: "Installed capacity is unavailable. Try Update again.",
  other: "Other technologies",
  cached: "Cached REE data", network: "REE data", stale: "Cached REE data; refresh unavailable",
  observed: "Latest observation", change: "Change from the same month last year",
  comparisonUnavailable: "Year-over-year comparison unavailable", trendUnavailable: "Long-term capacity trend unavailable"
} : {
  loading: "Cargando potencia instalada…", unavailable: "La potencia instalada no está disponible. Pulsa Actualizar para reintentar.",
  other: "Otras tecnologías",
  cached: "Datos REE en caché", network: "Datos REE", stale: "Datos REE en caché; actualización no disponible",
  observed: "Último dato", change: "Cambio frente al mismo mes del año anterior",
  comparisonUnavailable: "Comparación interanual no disponible", trendUnavailable: "Evolución histórica no disponible"
};
const spanishTechnologyNames = {
  "Hydro": "Hidráulica", "Nuclear": "Nuclear", "Coal": "Carbón",
  "Fuel + Gas": "Fuel + gas", "Diesel engines": "Motores diésel",
  "Gas turbine": "Turbina de gas", "Steam turbine": "Turbina de vapor",
  "Combined cycle": "Ciclo combinado", "Hydroeolian": "Hidroeólica",
  "Wind": "Eólica", "Solar photovoltaic": "Solar fotovoltaica",
  "Thermal solar": "Solar térmica", "Other renewables": "Otras renovables",
  "Cogeneration": "Cogeneración", "Non-renewable waste": "Residuos no renovables",
  "Renewable waste": "Residuos renovables"
};
const status = document.querySelector("#installedCapacityStatus");
const total = document.querySelector("#installedCapacityTotal");
const date = document.querySelector("#installedCapacityDate");
const change = document.querySelector("#installedCapacityChange");
const trend = document.querySelector("#installedCapacityTrend");
const legend = document.querySelector("#installedCapacityLegend");
const list = document.querySelector("#installedCapacityList");
const formatMw = (mw) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(mw)} MW`;
const formatMonth = (value) => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${value}T12:00:00Z`));
let loading = false;

document.querySelector("#statsRefreshButton").addEventListener("click", () => loadInstalledCapacity(true));
loadInstalledCapacity();

async function loadInstalledCapacity(forceRefresh = false) {
  if (loading) return;
  loading = true;
  status.textContent = copy.loading;
  list.setAttribute("aria-busy", "true");
  try {
    let apiBase;
    try { apiBase = localStorage.getItem("POWER_WINDOW_API_BASE"); } catch { /* Storage is optional. */ }
    apiBase ||= ["powerwindow.energy", "www.powerwindow.energy"].includes(window.location.hostname)
      ? "https://api.powerwindow.energy/api" : "/api";
    const url = new URL(`${apiBase.replace(/\/$/, "")}/statistics/capacity`, window.location.origin);
    if (forceRefresh) url.searchParams.set("refresh", "1");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Capacity request failed");
    const data = await response.json();
    const snapshot = data.technologies ? data : summarizeInstalledCapacity(data.payload);
    if (!snapshot?.technologies?.length || !Number.isFinite(snapshot.totalMw)) throw new Error("No capacity data");
    const observed = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
      .format(new Date(`${snapshot.date}T12:00:00Z`));
    total.textContent = formatMw(snapshot.totalMw);
    date.textContent = `${copy.observed}: ${observed}`;
    const previous = data.previous?.technologies?.length ? data.previous : null;
    const delta = previous ? snapshot.totalMw - previous.totalMw : null;
    const percent = previous ? delta / previous.totalMw : null;
    change.textContent = previous
      ? `${copy.change}: ${delta >= 0 ? "+" : "−"}${formatMw(Math.abs(delta))} (${new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "always" }).format(percent)})`
      : copy.comparisonUnavailable;
    renderCapacityTrend(data.history || []);
    legend.replaceChildren(...(previous ? [
      legendItem(formatMonth(previous.date), "previous"),
      legendItem(formatMonth(snapshot.date), "current")
    ] : [legendItem(formatMonth(snapshot.date), "current")]));
    const top = snapshot.technologies.slice(0, 8);
    const remaining = snapshot.technologies.slice(8).reduce((sum, item) => sum + item.mw, 0);
    const rows = remaining > 0 ? [...top, { name: copy.other, mw: remaining }] : top;
    const previousByName = new Map(previous?.technologies.map((item) => [item.name, item.mw]) || []);
    const previousOther = previous ? Math.max(0, previous.totalMw - top.reduce((sum, item) =>
      sum + (previousByName.get(item.name) || 0), 0)) : 0;
    const maximum = Math.max(...rows.flatMap((item) => [item.mw,
      item.name === copy.other ? previousOther : (previousByName.get(item.name) || 0)]));
    list.replaceChildren(...rows.map((item) => {
      const row = document.createElement("div");
      row.className = "installed-capacity-row";
      const label = document.createElement("h4");
      label.textContent = english ? item.name : (spanishTechnologyNames[item.name] || item.name);
      row.append(label);
      if (previous) row.append(capacityBar(formatMonth(previous.date),
        item.name === copy.other ? previousOther : (previousByName.get(item.name) || 0), maximum, "previous"));
      row.append(capacityBar(formatMonth(snapshot.date), item.mw, maximum, "current"));
      return row;
    }));
    status.textContent = data.cacheStatus === "stale" ? copy.stale :
      data.cacheStatus === "hit" ? copy.cached : copy.network;
  } catch {
    status.textContent = copy.unavailable;
    total.textContent = "--";
    date.textContent = "";
    change.textContent = "";
    trend.replaceChildren();
    legend.replaceChildren();
    list.replaceChildren();
  } finally {
    list.setAttribute("aria-busy", "false");
    loading = false;
  }
}

function renderCapacityTrend(history) {
  if (history.length < 2) {
    trend.textContent = copy.trendUnavailable;
    return;
  }
  const maximum = Math.max(...history.map((item) => item.totalMw));
  trend.replaceChildren(...history.map((item, index) => {
    const row = document.createElement("div");
    row.className = `installed-capacity-trend-row${index === history.length - 1 ? " is-latest" : ""}`;
    const year = document.createElement("span");
    year.textContent = item.date.slice(0, 4);
    const track = document.createElement("span");
    track.className = "installed-capacity-trend-track";
    track.setAttribute("aria-hidden", "true");
    const bar = document.createElement("span");
    bar.style.width = `${item.totalMw / maximum * 100}%`;
    track.append(bar);
    const value = document.createElement("strong");
    value.textContent = formatMw(item.totalMw);
    const change = document.createElement("small");
    const previous = history[index - 1];
    change.textContent = previous && Number(item.date.slice(0, 4)) === Number(previous.date.slice(0, 4)) + 1
      ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "always" })
        .format((item.totalMw - previous.totalMw) / previous.totalMw)
      : "";
    row.append(year, track, value, change);
    return row;
  }));
}

function legendItem(label, kind) {
  const item = document.createElement("span");
  item.className = `installed-capacity-legend-${kind}`;
  item.textContent = label;
  return item;
}

function capacityBar(period, mw, maximum, kind) {
  const line = document.createElement("div");
  line.className = `installed-capacity-bar-line installed-capacity-bar-line-${kind}`;
  const label = document.createElement("span");
  label.textContent = period;
  const track = document.createElement("span");
  track.className = "installed-capacity-track";
  track.setAttribute("aria-hidden", "true");
  const bar = document.createElement("span");
  bar.className = "installed-capacity-bar";
  bar.style.width = `${Math.max(0, Math.min(100, mw / maximum * 100))}%`;
  track.append(bar);
  const value = document.createElement("strong");
  value.textContent = formatMw(mw);
  line.append(label, track, value);
  return line;
}
