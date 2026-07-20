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
const VEHICLE_STORAGE_KEY = "power-window:vehicle";
const CONNECTOR_USER_STORAGE_KEY = "power-window:connector-user";
const MAX_DURATION = 12;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const DEMO_NOTICE =
  "Se muestran precios de prueba porque la API de REE no devolvió datos horarios útiles para esta fecha.";
const VEHICLE_PRESETS = {
  Personalizado: [{ model: "Mi coche eléctrico", batteryKwh: 60 }],
  Audi: [
    { model: "Q4 e-tron 45", batteryKwh: 77 },
    { model: "Q6 e-tron", batteryKwh: 94.9 },
    { model: "Q8 e-tron 55", batteryKwh: 106 },
  ],
  BMW: [
    { model: "i3 120 Ah", batteryKwh: 37.9 },
    { model: "i4 eDrive40", batteryKwh: 81.1 },
    { model: "iX1 xDrive30", batteryKwh: 64.7 },
    { model: "iX3", batteryKwh: 73.8 },
  ],
  BYD: [
    { model: "Dolphin", batteryKwh: 60.4 },
    { model: "Atto 3", batteryKwh: 60.5 },
    { model: "Seal", batteryKwh: 82.5 },
    { model: "Seal U", batteryKwh: 71.8 },
  ],
  Citroen: [
    { model: "e-C3", batteryKwh: 44 },
    { model: "e-C4", batteryKwh: 50 },
    { model: "e-Berlingo", batteryKwh: 50 },
  ],
  Cupra: [
    { model: "Born 58", batteryKwh: 58 },
    { model: "Born 77", batteryKwh: 77 },
    { model: "Tavascan", batteryKwh: 77 },
  ],
  Dacia: [{ model: "Spring", batteryKwh: 26.8 }],
  Fiat: [
    { model: "500e", batteryKwh: 37.3 },
    { model: "600e", batteryKwh: 51 },
  ],
  Ford: [
    { model: "Explorer EV", batteryKwh: 77 },
    { model: "Mustang Mach-E Standard", batteryKwh: 72 },
    { model: "Mustang Mach-E Extended", batteryKwh: 91 },
  ],
  Hyundai: [
    { model: "Kona Electric 48", batteryKwh: 48.4 },
    { model: "Kona Electric 65", batteryKwh: 65.4 },
    { model: "Ioniq 5 Standard", batteryKwh: 58 },
    { model: "Ioniq 5 Long Range", batteryKwh: 77.4 },
    { model: "Ioniq 6 Long Range", batteryKwh: 77.4 },
  ],
  Jeep: [{ model: "Avenger Electric", batteryKwh: 51 }],
  Kia: [
    { model: "Niro EV", batteryKwh: 64.8 },
    { model: "EV3 Standard", batteryKwh: 58.3 },
    { model: "EV3 Long Range", batteryKwh: 81.4 },
    { model: "EV4 Standard", batteryKwh: 58.3 },
    { model: "EV4 Long Range", batteryKwh: 81.4 },
    { model: "EV6 Long Range", batteryKwh: 77.4 },
    { model: "EV9", batteryKwh: 99.8 },
  ],
  Mazda: [{ model: "MX-30", batteryKwh: 30 }],
  Mercedes: [
    { model: "EQA 250+", batteryKwh: 70.5 },
    { model: "EQB 250+", batteryKwh: 70.5 },
    { model: "EQE 350+", batteryKwh: 90.6 },
  ],
  MG: [
    { model: "MG4 Standard", batteryKwh: 50.8 },
    { model: "MG4 Long Range", batteryKwh: 61.7 },
    { model: "MG4 Extended Range", batteryKwh: 74.4 },
    { model: "ZS EV Standard", batteryKwh: 49 },
    { model: "ZS EV Long Range", batteryKwh: 68.3 },
  ],
  Mini: [
    { model: "Cooper E", batteryKwh: 36.6 },
    { model: "Cooper SE", batteryKwh: 49.2 },
  ],
  Nissan: [
    { model: "Leaf 40", batteryKwh: 39 },
    { model: "Leaf e+", batteryKwh: 59 },
    { model: "Ariya 63", batteryKwh: 63 },
    { model: "Ariya 87", batteryKwh: 87 },
  ],
  Opel: [
    { model: "Corsa Electric", batteryKwh: 51 },
    { model: "Mokka Electric", batteryKwh: 51 },
    { model: "Astra Electric", batteryKwh: 54 },
  ],
  Peugeot: [
    { model: "e-208", batteryKwh: 51 },
    { model: "e-2008", batteryKwh: 54 },
    { model: "e-308", batteryKwh: 54 },
    { model: "e-Rifter", batteryKwh: 50 },
  ],
  Polestar: [
    { model: "2 Standard Range", batteryKwh: 67 },
    { model: "2 Long Range", batteryKwh: 79 },
  ],
  Tesla: [
    { model: "Model 3 RWD", batteryKwh: 57.5 },
    { model: "Model 3 Long Range", batteryKwh: 75 },
    { model: "Model Y RWD", batteryKwh: 57.5 },
    { model: "Model Y Long Range", batteryKwh: 75 },
  ],
  Renault: [
    { model: "5 E-Tech 40", batteryKwh: 40 },
    { model: "5 E-Tech 52", batteryKwh: 52 },
    { model: "Zoe ZE50", batteryKwh: 52 },
    { model: "Megane E-Tech", batteryKwh: 60 },
    { model: "Scenic E-Tech", batteryKwh: 87 },
  ],
  Skoda: [
    { model: "Enyaq 60", batteryKwh: 58 },
    { model: "Enyaq 85", batteryKwh: 77 },
  ],
  Volkswagen: [
    { model: "ID.3 Pro", batteryKwh: 58 },
    { model: "ID.3 Pro S", batteryKwh: 77 },
    { model: "ID.4 Pro", batteryKwh: 77 },
    { model: "ID.5 Pro", batteryKwh: 77 },
    { model: "ID.7 Pro", batteryKwh: 77 },
  ],
  Volvo: [
    { model: "EX30 Single Motor", batteryKwh: 49 },
    { model: "EX30 Extended Range", batteryKwh: 64 },
    { model: "EX40", batteryKwh: 79 },
  ],
};

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
  devices: [],
  tomorrow: { status: "idle", points: [], best: null },
  deferredInstallPrompt: null,
  reminderTimer: null,
};

