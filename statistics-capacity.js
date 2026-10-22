import { summarizeInstalledCapacity } from "./shared/installed-capacity.mjs";

const english = document.documentElement.lang === "en";
const locale = english ? "en-GB" : "es-ES";
const copy = english ? {
  loading: "Loading installed capacity…", unavailable: "Installed capacity is unavailable. Try Update again.",
  other: "Other technologies",
  cached: "Cached REE data", network: "REE data", stale: "Cached REE data; refresh unavailable",
  observed: "Latest observation"
} : {
  loading: "Cargando potencia instalada…", unavailable: "La potencia instalada no está disponible. Pulsa Actualizar para reintentar.",
  other: "Otras tecnologías",
  cached: "Datos REE en caché", network: "Datos REE", stale: "Datos REE en caché; actualización no disponible",
  observed: "Último dato"
};
const status = document.querySelector("#installedCapacityStatus");
const total = document.querySelector("#installedCapacityTotal");
const date = document.querySelector("#installedCapacityDate");
const list = document.querySelector("#installedCapacityList");
const formatMw = (mw) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(mw)} MW`;
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
    const top = snapshot.technologies.slice(0, 8);
    const remaining = snapshot.technologies.slice(8).reduce((sum, item) => sum + item.mw, 0);
    const rows = remaining > 0 ? [...top, { name: copy.other, mw: remaining }] : top;
    list.replaceChildren(...rows.map((item) => {
      const row = document.createElement("div");
      row.className = "installed-capacity-row";
      const label = document.createElement("span");
      label.textContent = item.name;
      const bar = document.createElement("span");
      bar.className = "installed-capacity-bar";
      bar.style.width = `${Math.min(100, item.mw / snapshot.totalMw * 100)}%`;
      const value = document.createElement("strong");
      value.textContent = formatMw(item.mw);
      row.append(label, bar, value);
      return row;
    }));
    status.textContent = data.cacheStatus === "stale" ? copy.stale :
      data.cacheStatus === "hit" ? copy.cached : copy.network;
  } catch {
    status.textContent = copy.unavailable;
    total.textContent = "--";
    date.textContent = "";
    list.replaceChildren();
  } finally {
    list.setAttribute("aria-busy", "false");
    loading = false;
  }
}
