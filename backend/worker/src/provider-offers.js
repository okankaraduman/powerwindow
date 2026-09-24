const OCTOPUS_URL = "https://octopusenergy.es/precios";
const TOTAL_FLAT_URL = "https://www.totalenergies.es/es/hogares/tarifas-luz/a-tu-aire-siempre";
const TOTAL_PERIOD_URL = "https://www.totalenergies.es/es/hogares/tarifas-luz/a-tu-aire-programa-tu-ahorro";
const MAX_AGE_MS = 72 * 60 * 60 * 1000;
const REFRESH_MS = 24 * 60 * 60 * 1000;
const KEY = "provider-offers:verified:v1";

export function parseOctopusOffers(html, checkedAt = new Date().toISOString()) {
  const offers = [];
  for (const [prefix, name, type] of [
    ["OCTORELAX-", "Octopus Relax", "flat"],
    ["OCTO3-", "Octopus 3", "period"],
  ]) {
    const matches = [...html.matchAll(/"code":"([^"\\]+)"[^]{0,1800}?"prices":(\{[^}]+\})/g)];
    const match = matches.find((entry) => entry[1].startsWith(prefix) && !entry[1].includes("UNICAJA"));
    if (!match) continue;
    let prices;
    try { prices = JSON.parse(match[2]); } catch { continue; }
    const energy = prices.variableTerm;
    const power = prices.fixedTerm;
    if (!Array.isArray(energy) || energy.length !== 3 || !Array.isArray(power) || power.length !== 2 ||
      ![...energy, ...power].every((value) => Number.isFinite(value) && value > 0 && value < 1)) continue;
    if (type === "flat" && !energy.every((value) => value === energy[0])) continue;
    offers.push({
      id: `octopus-${type}`,
      company: "Octopus Energy",
      name,
      type,
      flatRate: energy[1],
      peakRate: energy[0],
      midRate: energy[1],
      valleyRate: energy[2],
      powerDay: power[0] + power[1],
      monthlyFee: 0,
      taxMode: "preTax",
      checkedAt,
      sourceUrl: OCTOPUS_URL,
      note: {
        es: "Precio público sin impuestos; confirma las condiciones antes de contratar.",
        en: "Public price before tax; confirm the terms before signing.",
      },
    });
  }
  return offers;
}

export function parseTotalEnergyOffers(flatHtml, periodHtml, checkedAt = new Date().toISOString()) {
  const tiers = [
    { minAnnualKwh: 0, maxAnnualKwh: 3500, label: "<3,500 kWh/year" },
    { minAnnualKwh: 3500, maxAnnualKwh: 5000, label: "3,500–5,000 kWh/year" },
    { minAnnualKwh: 5000, maxAnnualKwh: null, label: ">5,000 kWh/year" },
  ];
  const output = [];
  for (const [html, marker, type, name, url, expected] of [
    [flatHtml, "Siempre", "flat", "A tu Aire Siempre Luz", TOTAL_FLAT_URL, 3],
    [periodHtml, "Ahorro", "period", "A tu Aire Programa tu Ahorro Luz", TOTAL_PERIOD_URL, 5],
  ]) {
    const blocks = [...html.matchAll(new RegExp(`Precios Luz A tu Aire ${marker} sin impuestos<\\/strong>[^]{0,3500}?<tbody><tr>([^]*?)<\\/tr>`, "g"))];
    if (blocks.length !== 3) continue;
    blocks.forEach((block, index) => {
      const cells = [...block[1].matchAll(/<td>([^<]+)<\/td>/g)].map((match) => match[1]);
      const prices = cells.slice(1).map(Number);
      if (prices.length !== expected || !prices.every((value) => Number.isFinite(value) && value > 0 && value < 1)) return;
      const tier = tiers[index];
      const flatRate = type === "flat" ? prices[2] : prices[3];
      output.push({
        id: `totalenergies-${type}-${index}`,
        company: "TotalEnergies",
        name: `${name} (${tier.label})`,
        type,
        flatRate,
        peakRate: type === "flat" ? flatRate : prices[2],
        midRate: flatRate,
        valleyRate: type === "flat" ? flatRate : prices[4],
        powerDay: prices[0] + prices[1],
        monthlyFee: 0,
        taxMode: "preTax",
        checkedAt,
        sourceUrl: url,
        minAnnualKwh: tier.minAnnualKwh,
        maxAnnualKwh: tier.maxAnnualKwh,
        note: {
          es: `Precio público sin impuestos para ${tier.label}; depende del consumo anual.`,
          en: `Public price before tax for ${tier.label}; depends on annual usage.`,
        },
      });
    });
  }
  return output;
}

export async function getProviderOffers(env, fetcher = fetch, now = Date.now()) {
  let stored = null;
  try { stored = await env.MARKET_CACHE.get(KEY, { type: "json" }); } catch { /* Fetch the source. */ }
  const age = stored?.checkedAt ? now - Date.parse(stored.checkedAt) : Infinity;
  if (age >= 0 && age < REFRESH_MS && Array.isArray(stored.offers)) return stored;

  const urls = [OCTOPUS_URL, TOTAL_FLAT_URL, TOTAL_PERIOD_URL];
  const pages = await Promise.all(urls.map(async (url) => {
    try {
      const response = await fetcher(url, { headers: { Accept: "text/html" } });
      return response.ok ? await response.text() : "";
    } catch { return ""; }
  }));
  const checkedAt = new Date(now).toISOString();
  const octopus = parseOctopusOffers(pages[0], checkedAt);
  const total = parseTotalEnergyOffers(pages[1], pages[2], checkedAt);
  const verified = [
    ...(octopus.length === 2 ? octopus : []),
    ...(total.length === 6 ? total : []),
  ];
  const prior = age >= 0 && age < MAX_AGE_MS && Array.isArray(stored?.offers)
    ? stored.offers.filter((offer) => now - Date.parse(offer.checkedAt) < MAX_AGE_MS)
    : [];
  const offers = [...verified, ...prior.filter((offer) => !verified.some((fresh) => fresh.id === offer.id))];
  const result = { checkedAt, offers };
  try { await env.MARKET_CACHE.put(KEY, JSON.stringify(result)); } catch { /* Serve verified data now. */ }
  return result;
}