const els = {
  profileInput: document.querySelector("#profileInput"),
  dateInput: document.querySelector("#dateInput"),
  durationInput: document.querySelector("#durationInput"),
  applianceInput: document.querySelector("#applianceInput"),
  vehicleBrandInput: document.querySelector("#vehicleBrandInput"),
  vehicleModelInput: document.querySelector("#vehicleModelInput"),
  vehicleBatteryInput: document.querySelector("#vehicleBatteryInput"),
  chargeFromInput: document.querySelector("#chargeFromInput"),
  chargeToInput: document.querySelector("#chargeToInput"),
  chargerPowerInput: document.querySelector("#chargerPowerInput"),
  useVehicleButton: document.querySelector("#useVehicleButton"),
  vehicleHint: document.querySelector("#vehicleHint"),
  chargerDeviceInput: document.querySelector("#chargerDeviceInput"),
  connectMockButton: document.querySelector("#connectMockButton"),
  sendPlanButton: document.querySelector("#sendPlanButton"),
  startMockButton: document.querySelector("#startMockButton"),
  stopMockButton: document.querySelector("#stopMockButton"),
  connectorStatus: document.querySelector("#connectorStatus"),
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
  initVehiclePlanner();

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
  els.vehicleBrandInput.addEventListener("change", handleVehicleBrandChange);
  els.vehicleModelInput.addEventListener("change", handleVehicleModelChange);
  els.vehicleBatteryInput.addEventListener("input", handleVehicleSettingsChange);
  els.chargeFromInput.addEventListener("input", handleVehicleSettingsChange);
  els.chargeToInput.addEventListener("input", handleVehicleSettingsChange);
  els.chargerPowerInput.addEventListener("change", handleVehicleSettingsChange);
  els.useVehicleButton.addEventListener("click", applyVehiclePlanner);
  els.chargerDeviceInput.addEventListener("change", renderConnectorPanel);
  els.connectMockButton.addEventListener("click", connectMockCharger);
  els.sendPlanButton.addEventListener("click", sendSmartChargePlan);
  els.startMockButton.addEventListener("click", () => sendDeviceCommand("start"));
  els.stopMockButton.addEventListener("click", () => sendDeviceCommand("stop"));
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
    els.installHint.textContent = "Listo para instalar en Chrome para Android.";
  });

  loadConnectorDevices();
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
      throw new Error("No se encontró una serie horaria de precios.");
    }

    state.points = points;
    state.source = "api";
    state.cacheStatus = response.cacheStatus;
    state.apiMeta = data.data?.attributes || null;
  } catch (error) {
    state.points = makeDemoData(safeDate);
    state.source = "demo";
    state.cacheStatus = "none";
    state.apiMeta = { "last-update": null, title: "Señal horaria de precio de prueba" };
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
            data.cacheStatus === "hit" ||
            data.cacheStatus === "stale" ||
            data.cacheStatus === "database"
              ? "backend"
              : "network",
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
    throw new Error(`La solicitud a REE falló con estado ${response.status}`);
  }

  const data = await response.json();
  if (data.errors?.length) {
    throw new Error(data.errors[0].detail || "REE devolvió un error.");
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
  if (state.source !== "api") return "Modo prueba";
  if (state.cacheStatus === "browser") return "Caché del navegador";
  if (state.cacheStatus === "backend") return "Caché del backend";
  return "Datos REE en directo";
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
      label: series.attributes.title || series.type || "Precio de mercado",
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

  const duration = clamp(Math.round(Number(els.durationInput.value) || 1), 1, MAX_DURATION);
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
  renderConnectorPanel();

  renderChart(state.points, bestHours, lowCut, highCut, firstStart);
  renderWindowList(ranked.slice(0, 6), duration);
  renderNowComparison(best, duration);
  renderTomorrowComparison(duration);
}

