const API_BASE = "https://apidatos.ree.es/en/datos";
const DEFAULT_BACKEND_API_BASE =
  window.location.hostname === "powerwindow.energy" ||
  window.location.hostname === "www.powerwindow.energy"
    ? "https://api.powerwindow.energy/api"
    : "/api";
const BACKEND_API_BASE =
  window.POWER_WINDOW_API_BASE || localStorage.getItem("POWER_WINDOW_API_BASE") || DEFAULT_BACKEND_API_BASE;
const MARKET_WIDGET = "mercados/precios-mercados-tiempo-real";
const MARKET_CACHE_PREFIX = "power-window:market:";
const PROFILE_STORAGE_KEY = "power-window:profiles";
const SETTINGS_STORAGE_KEY = "power-window:bill-settings";
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const DEMO_NOTICE =
  "Demo prices are shown because the REE API did not return usable hourly data for this date.";

const state = {
  points: [],
  source: "loading",
  cacheStatus: "none",
  apiMeta: null,
  selectedDate: "",
  profiles: [],
  ranked: [],
  allRanked: [],
  best: null,
  tomorrow: { status: "idle", points: [], best: null },
  deferredInstallPrompt: null,
  reminderTimer: null,
};

const els = {
  profileInput: document.querySelector("#profileInput"),
  dateInput: document.querySelector("#dateInput"),
  durationInput: document.querySelector("#durationInput"),
  applianceInput: document.querySelector("#applianceInput"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  costModeInput: document.querySelector("#costModeInput"),
  vatInput: document.querySelector("#vatInput"),
  electricityTaxInput: document.querySelector("#electricityTaxInput"),
  adderInput: document.querySelector("#adderInput"),
  refreshButton: document.querySelector("#refreshButton"),
  recommendationTitle: document.querySelector("#recommendationTitle"),
  dataStatus: document.querySelector("#dataStatus"),
  dataNote: document.querySelector("#dataNote"),
  lastUpdated: document.querySelector("#lastUpdated"),
  scoreValue: document.querySelector("#scoreValue"),
  scoreMeter: document.querySelector("#scoreMeter"),
  gradeValue: document.querySelector("#gradeValue"),
  gradeHint: document.querySelector("#gradeHint"),
  loadLabel: document.querySelector("#loadLabel"),
  loadHint: document.querySelector("#loadHint"),
  bestWindow: document.querySelector("#bestWindow"),
  bestReason: document.querySelector("#bestReason"),
  costEstimate: document.querySelector("#costEstimate"),
  costHint: document.querySelector("#costHint"),
  nowVsBest: document.querySelector("#nowVsBest"),
  savingsHint: document.querySelector("#savingsHint"),
  tomorrowBest: document.querySelector("#tomorrowBest"),
  tomorrowHint: document.querySelector("#tomorrowHint"),
  reminderButton: document.querySelector("#reminderButton"),
  reminderStatus: document.querySelector("#reminderStatus"),
  installButton: document.querySelector("#installButton"),
  installHint: document.querySelector("#installHint"),
  hourChart: document.querySelector("#hourChart"),
  windowList: document.querySelector("#windowList"),
};

function init() {
  loadProfiles();
  loadBillSettings();

  const today = new Date();
  const tomorrow = addDays(today, 1);
  els.dateInput.max = formatDateInput(tomorrow);
  els.dateInput.value = formatDateInput(today);
  state.selectedDate = els.dateInput.value;

  els.refreshButton.addEventListener("click", () => loadDate(els.dateInput.value, { forceRefresh: true }));
  els.saveProfileButton.addEventListener("click", saveCurrentProfile);
  els.profileInput.addEventListener("change", applySelectedProfile);
  els.dateInput.addEventListener("change", () => loadDate(els.dateInput.value));
  els.durationInput.addEventListener("input", render);
  els.durationInput.addEventListener("change", render);
  els.applianceInput.addEventListener("change", render);
  els.costModeInput.addEventListener("change", handleBillSettingsChange);
  els.vatInput.addEventListener("input", handleBillSettingsChange);
  els.electricityTaxInput.addEventListener("input", handleBillSettingsChange);
  els.adderInput.addEventListener("input", handleBillSettingsChange);
  els.reminderButton.addEventListener("click", scheduleReminder);
  els.installButton.addEventListener("click", installApp);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installButton.disabled = false;
    els.installHint.textContent = "Ready to install on Android Chrome.";
  });

  loadDate(state.selectedDate);
}

