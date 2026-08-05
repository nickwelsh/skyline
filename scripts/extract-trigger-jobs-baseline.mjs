import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "../trigger.dev");
const output = resolve(root, "tests/browser/fixtures/nw-219-trigger-jobs-baseline.json");
const paths = {
  listRoute: resolve(sourceRoot, "apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route.tsx"),
  detailRoute: resolve(sourceRoot, "apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route.tsx"),
  searchInput: resolve(sourceRoot, "apps/webapp/app/components/primitives/SearchInput.tsx"),
  pageHeader: resolve(sourceRoot, "apps/webapp/app/components/primitives/PageHeader.tsx"),
};
const sources = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readFileSync(path, "utf8")]));

requireSource(sources.listRoute, '<PageBody scrollable={false}>', "fixed-height list body");
requireSource(sources.listRoute, '<SearchInput placeholder="Search tasks…" resetParams={["page"]} />', "URL-backed search");
requireSource(sources.listRoute, '<TableHeaderCell>Activity (24h)</TableHeaderCell>', "status activity column");
requireSource(sources.detailRoute, '<ResizablePanel id="task-main" min="300px">', "detail main minimum");
requireSource(sources.detailRoute, '<ResizablePanel id="task-activity" min="220px" default="320px">', "activity geometry");
requireSource(sources.detailRoute, '<ResizablePanel id="task-content" min="160px">', "Runs panel minimum");
requireSource(sources.detailRoute, '<ResizablePanel id="task-detail" min="280px" default="380px" max="500px" isStaticAtRest>', "sidebar geometry");
requireSource(sources.detailRoute, '<ListPagination list={list} />', "cursor pagination");
requireSource(sources.searchInput, 'if (e.key === "Enter")', "search submit keyboard behavior");
requireSource(sources.searchInput, 'if (e.key === "Escape")', "search clear and blur keyboard behavior");
requireSource(sources.searchInput, 'className="relative h-6 min-w-52"', "search geometry");
requireSource(sources.pageHeader, 'className="grid h-10 w-full grid-rows-[auto_1px] bg-background-bright"', "header geometry");

const baseline = {
  generatedBy: "node scripts/extract-trigger-jobs-baseline.mjs",
  sourceCommit: execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceFiles: Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, sourceFile(path, sources[key])])),
  viewport: { width: 1440, height: 960 },
  contract: {
    list: { navHeight: 40, filterHeight: 48, searchMinWidth: 208 },
    detail: { mainMinWidth: 300, activityDefaultHeight: 320, runsMinHeight: 160, sidebarDefaultWidth: 380 },
    interaction: { searchSubmitKey: "Enter", searchClearKey: "Escape", favoriteKey: "Alt+F" },
  },
};
const rendered = `${JSON.stringify(baseline, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== rendered) throw new Error("Trigger Jobs baseline is stale. Run node scripts/extract-trigger-jobs-baseline.mjs.");
} else {
  writeFileSync(output, rendered);
}

function requireSource(source, snippet, description) {
  if (!source.includes(snippet)) throw new Error(`Pinned Trigger source no longer proves ${description}.`);
}

function sourceFile(path, source) {
  return { path: relative(sourceRoot, path), sha256: createHash("sha256").update(source).digest("hex") };
}