function renderNoRemainingWindow(duration, kw, firstStart, bestHours, lowCut, highCut) {
  els.recommendationTitle.textContent = "No queda ninguna ventana";
  els.scoreValue.textContent = "--";
  els.scoreMeter.style.width = "0%";
  els.gradeValue.textContent = "--";
  els.gradeValue.className = "grade-badge";
  els.gradeHint.textContent = "El uso seleccionado ya no cabe hoy";
  els.bestWindow.textContent = "Prueba mañana";
  els.bestReason.textContent = `Un uso de ${duration} h para ${loadName()} a ${kw.toFixed(1)} kW ya no cabe en los datos horarios restantes de hoy. Selecciona mañana o reduce la duración.`;
  els.costEstimate.textContent = "--";
  els.costHint.textContent = costHintText(kw, duration);
  els.reminderButton.disabled = true;
  els.reminderStatus.textContent = "No queda inicio hoy";
  renderDataStatus();
  renderConnectorPanel();
  renderChart(state.points, bestHours, lowCut, highCut, firstStart);
  renderWindowList([], duration);
  renderNowComparison(null, duration);
}

function renderDataStatus() {
  if (state.source === "api") {
    els.dataStatus.textContent = cacheStatusLabel();
    els.dataStatus.className = "";
  } else {
    els.dataStatus.textContent = "Modo prueba";
    els.dataStatus.className = "demo";
  }
  els.dataNote.textContent = dataNoteForSelection();
  els.dataNote.className = state.source === "demo" ? "demo" : "";

  const update = state.apiMeta?.["last-update"];
  els.lastUpdated.textContent = update
    ? `Última actualización de REE: ${formatDateTime(update)}`
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
        <span class="eyebrow">Inicios restantes</span>
        <strong>No queda hueco hoy</strong>
        <small>Elige mañana o acorta la duración para obtener una hora de inicio útil.</small>
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
          <small>${formatPrice(item.avgPrice)} de media, ${formatMoney(item.cost)} estimados para este consumo.</small>
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
      ? "Basado en la serie de precios de mercado de REE para la fecha seleccionada."
      : DEMO_NOTICE;
  return `${sourceText} Para ${loadName()} a ${kw.toFixed(1)} kW, esta ventana de ${duration} h es aproximadamente un ${percent.toFixed(0)}% más barata que la ventana comparable más cara.`;
}

