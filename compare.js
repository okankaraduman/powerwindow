const COMPARE_IS_ES = document.documentElement.lang === "es";
const COMPARE_REE_API_BASE = "https://apidatos.ree.es/en/datos";
const COMPARE_MARKET_WIDGET = "mercados/precios-mercados-tiempo-real";
const COMPARE_DEFAULT_BACKEND_API_BASE =
  window.location.hostname === "powerwindow.energy" ||
  window.location.hostname === "www.powerwindow.energy"
    ? "https://api.powerwindow.energy/api"
    : "/api";
const COMPARE_BACKEND_API_BASE =
  window.POWER_WINDOW_API_BASE ||
  localStorage.getItem("POWER_WINDOW_API_BASE") ||
  COMPARE_DEFAULT_BACKEND_API_BASE;
const COMPARE_SETTINGS_KEY = "power-window:compare-settings";
const COMPARE_TARIFFS_KEY = "power-window:compare-tariffs";
const COMPARE_DAYS_PER_MONTH = 30.42;
const COMPARE_DEFAULT_POWER_DAY = 0.105;

const compareText = COMPARE_IS_ES
  ? {
      loading: "Calculando comparativa...",
      sourcePending: "Fuente pendiente",
      connecting: "Conectando",
      backend: "PVPC desde backend",
      network: "PVPC directo de REE",
      fallback: "Supuesto editable",
      browser: "PVPC cacheado",
      pvpcName: "PVPC con horario flexible",
      pvpcType: "PVPC",
      bestPrefix: "Mejor estimación: ",
      bestReason:
        "Este resultado combina energía, potencia, cuota mensual e impuestos editables. Revisa siempre el contrato real.",
      unavailable: "No disponible",
      savingHint: "Diferencia mensual estimada entre la opción más barata y la más cara.",
      pvpcHint: "Estimación regulada con kWh flexibles colocados en las horas más baratas del día.",
      flexHint: "Consumo mensual que el comparador mueve a valle o a horas baratas.",
      noLinks: "Sin enlaces",
      withLinks: " enlaces",
      affiliateNoLinks: "No hay acuerdos de referencia activos en esta versión.",
      affiliateWithLinks: "Las ofertas con enlace deben marcarse como referido o afiliado.",
      monthly: "mes",
      annual: "año",
      energy: "Energía",
      power: "Potencia + cuota",
      taxes: "Impuestos estimados",
      estimate: "Estimación",
      versusWorst: "menos que la opción más cara",
      bestBadge: "Mejor",
      cta: "Ver oferta",
      noCta: "Sin enlace comercial",
      sampleFlat: "Oferta fija editable",
      sampleThree: "Oferta tres periodos editable",
      sampleEv: "Oferta nocturna para EV editable",
      customOffer: "Oferta personalizada",
      flatType: "Precio fijo",
      periodType: "Tres periodos",
      evType: "EV nocturno",
      name: "Nombre",
      type: "Tipo",
      flatRate: "Fijo €/kWh",
      peakRate: "Punta €/kWh",
      midRate: "Llano €/kWh",
      valleyRate: "Valle €/kWh",
      powerDay: "Potencia €/kW/día",
      monthlyFee: "Cuota €/mes",
      referralUrl: "Enlace referido",
      remove: "Eliminar",
      pvpcNote: "PVPC usa precios horarios publicados por REE; periodos simplificados 2.0TD sin festivos.",
      fallbackNote: "REE no devolvió PVPC útil, así que usamos un supuesto editable de referencia.",
      updated: "Actualizado",
      resetDone: "Supuestos restablecidos",
    }
  : {
      loading: "Calculating comparison...",
      sourcePending: "Source pending",
      connecting: "Connecting",
      backend: "PVPC from backend",
      network: "Direct REE PVPC",
      fallback: "Editable assumption",
      browser: "Cached PVPC",
      pvpcName: "PVPC with flexible timing",
      pvpcType: "PVPC",
      bestPrefix: "Best estimate: ",
      bestReason:
        "This result combines energy, power, monthly fee, and editable taxes. Always check the real contract.",
      unavailable: "Unavailable",
      savingHint: "Estimated monthly difference between the cheapest and most expensive option.",
      pvpcHint: "Regulated estimate with flexible kWh placed in the day's cheapest hours.",
      flexHint: "Monthly usage the comparator moves to valley or cheap hours.",
      noLinks: "No links",
      withLinks: " links",
      affiliateNoLinks: "No active referral agreements in this version.",
      affiliateWithLinks: "Offers with links should be labelled as referral or affiliate.",
      monthly: "month",
      annual: "year",
      energy: "Energy",
      power: "Power + fee",
      taxes: "Estimated taxes",
      estimate: "Estimate",
      versusWorst: "less than the most expensive option",
      bestBadge: "Best",
      cta: "View offer",
      noCta: "No commercial link",
      sampleFlat: "Editable flat offer",
      sampleThree: "Editable three-period offer",
      sampleEv: "Editable EV night offer",
      customOffer: "Custom offer",
      flatType: "Flat price",
      periodType: "Three periods",
      evType: "EV night",
      name: "Name",
      type: "Type",
      flatRate: "Flat €/kWh",
      peakRate: "Peak €/kWh",
      midRate: "Shoulder €/kWh",
      valleyRate: "Valley €/kWh",
      powerDay: "Power €/kW/day",
      monthlyFee: "Fee €/month",
      referralUrl: "Referral link",
      remove: "Remove",
      pvpcNote: "PVPC uses hourly prices published by REE; simplified 2.0TD periods without holidays.",
      fallbackNote: "REE did not return usable PVPC, so we are using an editable reference assumption.",
      updated: "Updated",
      resetDone: "Assumptions reset",
    };

