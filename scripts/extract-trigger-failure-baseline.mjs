import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "../trigger.dev");
const output = resolve(root, "tests/browser/fixtures/nw-222-trigger-failure-baseline.json");
const routePath = resolve(sourceRoot, "apps/webapp/app/routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam.spans.$spanParam/route.tsx");
const codeBlockPath = resolve(sourceRoot, "apps/webapp/app/components/code/CodeBlock.tsx");
const dialogPath = resolve(sourceRoot, "apps/webapp/app/components/primitives/Dialog.tsx");
const copyPath = resolve(sourceRoot, "apps/webapp/app/components/primitives/CopyTextLink.tsx");
const route = readFileSync(routePath, "utf8");
const codeBlock = readFileSync(codeBlockPath, "utf8");
const dialog = readFileSync(dialogPath, "utf8");
const copy = readFileSync(copyPath, "utf8");
const runError = route.slice(route.indexOf("function RunError"), route.indexOf("function SpanEntity"));

requireSource(runError, 'className="flex flex-col gap-2 rounded-sm border border-rose-500/50 px-3 pb-3 pt-2"', "failure container");
requireSource(runError, '<Header3 className="text-rose-500">{name}</Header3>', "failure heading");
requireSource(runError, '<Callout variant="error">', "failure message callout");
requireSource(runError, "maxLines={20}", "20-line stack viewport");
requireSource(codeBlock, "showCopyButton = true", "copy default");
requireSource(codeBlock, "showOpenInModal = true", "expanded-dialog default");
requireSource(codeBlock, "showTextWrapping", "wrapping control");
requireSource(dialog, "DialogPrimitive.Content", "focus-managed dialog content");
requireSource(copy, 'copied ? "Copied" : "Copy"', "copy feedback");

const baseline = {
  generatedBy: "node scripts/extract-trigger-failure-baseline.mjs",
  sourceCommit: execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceFiles: {
    spanRoute: sourceFile(routePath, route),
    codeBlock: sourceFile(codeBlockPath, codeBlock),
    dialog: sourceFile(dialogPath, dialog),
    copyTextLink: sourceFile(copyPath, copy),
  },
  reference: {
    viewport: { width: 520, height: 900 },
    exception: {
      class: "Illuminate\\Database\\DeadlockException",
      message: "Deadlock found when trying to get lock; retry transaction",
      messageTruncated: false,
      messageOriginalBytes: 57,
      code: "1213",
      location: {
        file: "app/Jobs/GenerateMonthlyInvoices.php",
        line: 58,
        href: "vscode://file//workspace/app/Jobs/GenerateMonthlyInvoices.php:58",
      },
      frames: [
        {
          file: "app/Jobs/GenerateMonthlyInvoices.php",
          line: 58,
          class: "App\\Jobs\\GenerateMonthlyInvoices",
          type: "->",
          function: "handle",
          isVendor: false,
          href: "vscode://file//workspace/app/Jobs/GenerateMonthlyInvoices.php:58",
          snippet: {
            code: "public function handle(): void\n{\n    throw new DeadlockException('retry transaction');\n}",
            startingLine: 56,
            highlightedLine: 58,
          },
        },
        {
          file: "vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php",
          line: 124,
          class: "Illuminate\\Queue\\CallQueuedHandler",
          type: "->",
          function: "call",
          isVendor: true,
          href: null,
          snippet: null,
        },
        ...Array.from({ length: 30 }, (_, index) => ({
          file: `app/Jobs/Step${index + 1}.php`,
          line: index + 1,
          class: `App\\Jobs\\Step${index + 1}`,
          type: "->",
          function: "handle",
          isVendor: false,
          href: null,
          snippet: null,
        })),
      ],
      framesTruncated: false,
      markdown: "# DeadlockException - Job failed\n\nRetry transaction.\n",
    },
  },
};
const rendered = `${JSON.stringify(baseline, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== rendered) throw new Error("Trigger failure baseline is stale.");
} else {
  writeFileSync(output, rendered);
}

function requireSource(source, snippet, description) {
  if (!source.includes(snippet)) throw new Error(`Pinned Trigger source no longer proves ${description}.`);
}

function sourceFile(path, source) {
  return { path: relative(sourceRoot, path), sha256: createHash("sha256").update(source).digest("hex") };
}
