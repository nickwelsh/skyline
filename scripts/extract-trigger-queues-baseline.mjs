import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "../trigger.dev");
const output = resolve(root, "tests/browser/fixtures/nw-221-trigger-queues-baseline.json");
const paths = {
  listRoute: resolve(sourceRoot, "apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx"),
  detailRoute: resolve(sourceRoot, "apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route.tsx"),
  metricsLayout: resolve(sourceRoot, "apps/webapp/app/components/layout/MetricsLayout.tsx"),
  table: resolve(sourceRoot, "apps/webapp/app/components/primitives/Table.tsx"),
  searchInput: resolve(sourceRoot, "apps/webapp/app/components/primitives/SearchInput.tsx"),
  queueMetricCards: resolve(sourceRoot, "apps/webapp/app/components/queues/QueueMetricCards.tsx"),
};
const source = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readFileSync(path, "utf8")]));

for (const snippet of ["<MetricsLayout.Root>", "<MetricsLayout.Filters", "<MetricsLayout.Grid>", '<MetricsLayout.Grid kind="charts">', "<MetricsLayout.Content>", "<TimeFilter", "<PaginationControls", "<Table", "<TableCell"]) {
  requireSource(source.listRoute, snippet, `list composition ${snippet}`);
}
for (const snippet of ['case "environment-pause"', "<QueuePauseResumeButton", "<TableCell to={queueDetailPath}"]) {
  requireSource(source.listRoute, snippet, `upstream action or navigation ${snippet}`);
}
for (const snippet of ["<MetricsLayout.Root>", "<MetricsLayout.Filters", "<MetricsLayout.Content inset>", "<QueueDetailChartCard", "<TimeFilter", "<PaginationControls", "<Table"]) {
  requireSource(source.detailRoute, snippet, `detail composition ${snippet}`);
}
for (const snippet of ["grid-cols-1", "sm:grid-cols-2", "border-grid-dimmed"]) {
  requireSource(source.metricsLayout, snippet, `layout treatment ${snippet}`);
}
for (const snippet of ["<ChartCard", "QueueMetricChartCard", "<QueueMetricChart", "<MiniLineChart"]) {
  requireSource(source.queueMetricCards, snippet, `chart treatment ${snippet}`);
}
for (const snippet of ["<table", "<thead", "<tbody", "isTabbableCell ? 0 : -1"]) {
  requireSource(source.table, snippet, `table accessibility ${snippet}`);
}
for (const snippet of ['e.key === "Enter"', 'e.key === "Escape"', "handleSubmit()", "handleClear()", "e.currentTarget.blur()"]) {
  requireSource(source.searchInput, snippet, `search keyboard behavior ${snippet}`);
}

const baseline = {
  generatedBy: "node scripts/extract-trigger-queues-baseline.mjs",
  sourceCommit: execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceFiles: Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, sourceFile(path, source[name])])),
  contract: {
    list: { filters: true, statGrid: true, chartGrid: true, content: true, table: true, pagination: true },
    detail: { filters: true, insetCharts: true, content: true, table: true, pagination: true },
    layout: { responsiveColumns: true, roundedCards: true, gridBorders: true },
    actions: { upstreamAdministrativeQueueControls: true, skylineAdministrativeQueueControls: false, observedRunLinks: true },
    url: { timeFilter: true, pagination: true },
    keyboard: { searchSubmit: "Enter", searchClear: "Escape", emptySearchEscape: "blur" },
    accessibility: { semanticTable: true, tabbableDetailLink: true },
  },
};
const rendered = `${JSON.stringify(baseline, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== rendered) throw new Error("Trigger Queue baseline is stale. Run node scripts/extract-trigger-queues-baseline.mjs.");
} else {
  writeFileSync(output, rendered);
}

function requireSource(value, snippet, description) {
  if (!value.includes(snippet)) throw new Error(`Pinned Trigger source no longer proves ${description}.`);
}

function sourceFile(path, value) {
  return { path: relative(sourceRoot, path), sha256: createHash("sha256").update(value).digest("hex") };
}
