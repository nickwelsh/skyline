import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "tests/browser/fixtures/nw-222-failure-scenario.json");
const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
const className = "Illuminate\\Database\\DeadlockException";
const message = "Deadlock found when trying to get lock; retry transaction";
const frames = [
  {
    file: "app/Jobs/GenerateMonthlyInvoices.php",
    line: 58,
    class: "App\\Jobs\\GenerateMonthlyInvoices",
    type: "->",
    function: "handle",
    isVendor: false,
    href: "https://example.test/source/app/Jobs/GenerateMonthlyInvoices.php#L58",
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
];
const markdown = [
  `# ${className} - Job failed`,
  "",
  message,
  "",
  "Job App\\Jobs\\GenerateMonthlyInvoices",
  `Run ${runId}`,
  "Attempt 1",
  "Code 1213",
  "",
  "## Stack Trace",
  "",
  ...frames.map((frame, index) => `${index} - ${frame.file}:${frame.line ?? 0}`),
  "",
].join("\n");

const rendered = `${JSON.stringify({
  generatedBy: "node scripts/create-nw222-failure-scenario.mjs",
  viewport: { width: 520, height: 900 },
  triggerError: {
    type: "BUILT_IN_ERROR",
    name: className,
    message,
    stackTrace: frames.map((frame) => `${frame.file}:${frame.line ?? 0} ${frame.class ?? ""}${frame.type ?? ""}${frame.function}`).join("\n"),
  },
  skylineException: {
    class: className,
    message,
    messageTruncated: false,
    messageOriginalBytes: Buffer.byteLength(message),
    code: "1213",
    location: { file: frames[0].file, line: frames[0].line, href: frames[0].href },
    frames,
    framesTruncated: false,
    markdown,
  },
}, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== rendered) throw new Error("NW-222 failure scenario is stale.");
} else {
  writeFileSync(output, rendered);
}
