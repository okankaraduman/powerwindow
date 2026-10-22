export function summarizeInstalledCapacity(payload) {
  const series = (Array.isArray(payload?.included) ? payload.included : [])
    .map((item) => item.attributes || {})
    .filter((item) => Array.isArray(item.values) && item.values.length);
  const dates = [...new Set(series.flatMap((item) => item.values.map((point) =>
    String(point.datetime || "").slice(0, 10))))].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  for (const date of dates.reverse()) {
    const technologies = [];
    let reportedTotal = null;
    for (const item of series) {
      const point = item.values.find((value) => String(value.datetime).startsWith(date));
      const mw = point?.value == null ? NaN : Number(point.value);
      if (!Number.isFinite(mw) || mw < 0) continue;
      const name = String(item.title || item.type || "").trim();
      if (!name) continue;
      if (/^total(?:\s|$)/i.test(name) || item.type === "total") {
        if (/^total$/i.test(name) || /^total (?:installed )?capacity$/i.test(name)) reportedTotal = mw;
      } else technologies.push({ name, mw });
    }
    const sum = technologies.reduce((total, item) => total + item.mw, 0);
    const totalMw = reportedTotal ?? sum;
    if (technologies.length && totalMw > 0 &&
        (!reportedTotal || Math.abs(sum - reportedTotal) / reportedTotal < 0.02)) {
      return { date, totalMw, technologies: technologies.sort((a, b) => b.mw - a.mw) };
    }
  }
  return null;
}
