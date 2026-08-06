import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "../trigger.dev");
const output = resolve(root, "tests/browser/fixtures/nw-224-trigger-errors-baseline.json");
const paths = {
  listRoute: resolve(sourceRoot, "apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route.tsx"),
  detailRoute: resolve(sourceRoot, "apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx"),
  bugIcon: resolve(sourceRoot, "apps/webapp/app/assets/icons/BugIcon.tsx"),
  listPagination: resolve(sourceRoot, "apps/webapp/app/components/ListPagination.tsx"),
  table: resolve(sourceRoot, "apps/webapp/app/components/primitives/Table.tsx"),
  resizable: resolve(sourceRoot, "apps/webapp/app/components/primitives/Resizable.tsx"),
};
const source = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readFileSync(path, "utf8")]));

for (const snippet of ["<NavBar>", '<PageBody scrollable={false}>', "<FiltersBar", "<ErrorsList", "<ListPagination", "<Table", "<TableHeaderCell", "<TableCell"]) {
  requireSource(source.listRoute, snippet, `list composition ${snippet}`);
}
for (const snippet of ["<ResizablePanelGroup", '<ResizablePanel id="error-main"', '<ResizablePanel id="error-detail"', "<ErrorDetailSidebar", "<TaskRunsTable", "<ListPagination", "<TimeFilter"]) {
  requireSource(source.detailRoute, snippet, `detail composition ${snippet}`);
}
for (const snippet of ["ErrorStatusMenuItems", "CustomIgnoreDialog", "canCancelRuns", "canReplayRuns", "v3CreateBulkActionPath"]) {
  requireSource(source.listRoute + source.detailRoute, snippet, `unsupported mutation control ${snippet}`);
}
for (const snippet of ["<table", "<thead", "<tbody", "isTabbableCell ? 0 : -1"]) {
  requireSource(source.table, snippet, `table accessibility ${snippet}`);
}
for (const snippet of ["<PanelGroup", "<Panel", "<PanelResizer", 'size="3px"']) {
  requireSource(source.resizable, snippet, `resizable geometry ${snippet}`);
}

const baseline = {
  generatedBy: "node scripts/extract-trigger-errors-baseline.mjs",
  sourceCommit: execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceFiles: Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, sourceFile(path, source[name])])),
  contract: {
    list: { filters: true, table: true, pagination: true, loading: true, empty: true, error: true },
    detail: { activity: true, failedAttempts: true, pagination: true, resizableSidebar: true, exceptionEvidence: true },
    navigation: { errorGroup: true, jobType: true, run: true, attempt: true },
    url: { jobType: true, exceptionClass: true, period: true, cursor: true },
    actions: { upstreamMutationControls: true, skylineMutationControls: false },
    accessibility: { semanticTable: true, upstreamRowLinksTabbable: false },
  },
};
const rendered = `${JSON.stringify(baseline, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== rendered) throw new Error("Trigger Errors baseline is stale. Run node scripts/extract-trigger-errors-baseline.mjs.");
} else {
  writeFileSync(output, rendered);
}

function requireSource(value, snippet, description) {
  if (!value.includes(snippet)) throw new Error(`Pinned Trigger source no longer proves ${description}.`);
}

function sourceFile(path, value) {
  return { path: relative(sourceRoot, path), sha256: createHash("sha256").update(value).digest("hex") };
}
