export function annualGenerationRange(date = new Date()) {
  const currentYear = Number(new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Madrid", year: "numeric"
  }).format(date));
  const endDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
  return { startYear: currentYear - 5, endYear: currentYear, endDate };
}

export function summarizeAnnualGeneration(payload, { startYear, endYear }) {
  const series = (Array.isArray(payload?.included) ? payload.included : [])
    .map((item) => item.attributes || {})
    .filter((item) => ["Renovable", "No-Renovable", "total"].includes(item.type));

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = startYear + index;
    const sums = { Renovable: 0, "No-Renovable": 0, total: 0 };
    const seen = new Set();
    let complete = true;
    for (const item of series) {
      const points = (Array.isArray(item.values) ? item.values : [])
        .filter((point) => String(point.datetime).startsWith(`${year}-`));
      // Annual REE data has one value per technology per year. Missing is not zero.
      if (points.length !== 1 || points[0].value == null ||
          !Number.isFinite(Number(points[0].value))) {
        complete = false;
        continue;
      }
      sums[item.type] += Number(points[0].value);
      seen.add(item.type);
    }
    const renewableMwh = sums.Renovable;
    const nonRenewableMwh = sums["No-Renovable"];
    const totalMwh = renewableMwh + nonRenewableMwh;
    const available = complete && seen.has("Renovable") && seen.has("No-Renovable") &&
      renewableMwh >= 0 && nonRenewableMwh >= 0 && totalMwh > 0 &&
      (!seen.has("total") || Math.abs(totalMwh - sums.total) < 1);
    return available
      ? { year, available, renewableMwh, nonRenewableMwh, totalMwh,
          renewableShare: renewableMwh / totalMwh, nonRenewableShare: nonRenewableMwh / totalMwh }
      : { year, available: false };
  });
}

export function annualGenerationPeriods({ startYear, endYear, endDate }) {
  // REE accepts at most five calendar years in a single annual request.
  return [
    { startDate: `${startYear}-01-01`, endDate: `${endYear - 1}-12-31` },
    { startDate: `${endYear}-01-01`, endDate }
  ];
}

export function annualForecastPeriods({ endYear, endDate }) {
  const [, month, day] = endDate.split("-").map(Number);
  return Array.from({ length: 3 }, (_, index) => {
    const year = endYear - index - 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { year, startDate: `${year}-01-01`,
      endDate: `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}` };
  });
}

export function forecastAnnualGeneration(years, historicalYtd, endYear) {
  const current = years.find((year) => year.year === endYear);
  if (!current?.available) return null;
  const comparable = historicalYtd.filter((partial) => {
    const full = years.find((year) => year.year === partial.year);
    return full?.available && partial.available &&
      partial.renewableMwh > 0 && partial.nonRenewableMwh > 0 &&
      partial.renewableMwh <= full.renewableMwh && partial.nonRenewableMwh <= full.nonRenewableMwh;
  });
  if (comparable.length < 2) return null;
  const median = (values) => {
    const sorted = values.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const project = (key) => {
    const fractions = comparable.map((partial) => {
      const full = years.find((year) => year.year === partial.year);
      return partial[key] / full[key];
    });
    const fraction = median(fractions);
    return fraction > 0 ? current[key] / fraction : NaN;
  };
  const renewableMwh = project("renewableMwh");
  const nonRenewableMwh = project("nonRenewableMwh");
  if (![renewableMwh, nonRenewableMwh].every(Number.isFinite)) return null;
  const totalMwh = renewableMwh + nonRenewableMwh;
  return { year: endYear, renewableMwh, nonRenewableMwh, totalMwh,
    renewableShare: renewableMwh / totalMwh, nonRenewableShare: nonRenewableMwh / totalMwh,
    referenceYears: comparable.map((year) => year.year) };
}

export function mergeAnnualGenerationPayloads(payloads) {
  const series = new Map();
  for (const payload of payloads) {
    for (const item of payload?.included || []) {
      const key = `${item.attributes?.type}:${item.attributes?.title}`;
      const previous = series.get(key);
      if (previous) previous.attributes.values.push(...(item.attributes?.values || []));
      else series.set(key, { ...item, attributes: {
        ...item.attributes, values: [...(item.attributes?.values || [])]
      } });
    }
  }
  return { included: [...series.values()] };
}

export function formatGenerationKwh(valueMwh, locale) {
  if (!Number.isFinite(valueMwh)) return "--";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(valueMwh * 1000)} kWh`;
}
