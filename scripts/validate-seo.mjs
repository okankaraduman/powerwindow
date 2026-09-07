import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://powerwindow.energy";
const aliases = [
  ["/comparador-tarifas-luz-pvpc", "/compare"],
  ["/en/compare-pvpc-electricity-tariffs-spain", "/en/compare"],
  ["/precio-luz-por-horas", "/precio-luz-hoy"],
  ["/hora-mas-barata-luz-hoy", "/precio-luz-hoy"],
  ["/pvpc-hoy", "/precio-luz-hoy"],
  ["/cargar-coche-electrico-en-casa", "/precio-luz-coche-electrico"],
  ["/mejor-hora-poner-lavadora", "/mejor-hora-lavadora"],
  ["/comparador-tarifas-luz", "/compare"],
];

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.ok(urls.length, "sitemap.xml must contain at least one URL");
assert.equal(new Set(urls).size, urls.length, "sitemap.xml contains duplicate URLs");

for (const [alias] of aliases) {
  assert.ok(!urls.includes(`${origin}${alias}`), `${alias} must not appear in sitemap.xml`);
}

for (const url of urls) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, origin, `${url} uses an unexpected origin`);

  const relativeFile =
    parsed.pathname === "/"
      ? "index.html"
      : parsed.pathname === "/en/"
        ? "en/index.html"
        : `${parsed.pathname.slice(1)}.html`;
  const html = await readFile(path.join(root, relativeFile), "utf8");

  assert.equal((html.match(/<h1(?:\s|>)/gi) || []).length, 1, `${relativeFile} must contain one H1`);
  assert.match(html, /<title>[^<]+<\/title>/i, `${relativeFile} needs a title`);
  assert.match(
    html,
    /<meta\s+name="description"\s+content="[^"]+"\s*\/?>/i,
    `${relativeFile} needs a meta description`,
  );

  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/i)?.[1];
  assert.equal(canonical, url, `${relativeFile} canonical must match its sitemap URL`);

  for (const match of html.matchAll(
    /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    assert.doesNotThrow(() => JSON.parse(match[1]), `${relativeFile} contains invalid JSON-LD`);
  }

  const internalLinks = [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1]);
  for (const [alias] of aliases) {
    assert.ok(
      !internalLinks.some(
        (link) => link === alias || link === `${alias}.html` || link.startsWith(`${alias}/`),
      ),
      `${relativeFile} links to non-canonical alias ${alias}`,
    );
  }
}

const redirects = await readFile(path.join(root, "_redirects"), "utf8");
for (const [alias, destination] of aliases) {
  const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedDestination = destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const suffix of ["", "/", ".html"]) {
    const escapedSuffix = suffix.replace(".", "\\.");
    assert.match(
      redirects,
      new RegExp(`^${escapedAlias}${escapedSuffix} ${escapedDestination} 301$`, "m"),
      `${alias}${suffix} must redirect to ${destination}`,
    );
  }
}

const todayPage = await readFile(path.join(root, "precio-luz-hoy.html"), "utf8");
assert.match(todayPage, /<h3>¿Qué significa PVPC hoy\?<\/h3>/);

const evPage = await readFile(path.join(root, "precio-luz-coche-electrico.html"), "utf8");
assert.match(evPage, /<h3>¿Cuánto cuesta cargar un coche eléctrico en casa\?<\/h3>/);

console.log(`SEO validation passed for ${urls.length} sitemap URLs.`);