async function loadDate(dateValue, options = {}) {
  const safeDate = clampDateValue(dateValue);
  if (safeDate !== dateValue) {
    els.dateInput.value = safeDate;
  }

  state.selectedDate = safeDate;
  state.tomorrow = {
    status: isSameDay(parseDateInput(safeDate), startOfDay(new Date())) ? "loading" : "idle",
    points: [],
    best: null,
  };
  setLoading(true);

  try {
    const response = await getMarketData(safeDate, options);
    const data = response.payload;
    const points = parseMarketData(data);

    if (!points.length) {
      throw new Error("No hourly price series found.");
    }

    state.points = points;
    state.source = "api";
    state.cacheStatus = response.cacheStatus;
    state.apiMeta = data.data?.attributes || null;
  } catch (error) {
    state.points = makeDemoData(safeDate);
    state.source = "demo";
    state.cacheStatus = "none";
    state.apiMeta = { "last-update": null, title: "Demo hourly price signal" };
    console.warn(error);
  } finally {
    setLoading(false);
    render();
    loadTomorrowComparison(safeDate);
  }
}

async function getMarketData(dateValue, options = {}) {
  if (!options.forceRefresh) {
    const cached = readCachedMarketData(dateValue);
    if (cached) {
      return { payload: cached, cacheStatus: "browser" };
    }
  }

  const response = await fetchMarketData(dateValue, options);
  writeCachedMarketData(dateValue, response.payload);
  return response;
}

async function fetchMarketData(dateValue, options = {}) {
  const backendURL = new URL(`${BACKEND_API_BASE.replace(/\/$/, "")}/market`, window.location.origin);
  backendURL.searchParams.set("date", dateValue);
  if (options.forceRefresh) {
    backendURL.searchParams.set("refresh", "1");
  }

  try {
    const backendResponse = await fetch(backendURL, { headers: { Accept: "application/json" } });
    if (backendResponse.ok) {
      const data = await backendResponse.json();
      if (data.payload) {
        return {
          payload: data.payload,
          cacheStatus:
            data.cacheStatus === "hit" || data.cacheStatus === "stale" ? "backend" : "network",
        };
      }
    }
  } catch {
    // During local development or a backend outage, fall through to direct REE.
  }

  const start = `${dateValue}T00:00`;
  const end = `${dateValue}T23:59`;
  const url = `${API_BASE}/${MARKET_WIDGET}?start_date=${start}&end_date=${end}&time_trunc=hour`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`REE request failed with ${response.status}`);
  }

  const data = await response.json();
  if (data.errors?.length) {
    throw new Error(data.errors[0].detail || "REE returned an error.");
  }
  return { payload: data, cacheStatus: "network" };
}

function readCachedMarketData(dateValue) {
  try {
    const raw = localStorage.getItem(cacheKeyForDate(dateValue));
    if (!raw) return null;

    const cached = JSON.parse(raw);
    const age = Date.now() - Number(cached.cachedAt);
    if (!cached.payload || age > cacheTtlForDate(dateValue)) {
      localStorage.removeItem(cacheKeyForDate(dateValue));
      return null;
    }

    return cached.payload;
  } catch {
    localStorage.removeItem(cacheKeyForDate(dateValue));
    return null;
  }
}

function writeCachedMarketData(dateValue, payload) {
  try {
    localStorage.setItem(
      cacheKeyForDate(dateValue),
      JSON.stringify({
        cachedAt: Date.now(),
        payload,
      })
    );
  } catch {
    // Storage is best-effort. The app can still use live API data.
  }
}

function cacheKeyForDate(dateValue) {
  return `${MARKET_CACHE_PREFIX}${dateValue}`;
}

function cacheTtlForDate(dateValue) {
  const selected = parseDateInput(dateValue);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  if (isSameDay(selected, tomorrow)) return 15 * MINUTE;
  if (isSameDay(selected, today)) return 30 * MINUTE;
  if (selected < today) return 30 * DAY;
  return 5 * MINUTE;
}

function cacheStatusLabel() {
  if (state.source !== "api") return "Demo mode";
  if (state.cacheStatus === "browser") return "Browser cache";
  if (state.cacheStatus === "backend") return "Backend cache";
  return "Live REE data";
}

