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
    renderTechnologyHistory(data.history || []);
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

function renderTechnologyHistory(history) {
  legend.replaceChildren();
  list.replaceChildren();
  const periods = [...history].sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
  if (periods.length < 2) { list.textContent = copy.trendUnavailable; return; }
  const colors = ["#176b52", "#3379a0", "#ad652c", "#8163a3", "#b03e56", "#648126", "#397e80", "#776754"];
  const names = periods.at(-1).technologies.slice(0, 8).map(item => item.name);
  const maximum = Math.ceil(Math.max(...periods.flatMap(p => p.technologies.filter(t => names.includes(t.name)).map(t => t.mw))) / 10000) * 10000;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 800 380");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", english ? "Installed capacity by technology over six years, MW" : "Potencia instalada por tecnología durante seis años, MW");
  svg.style.cssText = "width:100%;height:auto;display:block";
  const add = (tag, attrs, label) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    if (label) el.textContent = label;
    svg.append(el); return el;
  };
  const x = i => 70 + i * 700 / (periods.length - 1);
  const y = mw => 330 - mw / maximum * 300;
  for (let i = 0; i <= 4; i++) {
    const mw = maximum * i / 4;
    add("line", {x1:70,x2:770,y1:y(mw),y2:y(mw),stroke:"#d9dfd6"});
    add("text", {x:60,y:y(mw)+4,"text-anchor":"end",fill:"#5b6b63","font-size":12}, new Intl.NumberFormat(locale).format(mw));
  }
  add("text", {x:70,y:16,fill:"#5b6b63","font-size":12}, "MW");
  periods.forEach((p,i) => add("text", {x:x(i),y:355,"text-anchor":"middle",fill:"#5b6b63","font-size":13}, p.date.slice(0,4)));
  const hint = document.createElement("p");
  hint.className = "section-note capacity-chart-readout";
  const instruction = english ? "Select a technology to show or hide it. Hover, tap or focus a point for its value." : "Selecciona una tecnología para mostrarla u ocultarla. Pasa el cursor, toca o enfoca un punto para ver su valor.";
  hint.textContent = instruction;
  hint.setAttribute("aria-live", "polite");
  names.forEach((name,index) => {
    const label = english ? name : (spanishTechnologyNames[name] || name);
    const marks = [];
    const key = document.createElement("button");
    key.type = "button";
    key.className = "installed-capacity-legend-technology";
    key.textContent = label;
    key.setAttribute("aria-pressed", "true");
    key.addEventListener("click", () => {
      const visible = key.getAttribute("aria-pressed") !== "true";
      key.setAttribute("aria-pressed", String(visible));
      marks.forEach(mark => { mark.style.display = visible ? "" : "none"; });
      hint.textContent = instruction;
    });
    key.style.setProperty("--series-color", colors[index]); legend.append(key);
    let path = "";
    periods.forEach((p,i) => {
      const point = p.technologies.find(t => t.name === name);
      if (!point) { path += " "; return; }
      path += `${i && periods[i-1].technologies.some(t => t.name === name) ? "L" : "M"}${x(i)},${y(point.mw)} `;
      const dot = add("circle", {cx:x(i),cy:y(point.mw),r:4,fill:colors[index]});
      const valueLabel = `${label}, ${formatMonth(p.date)}: ${formatMw(point.mw)}`;
      dot.setAttribute("tabindex", "0");
      dot.setAttribute("aria-label", valueLabel);
      dot.classList.add("capacity-chart-point");
      const inspect = () => { hint.textContent = valueLabel; };
      dot.addEventListener("pointerenter", inspect);
      dot.addEventListener("click", inspect);
      dot.addEventListener("focus", inspect);
      marks.push(dot);
      const title = document.createElementNS(ns,"title"); title.textContent = valueLabel; dot.append(title);
    });
    const line = add("path", {d:path,fill:"none",stroke:colors[index],"stroke-width":2.5,"pointer-events":"none"});
    marks.push(line);
    svg.insertBefore(line, marks[0]);
  });
  list.append(svg, hint);
}