function renderNowComparison(best, duration) {
  const selected = parseDateInput(state.selectedDate);
  const today = startOfDay(new Date());

  if (!isSameDay(selected, today)) {
    els.nowVsBest.textContent = "Solo hoy";
    els.savingsHint.textContent = "La comparación con usarlo ahora aparece cuando la fecha seleccionada es hoy.";
    return;
  }

  const currentHour = new Date().getHours();
  const nowWindow = state.allRanked.find((item) => item.start === currentHour);
  if (!nowWindow) {
    els.nowVsBest.textContent = "Demasiado tarde";
    els.savingsHint.textContent = `Un uso de ${duration} h ya no cabe en los datos horarios restantes de hoy.`;
    return;
  }

  if (!best) {
    els.nowVsBest.textContent = "Demasiado tarde";
    els.savingsHint.textContent = `Un uso de ${duration} h ya no cabe en los datos horarios restantes de hoy.`;
    return;
  }

  const savings = nowWindow.cost - best.cost;
  if (Math.abs(savings) < 0.005 || best.start === currentHour) {
    els.nowVsBest.textContent = "Usar ahora";
    els.savingsHint.textContent = `${formatWindow(currentHour, duration)} ya es una de las mejores opciones.`;
    return;
  }

  if (savings > 0) {
    els.nowVsBest.textContent = `Ahorra ${formatMoney(savings)}`;
    els.savingsHint.textContent = `Usarlo ahora: ${formatMoney(nowWindow.cost)}. Mejor ventana: ${formatMoney(best.cost)}.`;
    return;
  }

  els.nowVsBest.textContent = "Ahora es más barato";
  els.savingsHint.textContent = `Usarlo ahora: ${formatMoney(nowWindow.cost)}. Mejor ventana listada: ${formatMoney(best.cost)}.`;
}

function renderTomorrowComparison(duration) {
  if (state.tomorrow.status === "idle") {
    els.tomorrowBest.textContent = "Vista de hoy";
    els.tomorrowHint.textContent = "Selecciona hoy para compararlo con los datos del día siguiente.";
    return;
  }

  if (state.tomorrow.status === "loading") {
    els.tomorrowBest.textContent = "Comprobando";
    els.tomorrowHint.textContent = "Los datos de mañana se están cargando en segundo plano.";
    return;
  }

  if (state.tomorrow.status === "unavailable" || !state.tomorrow.points.length) {
    els.tomorrowBest.textContent = "No disponible";
    els.tomorrowHint.textContent = "REE puede publicar los datos PVPC/spot de mañana más tarde.";
    return;
  }

  const kw = Number(els.applianceInput.value) || 1;
  const best = rankWindows(state.tomorrow.points, duration, kw)[0];
  state.tomorrow.best = best;
  els.tomorrowBest.textContent = formatWindow(best.start, duration);
  els.tomorrowHint.textContent = `${formatMoney(best.cost)} estimados si esperas a mañana.`;
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
    if (!points.length) throw new Error("Sin datos de mañana");

    state.tomorrow = { status: "ready", points, best: null };
  } catch {
    state.tomorrow = { status: "unavailable", points: [], best: null };
  }

  renderTomorrowComparison(Number(els.durationInput.value) || 1);
}

function dataNoteForSelection() {
  if (state.source === "demo") {
    return "Usando datos de prueba para fechas sin datos de REE";
  }

  const selected = parseDateInput(state.selectedDate);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const seriesType = state.points[0]?.seriesType;

  if (isSameDay(selected, tomorrow)) {
    return seriesType === "spot"
      ? "Mañana: datos spot del día siguiente; el PVPC puede aparecer más tarde"
      : "Mañana: datos del día siguiente disponibles";
  }

  if (isSameDay(selected, today)) {
    return seriesType === "spot" ? "Hoy: datos de mercado spot" : "Hoy: datos de mercado PVPC";
  }

  return seriesType === "spot" ? "Datos históricos de mercado spot" : "Datos históricos de mercado PVPC";
}