function firstAvailableStartHour(dateValue) {
  const selected = parseDateInput(dateValue);
  const now = new Date();
  const today = startOfDay(now);

  if (selected < today) return 24;
  if (!isSameDay(selected, today)) return 0;

  const hasCurrentHourStarted =
    now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0;
  return clamp(now.getHours() + (hasCurrentHourStarted ? 1 : 0), 0, 24);
}

function parseMarketData(data) {
  const included = Array.isArray(data.included) ? data.included : [];
  const pvpc = findSeries(included, ["PVPC"]);
  const spot = findSeries(included, ["Spot market price", "spot"]);
  const series = hasValues(pvpc) ? pvpc : spot;

  if (!series?.attributes?.values?.length) return [];

  const values = series.attributes.values;
  const hourly = new Map();

  values.forEach((item) => {
    const hour = Number(item.datetime.match(/T(\d{2}):/)?.[1]);
    if (!Number.isFinite(hour)) return;
    const current = hourly.get(hour) || { total: 0, count: 0, datetime: item.datetime };
    current.total += Number(item.value);
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
      label: series.attributes.title || series.type || "Market price",
      seriesType: series === pvpc ? "pvpc" : "spot",
    };
  }).filter(Boolean);
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

function render() {
  if (!state.points.length) return;

  const duration = clamp(Math.round(Number(els.durationInput.value) || 1), 1, 8);
  const kw = Number(els.applianceInput.value) || 1;
  els.durationInput.value = String(duration);

  const allRanked = rankWindows(state.points, duration, kw);
  const firstStart = firstAvailableStartHour(state.selectedDate);
  const ranked = allRanked.filter((item) => item.start >= firstStart);
  const best = ranked[0];
  const worst = allRanked[allRanked.length - 1];
  const bestHours = new Set(best?.hours || []);
  const prices = state.points.map((point) => point.price);
  const lowCut = quantile(prices, 0.25);
  const highCut = quantile(prices, 0.75);
  state.allRanked = allRanked;
  state.ranked = ranked;
  state.best = best;
  const load = loadLabelForKwh(kw * duration);
  renderLoadLabel(load);

  if (!best) {
    renderNoRemainingWindow(duration, kw, firstStart, bestHours, lowCut, highCut);
    renderTomorrowComparison(duration);
    return;
  }

  const grade = gradeForScore(best.score);

  els.recommendationTitle.textContent = formatWindow(best.start, duration);
  els.scoreValue.textContent = String(Math.round(best.score));
  els.scoreMeter.style.width = `${Math.round(best.score)}%`;
  els.gradeValue.textContent = grade.letter;
  els.gradeValue.className = `grade-badge grade-${grade.letter.toLowerCase()}`;
  els.gradeHint.textContent = grade.hint;
  els.bestWindow.textContent = formatStartTime(best.start);
  els.bestReason.textContent = makeReason(best, worst, duration, kw);
  els.costEstimate.textContent = formatMoney(best.cost);
  els.costHint.textContent = costHintText(kw, duration);
  els.reminderButton.disabled = false;
  renderDataStatus();

  renderChart(state.points, bestHours, lowCut, highCut, firstStart);
  renderWindowList(ranked.slice(0, 6), duration);
  renderNowComparison(best, duration);
  renderTomorrowComparison(duration);
}

function renderNoRemainingWindow(duration, kw, firstStart, bestHours, lowCut, highCut) {
  els.recommendationTitle.textContent = "No remaining window";
  els.scoreValue.textContent = "--";
  els.scoreMeter.style.width = "0%";
  els.gradeValue.textContent = "--";
  els.gradeValue.className = "grade-badge";
  els.gradeHint.textContent = "Selected run no longer fits today";
  els.bestWindow.textContent = "Try tomorrow";
  els.bestReason.textContent = `A ${duration}h run for ${loadName()} at ${kw.toFixed(1)} kW no longer fits in today's remaining hourly data. Select tomorrow or reduce the duration.`;
  els.costEstimate.textContent = "--";
  els.costHint.textContent = costHintText(kw, duration);
  els.reminderButton.disabled = true;
  els.reminderStatus.textContent = "No remaining start today";
  renderDataStatus();
  renderChart(state.points, bestHours, lowCut, highCut, firstStart);
  renderWindowList([], duration);
  renderNowComparison(null, duration);
}

