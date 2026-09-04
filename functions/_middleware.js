import {
  bestWindow,
  dailyStats,
  formatDateHuman,
  formatHourRange,
  formatMoney,
  formatPrice,
  madridDate,
  parseMarketData,
} from "../shared/daily-market.mjs";
import { updateDailyLastmod } from "../shared/sitemap.mjs";

const API_BASE = "https://api.powerwindow.energy/api";
const MINIMUM_HOURLY_POINTS = 12;
const ROUTES = Object.freeze({
  "/precio-luz-hoy": dailyRoute("es", 0, "hoy", "today"),
  "/precio-luz-manana": dailyRoute("es", 1, "mañana", "tomorrow"),
  "/en/electricity-price-spain-today": dailyRoute("en", 0, "today", "today"),
  "/en/electricity-price-spain-tomorrow": dailyRoute("en", 1, "tomorrow", "tomorrow"),
});

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (context.request.method === "GET" && url.pathname === "/sitemap.xml") {
    return renderSitemap(context);
  }

  const config = ROUTES[canonicalPath(url.pathname)];
  if (context.request.method !== "GET" || !config) return context.next();

  const assetResponse = await context.next();
  if (!isHtmlResponse(assetResponse)) return assetResponse;

  const dateValue = madridDate(config.dayOffset);
  const dateLabel = formatDateHuman(dateValue, config.lang);
  let marketData = null;

  try {
    marketData = await fetchMarketData(context, dateValue, config.dayOffset);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "daily SEO server render fell back to static content",
        path: url.pathname,
        date: dateValue,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  const view = buildView(config, dateValue, dateLabel, marketData);
  const transformed = rewriteDailyPage(assetResponse, view);
  const headers = new Headers(transformed.headers);
  headers.delete("Content-Length");
  headers.delete("ETag");
  headers.set("Cache-Control", `public, max-age=300, s-maxage=${config.dayOffset ? 900 : 1800}`);
  headers.set("X-Power-Window-Render", view.stats ? "daily-data" : "daily-fallback");

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}

