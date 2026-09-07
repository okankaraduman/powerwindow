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