function gradeForScore(score) {
  if (score >= 90) return { letter: "A", hint: "Horario excelente" };
  if (score >= 78) return { letter: "B", hint: "Horario muy bueno" };
  if (score >= 64) return { letter: "C", hint: "Horario razonable" };
  if (score >= 50) return { letter: "D", hint: "Por debajo de la media" };
  if (score >= 35) return { letter: "E", hint: "Horario caro" };
  return { letter: "F", hint: "Evitar si puedes moverlo" };
}

function loadLabelForKwh(kwh) {
  if (kwh <= 1) return { letter: "A", hint: "Consumo muy bajo" };
  if (kwh <= 2) return { letter: "B", hint: "Consumo bajo" };
  if (kwh <= 3.5) return { letter: "C", hint: "Consumo moderado" };
  if (kwh <= 5) return { letter: "D", hint: "Consumo medio-alto" };
  if (kwh <= 7.5) return { letter: "E", hint: "Consumo alto" };
  if (kwh <= 11) return { letter: "F", hint: "Consumo muy alto" };
  return { letter: "G", hint: "Consumo máximo" };
}

function renderLoadLabel(load) {
  const kwh = (Number(els.applianceInput.value) || 1) * (Number(els.durationInput.value) || 1);
  els.loadLabel.dataset.active = load.letter;
  els.loadHint.textContent = `${load.hint}: ${kwh.toFixed(1)} kWh estimados`;
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
      label: "Precio de prueba",
    };
  });
}