async function renderSitemap(context) {
  const assetResponse = await context.next();
  if (!assetResponse.ok) return assetResponse;

  const xml = updateDailyLastmod(await assetResponse.text(), madridDate());
  const headers = new Headers(assetResponse.headers);
  headers.delete("Content-Length");
  headers.delete("ETag");
  headers.set("Cache-Control", "public, max-age=900, s-maxage=3600");
  headers.set("Content-Type", "application/xml; charset=utf-8");

  return new Response(xml, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

function dailyRoute(lang, dayOffset, dayName, canonicalDay) {
  const isEnglish = lang === "en";
  const path = isEnglish
    ? `/en/electricity-price-spain-${canonicalDay}`
    : dayOffset
      ? "/precio-luz-manana"
      : "/precio-luz-hoy";
  return Object.freeze({
    lang,
    dayOffset,
    dayName,
    path,
    canonical: `https://powerwindow.energy${path}`,
  });
}

function canonicalPath(pathname) {
  let path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (path.endsWith(".html")) path = path.slice(0, -5);
  return path;
}

function isHtmlResponse(response) {
  return response.ok && (response.headers.get("content-type") || "").includes("text/html");
}

async function fetchMarketData(context, dateValue, dayOffset) {
  const apiUrl = new URL(`${API_BASE}/market`);
  apiUrl.searchParams.set("date", dateValue);
  const init = {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(2500),
  };
  const service = context.env.POWER_WINDOW_API;
  const response = service?.fetch
    ? await service.fetch(new Request(apiUrl, init))
    : await fetch(apiUrl, {
        ...init,
        cf: { cacheEverything: true, cacheTtl: dayOffset ? 900 : 1800 },
      });

  if (!response.ok) throw new Error(`market API returned ${response.status}`);
  const data = await response.json();
  const points = parseMarketData(data?.payload);
  if (points.length < MINIMUM_HOURLY_POINTS) throw new Error("market API returned incomplete hourly data");
  return { points, cachedAt: data.cachedAt || "" };
}

function buildView(config, dateValue, dateLabel, marketData) {
  const pageName = pageNameFor(config, dateValue);
  const view = {
    ...config,
    dateValue,
    dateLabel,
    pageName,
    title: `${pageName} | Power Window`,
    description: descriptionFor(config, dateLabel),
    stats: null,
  };
  if (!marketData) return view;

  const stats = dailyStats(marketData.points);
  const dishwasher = bestWindow(marketData.points, 2, 0.8);
  const ev = bestWindow(marketData.points, 3, 7.4);
  const ac = bestWindow(marketData.points, 4, 1.2);
  if (!stats || !dishwasher || !ev || !ac) return view;

  return {
    ...view,
    points: marketData.points,
    stats,
    dishwasher,
    ev,
    ac,
    modifiedAt: marketData.cachedAt || stats.updatedAt,
    description: dataDescriptionFor(config, dateLabel, stats),
    summary: summaryFor(config, stats, ev, dishwasher),
  };
}

function pageNameFor(config, dateValue) {
  const date = formatDateHuman(dateValue, config.lang, false);
  if (config.lang === "en") {
    return `Electricity price in Spain ${config.dayName}, ${date}`;
  }
  return `Precio de la luz ${config.dayName}, ${date}`;
}

function descriptionFor(config, dateLabel) {
  if (config.lang === "en") {
    return `Check the hourly PVPC electricity price in Spain for ${dateLabel}, including the cheapest hour, the most expensive hour, and flexible-load examples.`;
  }
  return `Consulta el precio PVPC por horas en España para ${dateLabel}, con la hora más barata, la más cara y ejemplos para consumos flexibles.`;
}

function dataDescriptionFor(config, dateLabel, stats) {
  const cheapest = formatHourRange(stats.min.hour, 1, config.lang);
  const price = formatPrice(stats.min.price, config.lang);
  if (config.lang === "en") {
    return `Spain PVPC for ${dateLabel}: cheapest hour ${cheapest} at ${price}. See all 24 prices and the best windows for EVs and appliances.`;
  }
  return `PVPC del ${dateLabel}: hora más barata ${cheapest} a ${price}. Consulta las 24 horas y ventanas para coche y electrodomésticos.`;
}

function summaryFor(config, stats, ev, dishwasher) {
  const cheapest = formatHourRange(stats.min.hour, 1, config.lang);
  const expensive = formatHourRange(stats.max.hour, 1, config.lang);
  if (config.lang === "en") {
    return `For ${config.dayName}, the lowest PVPC hour is ${cheapest} at ${formatPrice(stats.min.price, "en")}. The highest hour is ${expensive} at ${formatPrice(stats.max.price, "en")}. A 3-hour 7.4 kW EV charge is estimated at ${formatMoney(ev.cost, "en")} in the best window, while a 2-hour dishwasher run is estimated at ${formatMoney(dishwasher.cost, "en")}.`;
  }
  return `Para ${config.dayName}, la hora PVPC más barata es ${cheapest} a ${formatPrice(stats.min.price, "es")}. La hora más cara es ${expensive} a ${formatPrice(stats.max.price, "es")}. Una carga de coche eléctrico de 3 horas a 7,4 kW se estima en ${formatMoney(ev.cost, "es")} en la mejor ventana, y un lavavajillas de 2 horas se estima en ${formatMoney(dishwasher.cost, "es")}.`;
}

function rewriteDailyPage(response, view) {
  const rewriter = new HTMLRewriter()
    .on("title", textHandler(view.title))
    .on('meta[name="description"]', attributeHandler("content", view.description))
    .on('meta[property="og:title"]', attributeHandler("content", view.pageName))
    .on('meta[property="og:description"]', attributeHandler("content", view.description))
    .on('meta[name="twitter:title"]', attributeHandler("content", view.pageName))
    .on('meta[name="twitter:description"]', attributeHandler("content", view.description))
    .on("body[data-daily-seo]", attributeHandler("data-server-rendered", view.stats ? "true" : "false"))
    .on("h1", textHandler(view.pageName))
    .on("#seoDateLabel", textHandler(view.dateLabel))
    .on(
      'script[type="application/ld+json"]',
      new StructuredDataHandler({
        pageName: view.pageName,
        description: view.description,
        modifiedAt: view.modifiedAt,
      })
    );

  if (!view.stats) {
    return rewriter
      .on("#seoStatus", textHandler(view.lang === "en" ? "Awaiting PVPC data" : "Esperando datos PVPC"))
      .on(
        "#seoUpdatedAt",
        textHandler(view.lang === "en" ? "Data will appear after publication" : "Los datos aparecerán tras su publicación")
      )
      .transform(response);
  }

  return rewriter
    .on("#seoStatus", textHandler(view.lang === "en" ? "Live PVPC data" : "Datos PVPC en directo"))
    .on("#seoUpdatedAt", textHandler(updatedLabel(view)))
    .on("#seoCheapestHour", textHandler(formatHourRange(view.stats.min.hour, 1, view.lang)))
    .on("#seoMinPrice", textHandler(formatPrice(view.stats.min.price, view.lang)))
    .on("#seoAveragePrice", textHandler(formatPrice(view.stats.average, view.lang)))
    .on("#seoMaxPrice", textHandler(formatPrice(view.stats.max.price, view.lang)))
    .on("#seoSpread", textHandler(`${Math.round(view.stats.spreadPercent)}%`))
    .on("#seoCheapestWindow", textHandler(formatHourRange(view.dishwasher.start, 2, view.lang)))
    .on("#seoEvCost", textHandler(formatMoney(view.ev.cost, view.lang)))
    .on("#seoDishwasherCost", textHandler(formatMoney(view.dishwasher.cost, view.lang)))
    .on("#seoAcWindow", textHandler(formatHourRange(view.ac.start, 4, view.lang)))
    .on("#seoSummary", textHandler(view.summary))
    .on("#seoHourlyList", htmlHandler(hourlyRows(view.points, view.stats, view.lang)))
    .transform(response);
}

function updatedLabel(view) {
  if (!view.modifiedAt) return view.lang === "en" ? "Updated from REE data" : "Actualizado con datos de REE";
  const timestamp = new Date(view.modifiedAt);
  if (Number.isNaN(timestamp.getTime())) return view.lang === "en" ? "Updated from REE data" : "Actualizado con datos de REE";
  const value = new Intl.DateTimeFormat(view.lang === "en" ? "en-GB" : "es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(timestamp);
  return view.lang === "en" ? `Updated ${value}` : `Actualizado ${value}`;
}

function hourlyRows(points, stats, lang) {
  const lowLimit = stats.min.price + (stats.max.price - stats.min.price) * 0.25;
  const highLimit = stats.min.price + (stats.max.price - stats.min.price) * 0.75;
  return points
    .map((point) => {
      const tone = point.price <= lowLimit ? "low" : point.price >= highLimit ? "high" : "mid";
      return `<li class="daily-hour daily-hour--${tone}"><span>${formatHourRange(point.hour, 1, lang)}</span><strong>${formatPrice(point.price, lang)}</strong></li>`;
    })
    .join("");
}

function textHandler(value) {
  return { element(element) { element.setInnerContent(value); } };
}

function htmlHandler(value) {
  return { element(element) { element.setInnerContent(value, { html: true }); } };
}

function attributeHandler(name, value) {
  return { element(element) { element.setAttribute(name, value); } };
}

class StructuredDataHandler {
  constructor(updates) {
    this.updates = updates;
    this.buffer = "";
  }

  text(chunk) {
    this.buffer += chunk.text;
    if (!chunk.lastInTextNode) {
      chunk.remove();
      return;
    }

    try {
      const data = JSON.parse(this.buffer);
      const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [];
      const webpage = graph.find((item) => item?.["@type"] === "WebPage");
      if (webpage) {
        webpage.name = this.updates.pageName;
        webpage.description = this.updates.description;
        if (this.updates.modifiedAt) webpage.dateModified = this.updates.modifiedAt;
      }
      chunk.replace(JSON.stringify(data));
    } catch {
      chunk.replace(this.buffer);
    }
  }
}