function renderDataStatus() {
  if (state.source === "api") {
    els.dataStatus.textContent = cacheStatusLabel();
    els.dataStatus.className = "";
  } else {
    els.dataStatus.textContent = "Demo mode";
    els.dataStatus.className = "demo";
  }
  els.dataNote.textContent = dataNoteForSelection();
  els.dataNote.className = state.source === "demo" ? "demo" : "";

  const update = state.apiMeta?.["last-update"];
  els.lastUpdated.textContent = update
    ? `Last REE update: ${formatDateTime(update)}`
    : DEMO_NOTICE;
}

function renderChart(points, bestHours, lowCut, highCut, firstStart = 0) {
  const max = Math.max(...points.map((point) => point.price));
  const min = Math.min(...points.map((point) => point.price));
  const range = Math.max(max - min, 1);

  els.hourChart.innerHTML = points
    .map((point) => {
      const height = 18 + ((point.price - min) / range) * 182;
      const classes = ["hour-bar"];
      if (bestHours.has(point.hour)) classes.push("best");
      else if (point.price <= lowCut) classes.push("low");
      else if (point.price >= highCut) classes.push("high");
      if (point.hour < firstStart) classes.push("past");

      return `
        <div class="${classes.join(" ")}" title="${formatHour(point.hour)} - ${formatPrice(point.price)}">
          <div class="bar-fill" style="height:${height}px"></div>
          <div class="bar-price">${formatPrice(point.price, true)}</div>
          <div class="bar-hour">${formatHourShort(point.hour)}</div>
        </div>
      `;
    })
    .join("");
}

function renderWindowList(windows, duration) {
  if (!windows.length) {
    els.windowList.innerHTML = `
      <article class="window-item empty">
        <span class="eyebrow">Remaining starts</span>
        <strong>No slot left today</strong>
        <small>Pick tomorrow or shorten the duration to get a usable start time.</small>
      </article>
    `;
    return;
  }

  const bestScore = windows[0]?.score || 1;
  els.windowList.innerHTML = windows
    .map((item, index) => {
      const width = Math.max(12, (item.score / bestScore) * 100);
      return `
        <article class="window-item">
          <span class="eyebrow">#${index + 1}</span>
          <strong>${formatWindow(item.start, duration)}</strong>
          <div class="window-meter" aria-hidden="true"><span style="width:${width}%"></span></div>
          <small>${formatPrice(item.avgPrice)} average, ${formatMoney(item.cost)} estimated for this load.</small>
        </article>
      `;
    })
    .join("");
}

function rankWindows(points, duration, kw) {
  const maxStart = Math.max(0, points.length - duration);
  const prices = points.map((point) => point.price);
  const dailyMin = Math.min(...prices);
  const dailyMax = Math.max(...prices);
  const dailyRange = Math.max(dailyMax - dailyMin, 1);

  return Array.from({ length: maxStart + 1 }, (_, start) => {
    const slice = points.slice(start, start + duration);
    const avgPrice = average(slice.map((point) => point.price));
    const marketCost = slice.reduce((sum, point) => sum + (point.price / 1000) * kw, 0);
    const kwh = kw * slice.length;
    const lowPriceScore = 100 - ((avgPrice - dailyMin) / dailyRange) * 100;
    const middayBonus = slice.some((point) => point.hour >= 10 && point.hour <= 17) ? 4 : 0;

    return {
      start,
      hours: slice.map((point) => point.hour),
      avgPrice,
      marketCost,
      cost: estimateBillCost(marketCost, kwh),
      score: clamp(lowPriceScore + middayBonus, 0, 100),
    };
  }).sort((a, b) => {
    if (a.avgPrice !== b.avgPrice) return a.avgPrice - b.avgPrice;
    return a.start - b.start;
  });
}

function makeReason(best, worst, duration, kw) {
  const saved = Math.max(0, worst.cost - best.cost);
  const percent = worst.cost > 0 ? (saved / worst.cost) * 100 : 0;
  const sourceText =
    state.source === "api"
      ? "Based on the REE market price series for the selected date."
      : DEMO_NOTICE;
  return `${sourceText} For ${loadName()} at ${kw.toFixed(1)} kW, this ${duration}h window is about ${percent.toFixed(0)}% cheaper than the most expensive comparable window.`;
}