function setLoading(isLoading) {
  els.refreshButton.disabled = isLoading;
  els.refreshButton.textContent = isLoading ? "Actualizando" : "Actualizar";
  if (isLoading) {
    els.recommendationTitle.textContent = "Cargando datos de REE...";
    els.dataStatus.textContent = "Conectando";
    els.dataNote.textContent = "Las fechas están disponibles hasta mañana";
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
  return `Empieza a las ${formatHour(start)}`;
}

function loadName() {
  return els.applianceInput.selectedOptions[0]?.textContent.split(" - ")[0] || "este consumo";
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
    return `${kw.toFixed(1)} kW durante ${duration} h, solo componente de mercado`;
  }

  return `${kw.toFixed(1)} kW durante ${duration} h con ${settings.vat}% IVA, ${settings.electricityTax}% impuesto eléctrico y ${formatEurKwh(settings.adder)} añadidos`;
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

function initVehiclePlanner() {
  renderVehicleBrands();
  loadVehicleSettings();
  updateVehicleHint();
}

function renderVehicleBrands() {
  els.vehicleBrandInput.innerHTML = Object.keys(VEHICLE_PRESETS)
    .map((brand) => `<option value="${escapeHTML(brand)}">${escapeHTML(brand)}</option>`)
    .join("");
}

function renderVehicleModels() {
  const models = vehicleModelsForBrand(els.vehicleBrandInput.value);
  els.vehicleModelInput.innerHTML = models
    .map((vehicle) => `<option value="${escapeHTML(vehicle.model)}">${escapeHTML(vehicle.model)}</option>`)
    .join("");
}

function handleVehicleBrandChange() {
  renderVehicleModels();
  syncVehicleBatteryFromModel();
  handleVehicleSettingsChange();
}

function handleVehicleModelChange() {
  syncVehicleBatteryFromModel();
  handleVehicleSettingsChange();
}

function handleVehicleSettingsChange() {
  saveVehicleSettings();
  updateVehicleHint();
}

function applyVehiclePlanner() {
  const estimate = vehicleChargeEstimate();
  els.profileInput.value = "";
  setApplianceByKw(estimate.kw);
  els.durationInput.value = String(estimate.duration);
  saveVehicleSettings();
  updateVehicleHint();
  render();
}

function updateVehicleHint() {
  const vehicle = selectedVehicle();
  const estimate = vehicleChargeEstimate();
  const cappedText =
    estimate.rawDuration > MAX_DURATION
      ? ` Limitado a ${MAX_DURATION} h para planificar un solo día.`
      : "";
  els.vehicleHint.textContent = `${vehicle.model}: del ${estimate.from}% al ${estimate.to}% añade unos ${estimate.kwh.toFixed(1)} kWh desde una batería de ${estimate.batteryKwh.toFixed(1)} kWh. A ${estimate.kw.toFixed(1)} kW, planifica unas ${estimate.duration} h.${cappedText}`;
}

function vehicleChargeEstimate() {
  const parsedBattery = Number(els.vehicleBatteryInput.value);
  const parsedFrom = Number(els.chargeFromInput.value);
  const parsedTo = Number(els.chargeToInput.value);
  const parsedKw = Number(els.chargerPowerInput.value);
  const batteryKwh = clamp(
    Number.isFinite(parsedBattery) && parsedBattery > 0
      ? parsedBattery
      : selectedVehicle().batteryKwh,
    10,
    130
  );
  const from = clamp(Number.isFinite(parsedFrom) ? Math.round(parsedFrom) : 50, 0, 99);
  const to = clamp(Number.isFinite(parsedTo) ? Math.round(parsedTo) : 80, from + 1, 100);
  els.vehicleBatteryInput.value = String(batteryKwh);
  els.chargeFromInput.value = String(from);
  els.chargeToInput.value = String(to);
  const kwh = Math.max(0.5, batteryKwh * ((to - from) / 100));
  const kw = clamp(Number.isFinite(parsedKw) && parsedKw > 0 ? parsedKw : 3.7, 1, 22);
  const rawDuration = Math.ceil(kwh / kw);
  return {
    batteryKwh,
    from,
    to,
    kwh,
    kw,
    rawDuration,
    duration: clamp(rawDuration, 1, MAX_DURATION),
  };
}

function selectedVehicle() {
  const models = vehicleModelsForBrand(els.vehicleBrandInput.value);
  return models.find((vehicle) => vehicle.model === els.vehicleModelInput.value) || models[0];
}

function vehicleModelsForBrand(brand) {
  return VEHICLE_PRESETS[brand] || VEHICLE_PRESETS.Personalizado;
}

function syncVehicleBatteryFromModel() {
  const vehicle = selectedVehicle();
  els.vehicleBatteryInput.value = String(vehicle.batteryKwh);
}

function loadVehicleSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(VEHICLE_STORAGE_KEY) || "{}");
    const storedBrand = settings.brand === "Custom" ? "Personalizado" : settings.brand;
    if (storedBrand && VEHICLE_PRESETS[storedBrand]) {
      els.vehicleBrandInput.value = storedBrand;
    }
    renderVehicleModels();
    if (settings.model) {
      const modelExists = vehicleModelsForBrand(els.vehicleBrandInput.value).some(
        (vehicle) => vehicle.model === settings.model
      );
      if (modelExists) els.vehicleModelInput.value = settings.model;
    }
    if (Number.isFinite(settings.batteryKwh)) {
      els.vehicleBatteryInput.value = String(settings.batteryKwh);
    } else {
      syncVehicleBatteryFromModel();
    }
    if (Number.isFinite(settings.chargeFromPercent)) {
      els.chargeFromInput.value = String(settings.chargeFromPercent);
    }
    if (Number.isFinite(settings.chargeToPercent)) {
      els.chargeToInput.value = String(settings.chargeToPercent);
    } else if (Number.isFinite(settings.chargeNeedKwh)) {
      const batteryKwh = Number(els.vehicleBatteryInput.value) || selectedVehicle().batteryKwh;
      const extraPercent = Math.round((settings.chargeNeedKwh / batteryKwh) * 100);
      els.chargeFromInput.value = "50";
      els.chargeToInput.value = String(clamp(50 + extraPercent, 51, 100));
    }
    if (Number.isFinite(settings.chargerKw)) {
      els.chargerPowerInput.value = String(settings.chargerKw);
    }
  } catch {
    localStorage.removeItem(VEHICLE_STORAGE_KEY);
  }
}

function saveVehicleSettings() {
  try {
    const estimate = vehicleChargeEstimate();
    localStorage.setItem(
      VEHICLE_STORAGE_KEY,
      JSON.stringify({
        brand: els.vehicleBrandInput.value,
        model: els.vehicleModelInput.value,
        batteryKwh: estimate.batteryKwh,
        chargeFromPercent: estimate.from,
        chargeToPercent: estimate.to,
        chargerKw: estimate.kw,
      })
    );
  } catch {
    // Vehicle settings are optional.
  }
}

