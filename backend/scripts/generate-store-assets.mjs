import { mkdir, writeFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const assetDir = new URL("store/assets/", root);
const screenshotDir = new URL("store/assets/screenshots/", root);

await mkdir(assetDir, { recursive: true });
await mkdir(screenshotDir, { recursive: true });

const palette = {
  bg: "#f7f8fa",
  ink: "#111418",
  muted: "#667085",
  deep: "#121817",
  accent: "#12836f",
  gold: "#f2c84b",
  line: "#dde3ea",
  red: "#d45d4c",
  blue: "#4f7fd8"
};

await writeSvg(new URL("icon-512.svg", assetDir), appIconSvg(512));
await writeSvg(new URL("feature-graphic.svg", assetDir), featureGraphicSvg());
await writeSvg(
  new URL("phone-01-planner.svg", screenshotDir),
  phoneScreenshotSvg("Find the best power window", "2 PM-4 PM", "Live REE data", [
    ["Timing grade", "A"],
    ["Estimated cost", "EUR 0.22"],
    ["Run now vs best", "Save EUR 1.64"]
  ])
);
await writeSvg(
  new URL("phone-02-ev.svg", screenshotDir),
  phoneScreenshotSvg("Plan EV charging by model", "Tesla Model 3", "Demo Wallbox ready", [
    ["Battery", "50% -> 80%"],
    ["Charger", "7.4 kW"],
    ["Plan", "Send window"]
  ])
);
await writeSvg(
  new URL("phone-03-mission.svg", screenshotDir),
  phoneScreenshotSvg("See weekly timing impact", "EUR 15-20", "Example flexible-load week", [
    ["Dishwasher", "2 runs"],
    ["Laundry", "1 load"],
    ["EV", "3-4 top-ups"]
  ])
);

async function writeSvg(url, svg) {
  await writeFile(url, svg.trimStart());
}

function appIconSvg(size) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="96" fill="${palette.deep}"/>
      <path d="M286 55 128 288h116l-25 169 169-267H276z" fill="${palette.gold}"/>
    </svg>
  `;
}

function featureGraphicSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
      <rect width="1024" height="500" fill="${palette.bg}"/>
      <rect x="56" y="56" width="912" height="388" rx="26" fill="${palette.deep}"/>
      <rect x="96" y="96" width="74" height="74" rx="18" fill="#0b100f"/>
      <path d="M138 111 113 152h19l-5 32 32-52h-20z" fill="${palette.gold}"/>
      <text x="200" y="136" fill="#ffffff" font-size="54" font-family="Inter, Arial, sans-serif" font-weight="800">Power Window</text>
      <text x="200" y="188" fill="#b9c6c0" font-size="28" font-family="Inter, Arial, sans-serif">Find the cheapest hours for flexible electricity use in Spain.</text>
      <text x="96" y="330" fill="#ffffff" font-size="94" font-family="Inter, Arial, sans-serif" font-weight="900">2 PM-4 PM</text>
      <rect x="660" y="290" width="196" height="52" rx="26" fill="#123e36" stroke="${palette.accent}" stroke-width="2"/>
      <text x="690" y="325" fill="#8af0d3" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="800">Live REE data</text>
      <text x="664" y="375" fill="#b9c6c0" font-size="26" font-family="Inter, Arial, sans-serif">Demo charger connector ready</text>
    </svg>
  `;
}

function phoneScreenshotSvg(title, main, subline, metrics) {
  const metricCards = metrics
    .map((metric, index) => {
      const y = 980 + index * 176;
      return `
        <rect x="88" y="${y}" width="904" height="134" rx="18" fill="#ffffff" stroke="${palette.line}" stroke-width="2"/>
        <text x="124" y="${y + 48}" fill="${palette.muted}" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(metric[0])}</text>
        <text x="124" y="${y + 101}" fill="${palette.ink}" font-size="46" font-family="Inter, Arial, sans-serif" font-weight="900">${escapeXml(metric[1])}</text>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <rect width="1080" height="1920" fill="${palette.bg}"/>
      <rect x="54" y="54" width="972" height="1812" rx="54" fill="#ffffff" stroke="${palette.line}" stroke-width="2"/>
      <rect x="88" y="104" width="74" height="74" rx="18" fill="${palette.deep}"/>
      <path d="M130 119 105 160h19l-5 32 32-52h-20z" fill="${palette.gold}"/>
      <text x="190" y="148" fill="${palette.ink}" font-size="40" font-family="Inter, Arial, sans-serif" font-weight="900">Power Window</text>
      <text x="190" y="188" fill="${palette.muted}" font-size="24" font-family="Inter, Arial, sans-serif">Spain electricity timing planner</text>
      <rect x="88" y="252" width="904" height="606" rx="30" fill="${palette.deep}"/>
      <text x="128" y="334" fill="#aab4b0" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(title)}</text>
      <text x="128" y="500" fill="#ffffff" font-size="116" font-family="Inter, Arial, sans-serif" font-weight="900">${escapeXml(main)}</text>
      <text x="128" y="592" fill="#c7d0cc" font-size="34" font-family="Inter, Arial, sans-serif">${escapeXml(subline)}</text>
      <rect x="128" y="684" width="254" height="60" rx="30" fill="#123e36" stroke="${palette.accent}" stroke-width="2"/>
      <text x="158" y="724" fill="#8af0d3" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">Backend cache</text>
      <rect x="418" y="684" width="248" height="60" rx="30" fill="#2b2514" stroke="${palette.gold}" stroke-width="2"/>
      <text x="448" y="724" fill="#ffe391" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">Best window</text>
      ${metricCards}
      <rect x="88" y="1546" width="904" height="188" rx="22" fill="#f6fbf9" stroke="#b9ddd4" stroke-width="2"/>
      <text x="124" y="1606" fill="${palette.accent}" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="900">Plan flexible loads</text>
      <text x="124" y="1660" fill="${palette.muted}" font-size="28" font-family="Inter, Arial, sans-serif">Dishwasher, laundry, EV charging, and demo smart-charging flow.</text>
    </svg>
  `;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return map[char];
  });
}