function renderNowComparison(best, duration) {
  const selected = parseDateInput(state.selectedDate);
  const today = startOfDay(new Date());

  if (!isSameDay(selected, today)) {
    els.nowVsBest.textContent = "Today only";
    els.savingsHint.textContent = "Run-now comparison appears when the selected date is today.";
    return;
  }

  const currentHour = new Date().getHours();
  const nowWindow = state.allRanked.find((item) => item.start === currentHour);
  if (!nowWindow) {
    els.nowVsBest.textContent = "Too late today";
    els.savingsHint.textContent = `A ${duration}h run no longer fits in today's remaining hourly data.`;
    return;
  }

  if (!best) {
    els.nowVsBest.textContent = "Too late today";
    els.savingsHint.textContent = `A ${duration}h run no longer fits in today's remaining hourly data.`;
    return;
  }

  const savings = nowWindow.cost - best.cost;
  if (Math.abs(savings) < 0.005 || best.start === currentHour) {
    els.nowVsBest.textContent = "Run now";
    els.savingsHint.textContent = `${formatWindow(currentHour, duration)} is already one of the best options.`;
    return;
  }

  if (savings > 0) {
    els.nowVsBest.textContent = `Save ${formatMoney(savings)}`;
    els.savingsHint.textContent = `Run now: ${formatMoney(nowWindow.cost)}. Best window: ${formatMoney(best.cost)}.`;
    return;
  }

  els.nowVsBest.textContent = "Now is cheaper";
  els.savingsHint.textContent = `Run now: ${formatMoney(nowWindow.cost)}. Best listed window: ${formatMoney(best.cost)}.`;
}

function renderTomorrowComparison(duration) {
  if (state.tomorrow.status === "idle") {
    els.tomorrowBest.textContent = "Today view";
    els.tomorrowHint.textContent = "Select today to compare against tomorrow's day-ahead data.";
    return;
  }

  if (state.tomorrow.status === "loading") {
    els.tomorrowBest.textContent = "Checking";
    els.tomorrowHint.textContent = "Tomorrow data is loading in the background.";
    return;
  }

  if (state.tomorrow.status === "unavailable" || !state.tomorrow.points.length) {
    els.tomorrowBest.textContent = "Not available";
    els.tomorrowHint.textContent = "REE may publish tomorrow's PVPC/spot data later.";
    return;
  }

  const kw = Number(els.applianceInput.value) || 1;
  const best = rankWindows(state.tomorrow.points, duration, kw)[0];
  state.tomorrow.best = best;
  els.tomorrowBest.textContent = formatWindow(best.start, duration);
  els.tomorrowHint.textContent = `${formatMoney(best.cost)} estimated if you wait until tomorrow.`;
}

async function loadTomorrowComparison(dateValue) {
  const selected = parseDateInput(dateValue);
  const today = startOfDay(new Date());
  if (!isSameDay(selected, today)) {
    state.tomorrow = { status: "idle", points: [], best: null };
    renderTomorrowComparison(Number(els.durationInput.value) || 1);
    return;
  }

  const tomorrowValue = formatDateInput(addDays(today, 1));
  try {
    const response = await getMarketData(tomorrowValue);
    const points = parseMarketData(response.payload);
    if (!points.length) throw new Error("No tomorrow data");

    state.tomorrow = { status: "ready", points, best: null };
  } catch {
    state.tomorrow = { status: "unavailable", points: [], best: null };
  }

  renderTomorrowComparison(Number(els.durationInput.value) || 1);
}

function dataNoteForSelection() {
  if (state.source === "demo") {
    return "Using demo data for unavailable REE dates";
  }

  const selected = parseDateInput(state.selectedDate);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const seriesType = state.points[0]?.seriesType;

  if (isSameDay(selected, tomorrow)) {
    return seriesType === "spot"
      ? "Tomorrow: day-ahead spot data; PVPC may appear later"
      : "Tomorrow: day-ahead data available";
  }

  if (isSameDay(selected, today)) {
    return seriesType === "spot" ? "Today: spot market data" : "Today: PVPC market data";
  }

  return seriesType === "spot" ? "Historical spot market data" : "Historical PVPC market data";
}