const compareState = {
  settings: loadCompareSettings(),
  tariffs: loadCompareTariffs(),
  pvpc: fallbackPvpcRates(),
  pvpcSource: "fallback",
  pvpcDate: madridDateString(0),
  lastUpdated: "",
};

const compareEls = {
  monthlyKwh: document.querySelector("#monthlyKwhInput"),
  flexKwh: document.querySelector("#flexKwhInput"),
  powerKw: document.querySelector("#powerKwInput"),
  peakShare: document.querySelector("#peakShareInput"),
  flatShare: document.querySelector("#flatShareInput"),
  valleyShare: document.querySelector("#valleyShareInput"),
  vat: document.querySelector("#vatCompareInput"),
  tax: document.querySelector("#taxCompareInput"),
  addTariffButton: document.querySelector("#addTariffButton"),
  resetButton: document.querySelector("#resetCompareButton"),
  refreshButton: document.querySelector("#refreshCompareButton"),
  heroTitle: document.querySelector("#compareHeroTitle"),
  heroReason: document.querySelector("#compareHeroReason"),
  dataStatus: document.querySelector("#compareDataStatus"),
  dataNote: document.querySelector("#compareDataNote"),
  lastUpdated: document.querySelector("#compareLastUpdated"),
  savings: document.querySelector("#compareSavings"),
  savingsHint: document.querySelector("#compareSavingsHint"),
  pvpcEstimate: document.querySelector("#pvpcEstimate"),
  pvpcHint: document.querySelector("#pvpcHint"),
  flexibleShare: document.querySelector("#flexibleShare"),
  flexibleHint: document.querySelector("#flexibleHint"),
  affiliateStatus: document.querySelector("#affiliateStatus"),
  affiliateHint: document.querySelector("#affiliateHint"),
  tariffEditor: document.querySelector("#tariffEditor"),
  results: document.querySelector("#comparisonResults"),
  resultsNote: document.querySelector("#compareResultsNote"),
};

initCompare();

function initCompare() {
  populateSettingsInputs();
  renderTariffEditor();
  bindCompareEvents();
  renderCompare();
  loadPvpcRates();
}

function bindCompareEvents() {
  [
    compareEls.monthlyKwh,
    compareEls.flexKwh,
    compareEls.powerKw,
    compareEls.peakShare,
    compareEls.flatShare,
    compareEls.valleyShare,
    compareEls.vat,
    compareEls.tax,
  ].forEach((input) => input.addEventListener("input", handleSettingsInput));

  compareEls.tariffEditor.addEventListener("input", handleTariffInput);
  compareEls.tariffEditor.addEventListener("change", handleTariffInput);
  compareEls.tariffEditor.addEventListener("click", handleTariffClick);
  compareEls.addTariffButton.addEventListener("click", addTariff);
  compareEls.resetButton.addEventListener("click", resetComparator);
  compareEls.refreshButton.addEventListener("click", () => loadPvpcRates({ forceRefresh: true }));
}

