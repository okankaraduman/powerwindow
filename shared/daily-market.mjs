const MADRID_TIME_ZONE = "Europe/Madrid";

export function parseMarketData(data) {
  const included = Array.isArray(data?.included) ? data.included : [];
  const pvpc = findSeries(included, ["PVPC"]);
  const spot = findSeries(included, ["Spot market price", "spot"]);
  const series = hasValues(pvpc) ? pvpc : spot;
  if (!series?.attributes?.values?.length) return [];

  const hourly = new Map();
  series.attributes.values.forEach((item) => {
    const hour = Number(String(item.datetime || "").match(/T(\d{2}):/)?.[1]);
    const value = Number(item.value);
    if (!Number.isFinite(hour) || !Number.isFinite(value)) return;

    const current = hourly.get(hour) || { total: 0, count: 0, datetime: item.datetime };
    current.total += value;
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
    };
  }).filter(Boolean);
}

export function dailyStats(points) {
  if (!points.length) return null;

  const prices = points.map((point) => point.price);
  const min = points.reduce((best, point) => (point.price < best.price ? point : best), points[0]);
  const max = points.reduce((worst, point) => (point.price > worst.price ? point : worst), points[0]);
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const spreadPercent = max.price > 0 ? ((max.price - min.price) / max.price) * 100 : 0;
  const updatedAt = points.reduce((latest, point) => {
    const value = new Date(point.datetime).getTime();
    return Number.isFinite(value) && value > latest ? value : latest;
  }, 0);

  return {
    min,
    max,
    average,
    spreadPercent,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : "",
  };
}

export function bestWindow(points, duration, kw) {
  if (!points.length || duration < 1 || duration > points.length) return null;

  const maxStart = points.length - duration;
  let best = null;
  for (let start = 0; start <= maxStart; start += 1) {
    const slice = points.slice(start, start + duration);
    const avgPrice = slice.reduce((sum, point) => sum + point.price, 0) / slice.length;
    const cost = slice.reduce((sum, point) => sum + (point.price / 1000) * kw, 0);
    const item = { start, duration, avgPrice, cost };
    if (!best || item.avgPrice < best.avgPrice) best = item;
  }
  return best;
}

export function madridDate(offset = 0, now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const target = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offset, 12),
  );
  return [
    target.getUTCFullYear(),
    String(target.getUTCMonth() + 1).padStart(2, "0"),
    String(target.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDateHuman(value, lang, includeWeekday = true) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "es-ES", {
    ...(includeWeekday ? { weekday: "long" } : {}),
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: MADRID_TIME_ZONE,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatHourRange(start, duration, lang) {
  const end = start + duration;
  return `${formatHour(start, lang, false)}–${formatHour(end, lang, true)}`;
}

export function formatPrice(value, lang) {
  return `${new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format((value || 0) / 1000)} €/kWh`;
}

export function formatMoney(value, lang) {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function findSeries(series, names) {
  const normalized = names.map((name) => name.toLowerCase());
  return series.find((item) => {
    const title = String(item?.attributes?.title || item?.type || "").toLowerCase();
    return normalized.some((name) => title.includes(name));
  });
}

function hasValues(series) {
  return Array.isArray(series?.attributes?.values) && series.attributes.values.length > 0;
}

function formatHour(hour, lang, isRangeEnd) {
  if (lang !== "en") {
    if (hour === 24 && isRangeEnd) return "24:00";
    return `${String(((hour % 24) + 24) % 24).padStart(2, "0")}:00`;
  }

  const normalized = ((hour % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  return `${normalized % 12 || 12} ${suffix}`;
}