function gradeForScore(score) {
  if (score >= 90) return { letter: "A", hint: "Excellent timing" };
  if (score >= 78) return { letter: "B", hint: "Very good timing" };
  if (score >= 64) return { letter: "C", hint: "Decent timing" };
  if (score >= 50) return { letter: "D", hint: "Below-average timing" };
  if (score >= 35) return { letter: "E", hint: "Expensive timing" };
  return { letter: "F", hint: "Avoid if flexible" };
}

function loadLabelForKwh(kwh) {
  if (kwh <= 1) return { letter: "A", hint: "Very low consumption" };
  if (kwh <= 2) return { letter: "B", hint: "Low consumption" };
  if (kwh <= 3.5) return { letter: "C", hint: "Moderate consumption" };
  if (kwh <= 5) return { letter: "D", hint: "Medium-high consumption" };
  if (kwh <= 7.5) return { letter: "E", hint: "High consumption" };
  if (kwh <= 11) return { letter: "F", hint: "Very high consumption" };
  return { letter: "G", hint: "Highest consumption" };
}

function renderLoadLabel(load) {
  const kwh = (Number(els.applianceInput.value) || 1) * (Number(els.durationInput.value) || 1);
  els.loadLabel.dataset.active = load.letter;
  els.loadHint.textContent = `${load.hint}: ${kwh.toFixed(1)} kWh estimated`;
  Array.from(els.loadLabel.children).forEach((item) => {
    item.classList.toggle("active", item.textContent === load.letter);
  });
}

function makeDemoData(dateValue) {
  const seed = Array.from(dateValue).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 24 }, (_, hour) => {
    const morning = hour >= 7 && hour <= 9 ? 42 : 0;
    const evening = hour >= 20 && hour <= 23 ? 75 : 0;
    const solarDip = hour >= 10 && hour <= 17 ? -48 : 0;
    const nightDip = hour >= 1 && hour <= 5 ? -18 : 0;
    const wave = Math.sin((hour + seed) * 0.8) * 10;
    const price = Math.max(0, 92 + morning + evening + solarDip + nightDip + wave);

    return {
      hour,
      datetime: `${dateValue}T${pad(hour)}:00:00.000+02:00`,
      price,
      label: "Demo price",
    };
  });
}

function setLoading(isLoading) {
  els.refreshButton.disabled = isLoading;
  els.refreshButton.textContent = isLoading ? "Loading" : "Refresh";
  if (isLoading) {
    els.recommendationTitle.textContent = "Loading REE data...";
    els.dataStatus.textContent = "Connecting";
    els.dataNote.textContent = "Dates are available through tomorrow";
    els.dataStatus.className = "";
  }
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatWindow(start, duration) {
  return `${formatHour(start)}-${formatHour(start + duration)}`;
}

function formatStartTime(start) {
  return `Start at ${formatHour(start)}`;
}

function loadName() {
  return els.applianceInput.selectedOptions[0]?.textContent.split(" - ")[0] || "this load";
}

function estimateBillCost(marketCost, kwh) {
  const settings = billSettings();
  if (settings.mode === "market") return marketCost;

  const beforeTaxes = marketCost + kwh * settings.adder;
  const withElectricityTax = beforeTaxes * (1 + settings.electricityTax / 100);
  return withElectricityTax * (1 + settings.vat / 100);
}

function billSettings() {
  return {
    mode: els.costModeInput.value,
    vat: clamp(Number(els.vatInput.value) || 0, 0, 30),
    electricityTax: clamp(Number(els.electricityTaxInput.value) || 0, 0, 10),
    adder: clamp(Number(els.adderInput.value) || 0, 0, 0.5),
  };
}

function costHintText(kw, duration) {
  const settings = billSettings();
  if (settings.mode === "market") {
    return `${kw.toFixed(1)} kW for ${duration}h, market component only`;
  }

  return `${kw.toFixed(1)} kW for ${duration}h incl. ${settings.vat}% VAT, ${settings.electricityTax}% electricity tax, and ${formatEurKwh(settings.adder)} adders`;
}

function handleBillSettingsChange() {
  saveBillSettings();
  render();
}

function loadBillSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    if (settings.mode) els.costModeInput.value = settings.mode;
    if (Number.isFinite(settings.vat)) els.vatInput.value = String(settings.vat);
    if (Number.isFinite(settings.electricityTax)) {
      els.electricityTaxInput.value = String(settings.electricityTax);
    }
    if (Number.isFinite(settings.adder)) els.adderInput.value = String(settings.adder);
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  }
}

function saveBillSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(billSettings()));
  } catch {
    // Settings are optional; rendering can continue with defaults.
  }
}

function loadProfiles() {
  try {
    state.profiles = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "[]").filter(
      (profile) => profile?.name && Number.isFinite(profile.kw) && Number.isFinite(profile.duration)
    );
  } catch {
    state.profiles = [];
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
  renderProfileOptions();
}

function renderProfileOptions() {
  const custom = '<option value="">Custom load</option>';
  const saved = state.profiles
    .map(
      (profile, index) =>
        `<option value="${index}">${escapeHTML(profile.name)} - ${profile.kw.toFixed(1)} kW, ${profile.duration}h</option>`
    )
    .join("");
  els.profileInput.innerHTML = custom + saved;
}

function saveCurrentProfile() {
  const fallbackName = loadName() === "this load" ? "My load" : loadName();
  const name = window.prompt("Profile name", fallbackName);
  if (!name?.trim()) return;

  const profile = {
    name: name.trim().slice(0, 40),
    kw: Number(els.applianceInput.value) || 1,
    duration: clamp(Math.round(Number(els.durationInput.value) || 1), 1, 8),
  };

  state.profiles = [...state.profiles.filter((item) => item.name !== profile.name), profile].slice(-8);
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profiles));
  } catch {
    // Profiles are a convenience feature; failure should not break the planner.
  }

  renderProfileOptions();
  els.profileInput.value = String(state.profiles.findIndex((item) => item.name === profile.name));
}

function applySelectedProfile() {
  const profile = state.profiles[Number(els.profileInput.value)];
  if (!profile) return;

  els.durationInput.value = String(profile.duration);
  setApplianceByKw(profile.kw);
  render();
}

function setApplianceByKw(kw) {
  const existing = Array.from(els.applianceInput.options).find(
    (option) => Number(option.value) === kw
  );
  if (existing) {
    els.applianceInput.value = existing.value;
  }
}

async function scheduleReminder() {
  if (!state.best) return;

  const bestStart = state.best.start;
  const duration = Number(els.durationInput.value) || 1;
  const name = loadName();
  const selected = parseDateInput(state.selectedDate);
  const reminderAt = new Date(selected);
  reminderAt.setHours(bestStart, 0, 0, 0);
  reminderAt.setMinutes(reminderAt.getMinutes() - 10);
  const delay = reminderAt.getTime() - Date.now();

  if (delay <= 0) {
    els.reminderStatus.textContent = "Window is soon";
    return;
  }

  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  clearTimeout(state.reminderTimer);
  state.reminderTimer = window.setTimeout(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Power Window", {
        body: `${name} starts in 10 minutes: ${formatWindow(bestStart, duration)}`,
      });
    } else {
      window.alert(`Power Window: ${name} starts in 10 minutes.`);
    }
  }, delay);

  els.reminderStatus.textContent = `Set for ${formatDateTime(reminderAt.toISOString())}`;
}

async function installApp() {
  if (!state.deferredInstallPrompt) {
    els.installHint.textContent = "Open in Android Chrome, then use Add to Home screen.";
    return;
  }

  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  els.installButton.disabled = true;
  els.installHint.textContent = "Install prompt handled by the browser.";
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function formatHour(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 || 12;
  return `${display} ${suffix}`;
}

function formatHourShort(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "p" : "a";
  const display = normalized % 12 || 12;
  return `${display}${suffix}`;
}

function formatPrice(value, compact = false) {
  const suffix = compact ? "" : " EUR/MWh";
  return `${Math.round(value)}${suffix}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatEurKwh(value) {
  return `${value.toFixed(3)} EUR/kWh`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(first, second) {
  return formatDateInput(first) === formatDateInput(second);
}

function clampDateValue(value) {
  if (!value) {
    return formatDateInput(new Date());
  }

  const selected = parseDateInput(value);
  const tomorrow = addDays(startOfDay(new Date()), 1);

  if (Number.isNaN(selected.getTime())) {
    return formatDateInput(new Date());
  }

  if (selected > tomorrow) {
    return formatDateInput(tomorrow);
  }

  return value;
}

init();
