import { Container, getContainer } from "@cloudflare/containers";

export class PowerWindowAPI extends Container {
  defaultPort = 8080;
  sleepAfter = "20m";
  envVars = {
    PORT: "8080",
    CACHE_PATH: "/app/data/market-cache.json",
    ALLOWED_ORIGINS: "https://powerwindow.energy,https://www.powerwindow.energy",
    TIMEZONE: "Europe/Madrid"
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    if (url.pathname === "/healthz" || url.pathname.startsWith("/api/")) {
      const container = getContainer(env.POWER_WINDOW_API, "market-cache");
      const response = await container.fetch(request);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders(request))) {
        headers.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const allowed = new Set(["https://powerwindow.energy", "https://www.powerwindow.energy"]);

  return {
    "Access-Control-Allow-Origin": allowed.has(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
