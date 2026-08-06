import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = process.env.SKYLINE_DIST ? resolve(process.env.SKYLINE_DIST) : join(root, "dist");
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
const entry = manifest["resources/js/app.tsx"];
const assets = new Set(Object.values(manifest).flatMap((item) => [item.file, ...(item.css ?? []), ...(item.assets ?? [])]));
const contentTypes = { ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2" };

const bootstrap = JSON.stringify({
  basePath: "/skyline",
  applicationName: "Fixture Laravel",
  environmentLabel: "testing",
  capabilities: {
    navigation: { jobs: true, runs: true, errors: true, logs: true, queues: true, query: false, dashboards: false },
    runs: { view: true, cancel: false, replay: false, bulkCancel: false, bulkReplay: false },
    jobs: { view: true, testJob: false, configure: false, schedule: false },
    errors: { view: true, assign: false, ignore: false, resolve: false, alerts: false, replay: false, cancel: false, versions: false, bulkActions: false },
    shell: { appearance: true, sidebarCustomization: true, favorites: true, panelPersistence: true, shortcuts: true, account: false, notifications: false, jobGuidance: false, organizationSwitching: false, projectSwitching: false, environmentSwitching: false, accountOpening: false },
    help: { menu: true, shortcuts: true, askAi: false, documentation: false, status: false, suggestFeature: false, contact: false, changelog: false },
  },
}).replaceAll("<", "\\u003c");

const prepaint = `<script data-skyline-prepaint>(()=>{const f={theme:"classic",contrast:50};try{const p=JSON.parse(localStorage.getItem("skyline.ui-preferences.v1:/skyline")||"null")||f;const t=["classic","system","dark","light"].includes(p.theme)?p.theme:f.theme;document.documentElement.dataset.theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;const c=Number.isInteger(p.contrast)&&p.contrast>=0&&p.contrast<=100?p.contrast:f.contrast;document.documentElement.style.setProperty("--theme-contrast",String(c/100))}catch{document.documentElement.dataset.theme=f.theme}})()</script>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skyline</title>${prepaint}${entry.css.map((file) => `<link rel="stylesheet" href="/skyline/assets/${file}">`).join("")}</head><body><div id="skyline"></div><script id="skyline-bootstrap" type="application/json">${bootstrap}</script><script type="module" src="/skyline/assets/${entry.file}"></script></body></html>`;

createServer((request, response) => {
  const asset = new URL(request.url ?? "/", "http://127.0.0.1").pathname.match(/^\/skyline\/assets\/([^/]+)$/)?.[1];
  if (asset && assets.has(asset)) {
    response.writeHead(200, { "Content-Type": contentTypes[extname(asset)] ?? "application/octet-stream" });
    response.end(readFileSync(join(dist, asset)));
    return;
  }
  if ((request.url ?? "").startsWith("/skyline")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
    response.end(html);
    return;
  }
  response.writeHead(404).end();
}).listen(4174, "127.0.0.1");