function populateSettingsInputs() {
  compareEls.monthlyKwh.value = compareState.settings.monthlyKwh;
  compareEls.flexKwh.value = compareState.settings.flexKwh;
  compareEls.powerKw.value = compareState.settings.powerKw;
  compareEls.peakShare.value = compareState.settings.peakShare;
  compareEls.flatShare.value = compareState.settings.flatShare;
  compareEls.valleyShare.value = compareState.settings.valleyShare;
  compareEls.vat.value = compareState.settings.vat;
  compareEls.tax.value = compareState.settings.tax;
}

function handleSettingsInput() {
  compareState.settings = readCompareSettingsFromInputs();
  saveCompareSettings();
  renderCompare();
}

function handleTariffInput(event) {
  const target = event.target;
  const tariffId = target.dataset.tariffId;
  const field = target.dataset.field;
  if (!tariffId || !field) return;

  const tariff = compareState.tariffs.find((item) => item.id === tariffId);
  if (!tariff) return;

  if (field === "name" || field === "type" || field === "referralUrl") {
    tariff[field] = target.value;
  } else {
    tariff[field] = readInputNumber(target, 0);
  }

  saveCompareTariffs();
  renderCompare();
}

function handleTariffClick(event) {
  const button = event.target.closest("[data-remove-tariff]");
  if (!button) return;
  const id = button.dataset.removeTariff;
  compareState.tariffs = compareState.tariffs.filter((tariff) => tariff.id !== id);
  if (!compareState.tariffs.length) compareState.tariffs = defaultTariffs();
  saveCompareTariffs();
  renderTariffEditor();
  renderCompare();
}

function addTariff() {
  compareState.tariffs.push({
    id: `custom-${Date.now()}`,
    name: compareText.customOffer,
    type: "period",
    flatRate: 0.16,
    peakRate: 0.22,
    midRate: 0.16,
    valleyRate: 0.1,
    powerDay: COMPARE_DEFAULT_POWER_DAY,
    monthlyFee: 0,
    referralUrl: "",
  });
  saveCompareTariffs();
  renderTariffEditor();
  renderCompare();
}

function resetComparator() {
  compareState.settings = defaultCompareSettings();
  compareState.tariffs = defaultTariffs();
  saveCompareSettings();
  saveCompareTariffs();
  populateSettingsInputs();
  renderTariffEditor();
  renderCompare(compareText.resetDone);
}

async function loadPvpcRates(options = {}) {
  compareEls.refreshButton.disabled = true;
  compareEls.dataStatus.textContent = compareText.connecting;
  compareEls.dataNote.textContent = compareText.sourcePending;

  try {
    const dateValue = madridDateString(0);
    const response = await fetchMarketData(dateValue, options);
    const points = parseMarketData(response.payload);
    if (!points.length) throw new Error("No PVPC points");

    compareState.pvpc = buildPvpcRates(points, dateValue);
    compareState.pvpcSource = response.cacheStatus;
    compareState.pvpcDate = dateValue;
    compareState.lastUpdated = new Date().toISOString();
  } catch {
    compareState.pvpc = fallbackPvpcRates();
    compareState.pvpcSource = "fallback";
    compareState.pvpcDate = madridDateString(0);
    compareState.lastUpdated = new Date().toISOString();
  } finally {
    compareEls.refreshButton.disabled = false;
    renderCompare();
  }
}