async function loadConnectorDevices() {
  try {
    const url = backendUrl("/devices");
    url.searchParams.set("userId", connectorUserId());
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`La solicitud de dispositivos falló con estado ${response.status}`);
    const data = await response.json();
    state.devices = Array.isArray(data.devices) ? data.devices : [];
  } catch {
    state.devices = [];
  }

  renderConnectorDevices();
  renderConnectorPanel();
}

function renderConnectorDevices() {
  const current = els.chargerDeviceInput.value;
  const options = state.devices.length
    ? state.devices
        .map(
          (device) =>
            `<option value="${escapeHTML(device.id)}">${escapeHTML(device.displayName)} - ${escapeHTML(connectorStatusLabel(device.status))}</option>`
        )
        .join("")
    : '<option value="">Ningún cargador conectado</option>';

  els.chargerDeviceInput.innerHTML = options;
  if (state.devices.some((device) => device.id === current)) {
    els.chargerDeviceInput.value = current;
  }
}

function renderConnectorPanel() {
  const device = selectedConnectorDevice();
  const canCommand = Boolean(device);
  const canPlan = Boolean(device && state.best);

  els.sendPlanButton.disabled = !canPlan;
  els.startMockButton.disabled = !canCommand;
  els.stopMockButton.disabled = !canCommand;

  if (!device) {
    els.connectorStatus.textContent = "Solo prueba. Conecta el wallbox de prueba para probar la programación.";
    return;
  }

  const windowText = state.best
    ? `${formatWindow(state.best.start, Number(els.durationInput.value) || 1)} lista`
    : "No hay ventana de carga lista";
  els.connectorStatus.textContent = `${device.displayName}: ${connectorStatusLabel(device.status)}. ${windowText}.`;
}

async function connectMockCharger() {
  setConnectorBusy(true, "Conectando wallbox de prueba...");
  try {
    const response = await postConnectorJson("/connectors/mock/pair", {
      userId: connectorUserId(),
      displayName: "Wallbox de prueba",
      maxKw: Number(els.chargerPowerInput.value) || 7.4,
    });
    const device = response.device;
    await loadConnectorDevices();
    if (device?.id) els.chargerDeviceInput.value = device.id;
    els.connectorStatus.textContent = response.reused
      ? "Wallbox de prueba ya conectado."
      : "Wallbox de prueba conectado. No se controla ningún cargador real.";
  } catch (error) {
    els.connectorStatus.textContent = error.message || "No se pudo conectar el wallbox de prueba.";
  } finally {
    setConnectorBusy(false);
    renderConnectorPanel();
  }
}

async function sendSmartChargePlan() {
  const device = selectedConnectorDevice();
  if (!device || !state.best) return;

  const duration = Number(els.durationInput.value) || 1;
  const estimate = vehicleChargeEstimate();
  const windowLabel = formatWindow(state.best.start, duration);
  setConnectorBusy(true, "Enviando plan de carga inteligente...");

  try {
    const response = await postConnectorJson("/charge-plans", {
      userId: connectorUserId(),
      deviceId: device.id,
      date: state.selectedDate,
      startHour: state.best.start,
      durationHours: duration,
      targetKwh: estimate.kwh,
      chargerKw: estimate.kw,
      windowLabel,
      estimatedCost: state.best.cost,
      metadata: {
        brand: els.vehicleBrandInput.value,
        model: els.vehicleModelInput.value,
        score: Math.round(state.best.score),
      },
    });

    upsertConnectorDevice(response.device);
    renderConnectorDevices();
    els.chargerDeviceInput.value = response.device.id;
    els.connectorStatus.textContent = `Plan enviado a ${response.device.displayName}: ${windowLabel}.`;
  } catch (error) {
    els.connectorStatus.textContent = error.message || "No se pudo enviar el plan.";
  } finally {
    setConnectorBusy(false);
    renderConnectorPanel();
  }
}

