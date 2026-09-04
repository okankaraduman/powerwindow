const DAILY_URLS = Object.freeze([
  "https://powerwindow.energy/precio-luz-hoy",
  "https://powerwindow.energy/en/electricity-price-spain-today",
  "https://powerwindow.energy/precio-luz-manana",
  "https://powerwindow.energy/en/electricity-price-spain-tomorrow",
]);

export function updateDailyLastmod(xml, dateValue) {
  return DAILY_URLS.reduce((updated, url) => {
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(<loc>${escapedUrl}</loc>\\s*<lastmod>)[^<]+`);
    return updated.replace(pattern, `$1${dateValue}`);
  }, xml);
}