async function fetchMarketData(dateValue, options = {}) {
  const backendURL = new URL(`${COMPARE_BACKEND_API_BASE.replace(/\/$/, "")}/market`, window.location.origin);
  backendURL.searchParams.set("date", dateValue);
  if (options.forceRefresh) backendURL.searchParams.set("refresh", "1");

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
    // Fall through to direct REE data when local routing is unavailable.
  }

  const url =
    `${COMPARE_REE_API_BASE}/${COMPARE_MARKET_WIDGET}` +
    `?start_date=${dateValue}T00:00&end_date=${dateValue}T23:59&time_trunc=hour`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`REE returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].detail || "REE returned an error");
  return { payload, cacheStatus: "network" };
}

function renderTariffEditor() {
  compareEls.tariffEditor.innerHTML = compareState.tariffs
    .map(
      (tariff) => `
        <article class="tariff-editor-card">
          <div class="tariff-card-header">
            <strong>${escapeHTML(tariff.name)}</strong>
            <button
              class="icon-text-button"
              type="button"
              data-remove-tariff="${escapeHTML(tariff.id)}"
              aria-label="${compareText.remove}"
            >
              ${compareText.remove}
            </button>
          </div>
          <label class="field">
            <span>${compareText.name}</span>
            <input data-tariff-id="${escapeHTML(tariff.id)}" data-field="name" type="text" value="${escapeAttr(tariff.name)}" />
          </label>
          <label class="field">
            <span>${compareText.type}</span>
            <select data-tariff-id="${escapeHTML(tariff.id)}" data-field="type">
              <option value="flat" ${tariff.type === "flat" ? "selected" : ""}>${compareText.flatType}</option>
              <option value="period" ${tariff.type === "period" ? "selected" : ""}>${compareText.periodType}</option>
              <option value="ev" ${tariff.type === "ev" ? "selected" : ""}>${compareText.evType}</option>
            </select>
          </label>
          <div class="tariff-rate-grid">
            ${rateInput(tariff, "flatRate", compareText.flatRate)}
            ${rateInput(tariff, "peakRate", compareText.peakRate)}
            ${rateInput(tariff, "midRate", compareText.midRate)}
            ${rateInput(tariff, "valleyRate", compareText.valleyRate)}
            ${rateInput(tariff, "powerDay", compareText.powerDay)}
            ${rateInput(tariff, "monthlyFee", compareText.monthlyFee)}
          </div>
          <label class="field">
            <span>${compareText.referralUrl}</span>
            <input
              data-tariff-id="${escapeHTML(tariff.id)}"
              data-field="referralUrl"
              type="url"
              inputmode="url"
              value="${escapeAttr(tariff.referralUrl || "")}"
              placeholder="https://"
            />
          </label>
        </article>
      `
    )
    .join("");
}

function rateInput(tariff, field, label) {
  return `
    <label class="field compact-field">
      <span>${label}</span>
      <input
        data-tariff-id="${escapeHTML(tariff.id)}"
        data-field="${field}"
        type="number"
        min="0"
        max="${field === "monthlyFee" ? "100" : "1"}"
        step="${field === "monthlyFee" ? "0.01" : "0.001"}"
        value="${formatInputValue(tariff[field])}"
      />
    </label>
  `;
}

function renderCompare(statusMessage = "") {
  const results = calculateResults();
  const best = results[0];
  const worst = results[results.length - 1];
  const savings = worst.total - best.total;
  const pvpc = results.find((result) => result.id === "pvpc");
  const settings = normalizeSettings(compareState.settings);
  const referralCount = compareState.tariffs.filter((tariff) => isSafeUrl(tariff.referralUrl)).length;

  compareEls.heroTitle.textContent = `${compareText.bestPrefix}${best.name}`;
  compareEls.heroReason.textContent = compareText.bestReason;
  compareEls.dataStatus.textContent = sourceLabel(compareState.pvpcSource);
  compareEls.dataNote.textContent =
    compareState.pvpcSource === "fallback" ? compareText.fallbackNote : compareText.pvpcNote;
  compareEls.lastUpdated.textContent = statusMessage || `${compareText.updated}: ${formatDateTime(compareState.lastUpdated)}`;

  compareEls.savings.textContent = formatMoney(savings);
  compareEls.savingsHint.textContent = `${formatMoney(savings * 12)} / ${compareText.annual} ${compareText.savingHint}`;
  compareEls.pvpcEstimate.textContent = pvpc ? formatMoney(pvpc.total) : "--";
  compareEls.pvpcHint.textContent = `${formatRate(compareState.pvpc.flexRate)} ${compareText.pvpcHint}`;
  compareEls.flexibleShare.textContent = `${Math.round((settings.flexKwh / settings.monthlyKwh) * 100)}%`;
  compareEls.flexibleHint.textContent = `${settings.flexKwh.toFixed(0)} kWh/${compareText.monthly}. ${compareText.flexHint}`;
  compareEls.affiliateStatus.textContent =
    referralCount > 0 ? `${referralCount}${compareText.withLinks}` : compareText.noLinks;
  compareEls.affiliateHint.textContent =
    referralCount > 0 ? compareText.affiliateWithLinks : compareText.affiliateNoLinks;
  compareEls.results.innerHTML = results.map((result, index) => resultCard(result, index, worst)).join("");
}

function resultCard(result, index, worst) {
  const url = isSafeUrl(result.referralUrl) ? result.referralUrl : "";
  const saving = worst.total - result.total;
  const cta = url
    ? `<a class="primary-button compare-cta" href="${escapeAttr(url)}" target="_blank" rel="noopener sponsored nofollow">${compareText.cta}</a>`
    : `<span class="compare-no-link">${compareText.noCta}</span>`;

  return `
    <article class="comparison-result-card ${index === 0 ? "best" : ""}">
      <div>
        <span class="eyebrow">${index === 0 ? compareText.bestBadge : `#${index + 1}`}</span>
        <h3>${escapeHTML(result.name)}</h3>
        <p>${escapeHTML(result.description)}</p>
      </div>
      <div class="comparison-price">
        <strong>${formatMoney(result.total)}</strong>
        <small>${compareText.estimate} / ${compareText.monthly}</small>
      </div>
      <div class="comparison-breakdown">
        <span>${compareText.energy}<strong>${formatMoney(result.energyCost)}</strong></span>
        <span>${compareText.power}<strong>${formatMoney(result.powerCost + result.monthlyFee)}</strong></span>
        <span>${compareText.taxes}<strong>${formatMoney(result.taxCost + result.vatCost)}</strong></span>
      </div>
      <div class="comparison-footer">
        <small>${formatMoney(saving)} ${compareText.versusWorst}</small>
        ${cta}
      </div>
    </article>
  `;
}

function calculateResults() {
  const settings = normalizeSettings(compareState.settings);
  const usage = usageBreakdown(settings);
  const pvpcResult = calculatePvpcResult(settings, usage);
  const tariffResults = compareState.tariffs.map((tariff) => calculateTariffResult(tariff, settings, usage));
  return [pvpcResult, ...tariffResults].sort((a, b) => a.total - b.total);
}

function calculatePvpcResult(settings, usage) {
  const rates = compareState.pvpc;
  const energyCost =
    usage.peakKwh * rates.peakRate +
    usage.midKwh * rates.midRate +
    usage.valleyKwh * rates.valleyRate +
    usage.flexKwh * rates.flexRate;
  return withTaxes({
    id: "pvpc",
    name: compareText.pvpcName,
    description: `${compareText.pvpcType}: ${formatRate(rates.averageRate)} avg, ${formatRate(rates.flexRate)} flexible.`,
    energyCost,
    powerCost: settings.powerKw * COMPARE_DEFAULT_POWER_DAY * COMPARE_DAYS_PER_MONTH,
    monthlyFee: 0,
    referralUrl: "",
    settings,
  });
}

function calculateTariffResult(tariff, settings, usage) {
  const isFlat = tariff.type === "flat";
  const energyCost = isFlat
    ? (usage.peakKwh + usage.midKwh + usage.valleyKwh + usage.flexKwh) * tariff.flatRate
    : usage.peakKwh * tariff.peakRate +
      usage.midKwh * tariff.midRate +
      (usage.valleyKwh + usage.flexKwh) * tariff.valleyRate;

  const description = isFlat
    ? `${compareText.flatType}: ${formatRate(tariff.flatRate)}`
    : `${tariff.type === "ev" ? compareText.evType : compareText.periodType}: ${formatRate(tariff.peakRate)} / ${formatRate(tariff.midRate)} / ${formatRate(tariff.valleyRate)}`;

  return withTaxes({
    id: tariff.id,
    name: tariff.name,
    description,
    energyCost,
    powerCost: settings.powerKw * tariff.powerDay * COMPARE_DAYS_PER_MONTH,
    monthlyFee: tariff.monthlyFee,
    referralUrl: tariff.referralUrl,
    settings,
  });
}

function withTaxes(result) {
  const subtotal = result.energyCost + result.powerCost + result.monthlyFee;
  const taxCost = subtotal * (result.settings.tax / 100);
  const vatCost = (subtotal + taxCost) * (result.settings.vat / 100);
  return {
    ...result,
    subtotal,
    taxCost,
    vatCost,
    total: subtotal + taxCost + vatCost,
  };
}

function usageBreakdown(settings) {
  const baseKwh = Math.max(0, settings.monthlyKwh - settings.flexKwh);
  return {
    peakKwh: baseKwh * settings.peakShare,
    midKwh: baseKwh * settings.flatShare,
    valleyKwh: baseKwh * settings.valleyShare,
    flexKwh: settings.flexKwh,
  };
}

function normalizeSettings(settings) {
  const monthlyKwh = clamp(Number(settings.monthlyKwh) || 0, 1, 3000);
  const flexKwh = clamp(Number(settings.flexKwh) || 0, 0, monthlyKwh);
  const powerKw = clamp(Number(settings.powerKw) || 0, 1, 20);
  const shares = [
    Math.max(0, Number(settings.peakShare) || 0),
    Math.max(0, Number(settings.flatShare) || 0),
    Math.max(0, Number(settings.valleyShare) || 0),
  ];
  const totalShare = shares.reduce((sum, value) => sum + value, 0) || 100;

  return {
    monthlyKwh,
    flexKwh,
    powerKw,
    peakShare: shares[0] / totalShare,
    flatShare: shares[1] / totalShare,
    valleyShare: shares[2] / totalShare,
    vat: clamp(Number(settings.vat) || 0, 0, 30),
    tax: clamp(Number(settings.tax) || 0, 0, 10),
  };
}

function readCompareSettingsFromInputs() {
  return {
    monthlyKwh: readInputNumber(compareEls.monthlyKwh, 420),
    flexKwh: readInputNumber(compareEls.flexKwh, 140),
    powerKw: readInputNumber(compareEls.powerKw, 4.6),
    peakShare: readInputNumber(compareEls.peakShare, 25),
    flatShare: readInputNumber(compareEls.flatShare, 35),
    valleyShare: readInputNumber(compareEls.valleyShare, 40),
    vat: readInputNumber(compareEls.vat, 21),
    tax: readInputNumber(compareEls.tax, 5.1127),
  };
}

function buildPvpcRates(points, dateValue) {
  const buckets = {
    peak: [],
    mid: [],
    valley: [],
  };

  points.forEach((point) => {
    const period = periodForHour(dateValue, point.hour);
    buckets[period].push(point.price / 1000);
  });

  const rates = points.map((point) => point.price / 1000).sort((a, b) => a - b);
  const cheapCount = Math.max(1, Math.round(rates.length / 3));
  return {
    peakRate: averageOrFallback(buckets.peak, 0.23),
    midRate: averageOrFallback(buckets.mid, 0.17),
    valleyRate: averageOrFallback(buckets.valley, 0.13),
    flexRate: averageOrFallback(rates.slice(0, cheapCount), 0.12),
    averageRate: averageOrFallback(rates, 0.17),
  };
}

function periodForHour(dateValue, hour) {
  const date = new Date(`${dateValue}T${String(hour).padStart(2, "0")}:00:00`);
  const day = date.getDay();
  if (day === 0 || day === 6) return "valley";
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return "peak";
  if ((hour >= 8 && hour < 10) || (hour >= 14 && hour < 18) || (hour >= 22 && hour < 24)) {
    return "mid";
  }
  return "valley";
}

function parseMarketData(data) {
  const included = Array.isArray(data.included) ? data.included : [];
  const pvpc = findSeries(included, ["PVPC"]);
  const spot = findSeries(included, ["Spot market price", "spot"]);
  const series = hasValues(pvpc) ? pvpc : spot;
  if (!series?.attributes?.values?.length) return [];

  const hourly = new Map();
  series.attributes.values.forEach((item) => {
    const hour = Number(String(item.datetime || "").match(/T(\d{2}):/)?.[1]);
    const value = Number(item.value);
    if (!Number.isFinite(hour) || !Number.isFinite(value)) return;
    const current = hourly.get(hour) || { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    hourly.set(hour, current);
  });

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourly.get(hour);
    if (!bucket) return null;
    return { hour, price: bucket.total / bucket.count };
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

function loadCompareSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPARE_SETTINGS_KEY));
    return { ...defaultCompareSettings(), ...(parsed || {}) };
  } catch {
    return defaultCompareSettings();
  }
}

function saveCompareSettings() {
  try {
    localStorage.setItem(COMPARE_SETTINGS_KEY, JSON.stringify(compareState.settings));
  } catch {
    // Browser storage is best effort.
  }
}

function loadCompareTariffs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPARE_TARIFFS_KEY));
    if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeTariff);
  } catch {
    // Use defaults below.
  }
  return defaultTariffs();
}

function saveCompareTariffs() {
  try {
    localStorage.setItem(COMPARE_TARIFFS_KEY, JSON.stringify(compareState.tariffs));
  } catch {
    // Browser storage is best effort.
  }
}

function normalizeTariff(tariff) {
  return {
    id: String(tariff.id || `tariff-${Date.now()}`),
    name: String(tariff.name || compareText.customOffer),
    type: ["flat", "period", "ev"].includes(tariff.type) ? tariff.type : "period",
    flatRate: clamp(Number(tariff.flatRate) || 0, 0, 1),
    peakRate: clamp(Number(tariff.peakRate) || 0, 0, 1),
    midRate: clamp(Number(tariff.midRate) || 0, 0, 1),
    valleyRate: clamp(Number(tariff.valleyRate) || 0, 0, 1),
    powerDay: clamp(Number(tariff.powerDay) || COMPARE_DEFAULT_POWER_DAY, 0, 1),
    monthlyFee: clamp(Number(tariff.monthlyFee) || 0, 0, 100),
    referralUrl: String(tariff.referralUrl || ""),
  };
}

function defaultCompareSettings() {
  return {
    monthlyKwh: 420,
    flexKwh: 140,
    powerKw: 4.6,
    peakShare: 25,
    flatShare: 35,
    valleyShare: 40,
    vat: 21,
    tax: 5.1127,
  };
}

function defaultTariffs() {
  return [
    {
      id: "flat-sample",
      name: compareText.sampleFlat,
      type: "flat",
      flatRate: 0.165,
      peakRate: 0.2,
      midRate: 0.16,
      valleyRate: 0.12,
      powerDay: COMPARE_DEFAULT_POWER_DAY,
      monthlyFee: 0,
      referralUrl: "",
    },
    {
      id: "period-sample",
      name: compareText.sampleThree,
      type: "period",
      flatRate: 0.16,
      peakRate: 0.215,
      midRate: 0.155,
      valleyRate: 0.105,
      powerDay: COMPARE_DEFAULT_POWER_DAY,
      monthlyFee: 0,
      referralUrl: "",
    },
    {
      id: "ev-sample",
      name: compareText.sampleEv,
      type: "ev",
      flatRate: 0.17,
      peakRate: 0.24,
      midRate: 0.17,
      valleyRate: 0.075,
      powerDay: COMPARE_DEFAULT_POWER_DAY,
      monthlyFee: 0,
      referralUrl: "",
    },
  ];
}

function fallbackPvpcRates() {
  return {
    peakRate: 0.23,
    midRate: 0.17,
    valleyRate: 0.13,
    flexRate: 0.12,
    averageRate: 0.17,
  };
}

function readInputNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function averageOrFallback(values, fallback) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return fallback;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function sourceLabel(source) {
  return compareText[source] || compareText.fallback;
}

function madridDateString(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat(COMPARE_IS_ES ? "es-ES" : "en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatRate(value) {
  return `${new Intl.NumberFormat(COMPARE_IS_ES ? "es-ES" : "en-GB", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value || 0)} €/kWh`;
}

function formatDateTime(value) {
  if (!value) return compareText.sourcePending;
  return new Intl.DateTimeFormat(COMPARE_IS_ES ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

function formatInputValue(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "0";
}

function isSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
