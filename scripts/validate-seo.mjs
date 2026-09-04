import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://powerwindow.energy";
const retiredComparators = [
  "/comparador-tarifas-luz-pvpc",
  "/en/compare-pvpc-electricity-tariffs-spain",
];

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.ok(urls.length, "sitemap.xml must contain at least one URL");
assert.equal(new Set(urls).size, urls.length, "sitemap.xml contains duplicate URLs");

for (const retired of retiredComparators) {
  assert.ok(!urls.includes(`${origin}${retired}`), `${retired} must not remain in sitemap.xml`);
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
  for (const retired of retiredComparators) {
    assert.ok(
      !internalLinks.some((link) => link === retired || link.startsWith(`${retired}/`)),
      `${relativeFile} links to retired comparator ${retired}`,
    );
  }
}

const redirects = await readFile(path.join(root, "_redirects"), "utf8");
assert.match(redirects, /^\/comparador-tarifas-luz-pvpc \/compare 301$/m);
assert.match(redirects, /^\/en\/compare-pvpc-electricity-tariffs-spain \/en\/compare 301$/m);

console.log(`SEO validation passed for ${urls.length} sitemap URLs.`);