async function sendDeviceCommand(command) {
  const device = selectedConnectorDevice();
  if (!device) return;

  setConnectorBusy(true, `${command === "start" ? "Iniciando" : "Parando"} cargador...`);
  try {
    const response = await postConnectorJson(`/devices/${encodeURIComponent(device.id)}/commands`, {
      userId: connectorUserId(),
      command,
    });
    upsertConnectorDevice(response.device);
    renderConnectorDevices();
    els.chargerDeviceInput.value = response.device.id;
    els.connectorStatus.textContent = `${response.device.displayName}: ${connectorStatusLabel(response.device.status)}.`;
  } catch (error) {
    els.connectorStatus.textContent =
      error.message || `No se pudo ${command === "start" ? "iniciar" : "parar"} el cargador.`;
  } finally {
    setConnectorBusy(false);
    renderConnectorPanel();
  }
}

function selectedConnectorDevice() {
  return state.devices.find((device) => device.id === els.chargerDeviceInput.value) || state.devices[0] || null;
}

function upsertConnectorDevice(device) {
  if (!device?.id) return;
  state.devices = [device, ...state.devices.filter((item) => item.id !== device.id)];
}

function connectorStatusLabel(status) {
  const labels = {
    available: "disponible",
    scheduled: "programado",
    charging: "cargando",
    paused: "pausado"
  };
  return labels[status] || status || "desconocido";
}

async function postConnectorJson(path, body) {
  const response = await fetch(backendUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `La solicitud al conector falló con estado ${response.status}`);
  }
  return data;
}

function backendUrl(path) {
  return new URL(`${BACKEND_API_BASE.replace(/\/$/, "")}${path}`, window.location.origin);
}

function connectorUserId() {
  try {
    const existing = localStorage.getItem(CONNECTOR_USER_STORAGE_KEY);
    if (existing) return existing;
    const value = `pw_${crypto.randomUUID()}`;
    localStorage.setItem(CONNECTOR_USER_STORAGE_KEY, value);
    return value;
  } catch {
    return "pw_local_browser";
  }
}

function setConnectorBusy(isBusy, text = "") {
  els.connectMockButton.disabled = isBusy;
  els.sendPlanButton.disabled = isBusy || !selectedConnectorDevice() || !state.best;
  els.startMockButton.disabled = isBusy || !selectedConnectorDevice();
  els.stopMockButton.disabled = isBusy || !selectedConnectorDevice();
  if (text) els.connectorStatus.textContent = text;
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
  const custom = '<option value="">Consumo personalizado</option>';
  const saved = state.profiles
    .map(
      (profile, index) =>
        `<option value="${index}">${escapeHTML(profile.name)} - ${profile.kw.toFixed(1)} kW, ${profile.duration}h</option>`
    )
    .join("");
  els.profileInput.innerHTML = custom + saved;
}

function saveCurrentProfile() {
  const fallbackName = loadName() === "este consumo" ? "Mi consumo" : loadName();
  const name = window.prompt("Nombre del perfil", fallbackName);
  if (!name?.trim()) return;

  const profile = {
    name: name.trim().slice(0, 40),
    kw: Number(els.applianceInput.value) || 1,
    duration: clamp(Math.round(Number(els.durationInput.value) || 1), 1, MAX_DURATION),
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
    els.reminderStatus.textContent = "La ventana empieza pronto";
    return;
  }

  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }

  clearTimeout(state.reminderTimer);
  state.reminderTimer = window.setTimeout(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Power Window", {
        body: `${name} empieza en 10 minutos: ${formatWindow(bestStart, duration)}`,
      });
    } else {
      window.alert(`Power Window: ${name} empieza en 10 minutos.`);
    }
  }, delay);

  els.reminderStatus.textContent = `Programado para ${formatDateTime(reminderAt.toISOString())}`;
}

async function installApp() {
  if (!state.deferredInstallPrompt) {
    els.installHint.textContent = "Ábrelo en Chrome para Android y usa Añadir a pantalla de inicio.";
    return;
  }

  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  els.installButton.disabled = true;
  els.installHint.textContent = "La instalación la gestiona el navegador.";
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
  const suffix = compact ? "" : " €/MWh";
  return `${Math.round(value)}${suffix}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatEurKwh(value) {
  return `${value.toFixed(3)} €/kWh`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("es-ES", {
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
