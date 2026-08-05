import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "../trigger.dev");
const output = resolve(root, "tests/browser/fixtures/nw-220-trigger-inspector-baseline.json");
const routePath = resolve(sourceRoot, "apps/webapp/app/routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam.spans.$spanParam/route.tsx");
const codeBlockPath = resolve(sourceRoot, "apps/webapp/app/components/code/CodeBlock.tsx");
const route = readFileSync(routePath, "utf8");
const codeBlock = readFileSync(codeBlockPath, "utf8");
const normalSpan = route.slice(route.indexOf("if (!span.entity)"), route.indexOf("switch (span.entity.type)"));

requireSource(route, 'className="scrollbar-gutter-stable overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control"', "independent inspector scroll container");
requireSource(normalSpan, '<div className="flex flex-col gap-4 p-3">', "normal span content geometry");
requireSource(normalSpan, "maxLines={20}", "20-line capture limit");
requireSource(normalSpan, "showCopyButton", "copy control");
requireSource(normalSpan, "showTextWrapping", "wrapping control");
requireSource(normalSpan, "showOpenInModal", "expanded capture control");
requireSource(codeBlock, '"overflow-auto"', "independent capture overflow");
requireSource(codeBlock, "<Dialog", "focus-managed expanded capture");

const baseline = {
  generatedBy: "node scripts/extract-trigger-inspector-baseline.mjs",
  sourceCommit: execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceFiles: {
    spanRoute: sourceFile(routePath, route),
    codeBlock: sourceFile(codeBlockPath, codeBlock),
  },
  contract: {
    inspector: { overflowY: "auto", paddedContent: true },
    capture: { visibleLineLimit: 20, overflowY: "auto", copy: true, wrap: true, expand: true, focusManagedDialog: true },
  },
};
const rendered = `${JSON.stringify(baseline, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== rendered) {
    throw new Error("Trigger inspector baseline is stale. Run node scripts/extract-trigger-inspector-baseline.mjs.");
  }
} else {
  writeFileSync(output, rendered);
}

function requireSource(source, snippet, description) {
  if (!source.includes(snippet)) throw new Error(`Pinned Trigger source no longer proves ${description}.`);
}

function sourceFile(path, source) {
  return {
    path: relative(sourceRoot, path),
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}
