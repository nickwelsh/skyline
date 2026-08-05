import { expect, test } from "@playwright/test";

const retryRun = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";

test("Runs keeps Trigger's dense shell, URL filters, navigation, and branding boundary", async ({ page }) => {
  await page.goto("/skyline");

  await expect(page.getByText("Skyline", { exact: true })).toBeVisible();
  await expect(page.getByText("Runs", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await expect(page.getByText("Trigger.dev")).toHaveCount(0);
  await expect(page.getByText("PROTOTYPE")).toHaveCount(0);

  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page).toHaveURL(/cursor=25/);
  await page.getByText("BackgroundJob30", { exact: true }).click();
  await expect(page).toHaveURL(/runs\/run_fixture_30.*node=run_run_fixture_30/);
  await expect(page.getByText("run_fixture_30", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/cursor=25/);
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(page).not.toHaveURL(/cursor=/);

  const search = page.getByPlaceholder("Search Runs");
  await search.fill("ImportLegacyOrders");
  await expect(page).toHaveURL(/search=ImportLegacyOrders/);
  await expect(page.getByText("ImportLegacyOrders", { exact: true })).toBeVisible();
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toHaveCount(0);

  await search.fill("");
  await page.getByText("GenerateMonthlyInvoices", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/skyline/runs/${retryRun}.*node=run_${retryRun}`));
  await expect(page.getByText(retryRun, { exact: true })).toBeVisible();
});

test("trace preserves selection, keyboard controls, filters, panels, and inspector", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4174" });
  await page.goto(`/skyline/runs/${retryRun}?node=run_${retryRun}`);

  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("d");
  await expect(page.getByRole("tab", { name: "Detail" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: "Open App\\Jobs\\GenerateMonthlyInvoices in editor" }))
    .toHaveAttribute("href", "vscode://file//workspace/app/Jobs/GenerateMonthlyInvoices.php:1");
  await page.keyboard.press("x");
  await expect(page.getByRole("tab", { name: "Context" })).toHaveAttribute("aria-selected", "true");
  const fixtureContext = page.getByLabel("Context", { exact: true });
  await expect(fixtureContext).toBeVisible();
  const wrapContext = fixtureContext.getByRole("button", { name: "Wrap Context" });
  const wrapBackground = await wrapContext.evaluate((element) => getComputedStyle(element).backgroundColor);
  await wrapContext.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Wrap");
  await expect.poll(() => wrapContext.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(wrapBackground);
  await expect(fixtureContext.getByRole("button", { name: "Copy Context" })).toBeVisible();
  await expect(fixtureContext.getByRole("button", { name: "Expand Context" })).toBeVisible();
  await expect(fixtureContext.getByText("Context", { exact: true })).toHaveCount(0);
  await page.keyboard.press("m");
  const fixtureMetadata = page.getByLabel("Metadata", { exact: true });
  await expect(fixtureMetadata.getByRole("button", { name: "Wrap Metadata" })).toBeVisible();
  await expect(fixtureMetadata.getByRole("button", { name: "Copy Metadata" })).toBeVisible();
  await expect(fixtureMetadata.getByRole("button", { name: "Expand Metadata" })).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/node=attempt_01J8R4NQX6K3PV4W0A1H2Z7M9C_1/);
  await expect(page.getByText("Illuminate\\Database\\DeadlockException")).toBeVisible();
  const exception = page.getByRole("region", { name: "Exception" });
  await expect(exception.getByRole("button", { name: "Show 2 frames" })).toBeVisible();
  await expect(exception.getByText("1 vendor frame")).toHaveCount(0);
  await exception.getByRole("button", { name: "Copy exception as Markdown" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("# Illuminate\\Database\\DeadlockException - Job failed");
  await exception.getByRole("button", { name: "Show 2 frames" }).click();
  await expect(exception.getByText("GenerateMonthlyInvoices->handle()", { exact: true })).toBeVisible();
  await exception.getByRole("button", { name: "1 vendor frame" }).click();
  await expect(exception.getByText("CallQueuedHandler->call()", { exact: true })).toBeVisible();

  const queueTime = page.getByRole("switch", { name: "Queue time" });
  await expect(queueTime).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("q");
  await expect(queueTime).toHaveAttribute("aria-checked", "true");

  await page.getByPlaceholder("Search Trace").fill("insert into");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toBeVisible();
  await page.locator('[data-node-id="span_4f24adb545b26d31"]').click();
  await page.getByRole("tab", { name: "Detail" }).click();
  await expect(page.getByText("Parameterized SQL")).toBeVisible();

  await page.getByPlaceholder("Search Trace").fill("");
  await page.getByRole("combobox", { name: "Span type" }).selectOption("query");
  await expect(page.locator('[data-node-id="span_17ba81b7da8f8b64"]')).toBeVisible();
  await expect(page.locator('[data-node-id="run_01J8R4H9S9J12V04CNH6F6JQ3M"]')).toHaveCount(0);
  await page.getByRole("combobox", { name: "Span type" }).selectOption("all");
  await page.getByText(retryRun, { exact: true }).click();

  const menu = page.getByTestId("side-menu");
  await expect(menu).toHaveCSS("width", "224px");
  await page.getByTestId("side-menu-resizer").click();
  await expect(menu).toHaveCSS("width", "44px");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
});

test("timeline keeps duration geometry accurate and uses points for too-small spans", async ({ page }) => {
  await page.goto(`/skyline/runs/${retryRun}?node=run_${retryRun}`);

  const timeline = page.locator("[data-timeline-root]");
  const attemptBar = page.locator('[data-timeline-node-id="attempt_01J8R4NQX6K3PV4W0A1H2Z7M9C_1"]');
  const timelineBox = await timeline.boundingBox();
  const attemptBox = await attemptBar.boundingBox();

  expect(timelineBox).not.toBeNull();
  expect(attemptBox).not.toBeNull();
  expect(Math.abs(attemptBox!.width - timelineBox!.width * (2_050 / 14_988))).toBeLessThan(1);

  const queryPoint = page.locator('[data-timeline-node-point-id="span_17ba81b7da8f8b64"]');
  await expect(queryPoint).toBeVisible();
  await expect(queryPoint).toHaveClass(/bg-query/);
  await expect(queryPoint).toHaveAttribute("title", /Started 208ms · Duration 46ms$/);
  await expect(page.locator('[data-timeline-node-id="span_17ba81b7da8f8b64"]')).toHaveCount(0);
});

test("timeline ignores queue duration outside its coordinate range", async ({ page }) => {
  await page.route("**/skyline/api/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ json: url.pathname.includes("/nodes/") ? inspectorResponse : externalQueueTraceResponse });
  });
  await page.goto("/skyline/runs/live-run?production=1");

  const timeline = page.locator("[data-timeline-root]");
  const attemptBar = page.locator('[data-timeline-node-id="attempt_live-run_1"]');
  const timelineBox = await timeline.boundingBox();
  const attemptBox = await attemptBar.boundingBox();

  expect(timelineBox).not.toBeNull();
  expect(attemptBox).not.toBeNull();
  expect(Math.abs(attemptBox!.width - timelineBox!.width)).toBeLessThan(1);
  await expect(page.getByRole("switch", { name: "Queue time" })).toHaveAttribute("aria-checked", "false");
});

test("long inspector content scrolls independently", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 480 });
  await page.route("**/skyline/api/**", async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith("/nodes/attempt_live-run_1")
      ? longExceptionInspectorResponse
      : traceResponse;
    await route.fulfill({ json: body });
  });
  await page.goto("/skyline/runs/live-run?production=1&node=attempt_live-run_1");

  const inspector = page.getByRole("tabpanel");
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("Illuminate\\Queue\\Worker->frame1")).toHaveCount(0);
  await inspector.getByRole("button", { name: "Show 40 frames" }).click();
  await expect(inspector.locator("pre")).toContainText("throw new RuntimeException");
  await inspector.getByRole("button", { name: "39 vendor frames" }).click();
  expect(await inspector.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await inspector.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => inspector.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("fixed fixtures retain reviewed Runs and trace visuals", async ({ page }) => {
  await page.goto("/skyline");
  await expect(page).toHaveScreenshot("runs.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });

  await page.goto(`/skyline/runs/${retryRun}?node=run_${retryRun}`);
  await expect(page).toHaveScreenshot("retry-trace.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveScreenshot("exception-collapsed.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
  await page.getByRole("region", { name: "Exception" }).getByRole("button", { name: "Show 2 frames" }).click();
  await expect(page).toHaveScreenshot("exception-expanded.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
});

test("production adapter drives real endpoint state, stable node URLs, and lazy inspector", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4174" });
  const requests: string[] = [];
  await page.route("**/skyline/api/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    const body = url.pathname.endsWith("/nodes/span_live_sql")
      ? inspectorResponse
      : url.pathname.endsWith("/runs/live-run")
        ? traceResponse
        : runsResponse;
    await route.fulfill({ json: body, headers: { ETag: '"live-1"' } });
  });

  await page.goto("/skyline?production=1");
  await expect(page.getByText("LiveInvoiceJob", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Search Runs").fill("invoice");
  await expect.poll(() => requests.some((request) => request.includes("search=invoice"))).toBe(true);

  await page.getByText("LiveInvoiceJob", { exact: true }).click();
  await expect(page).toHaveURL(/runs\/live-run.*node=run_live-run/);
  await expect(page.locator('[data-node-id="span_live_sql"]')).toBeVisible();
  await page.locator('[data-node-id="span_live_sql"]').click();
  await page.getByRole("tab", { name: "Detail" }).click();
  await expect(page.getByRole("region", { name: "Query source" })).toContainText("app/Jobs/LiveInvoiceJob.php:42");
  await expect(page.getByRole("link", { name: "Open app/Jobs/LiveInvoiceJob.php:42 in editor" }))
    .toHaveAttribute("href", "vscode://file//workspace/app/Jobs/LiveInvoiceJob.php:42");
  const sqlPreview = page.getByRole("region", { name: "Parameterized SQL preview", exact: true });
  await expect(sqlPreview.locator("pre")).toHaveText("select * from invoices where id = ?");
  expect(await sqlPreview.locator("pre span").count()).toBeGreaterThan(3);

  await sqlPreview.getByRole("tab", { name: "With bindings" }).click();
  const interpolatedSql = page.getByRole("region", { name: "SQL with bindings preview", exact: true });
  await expect(interpolatedSql.locator("pre")).toHaveText("select * from invoices where id = 42");
  await interpolatedSql.getByRole("button", { name: "Copy SQL with bindings" }).click();
  await expect(interpolatedSql.getByRole("button", { name: "Copy SQL with bindings" })).toHaveAttribute("title", "Copied");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("select * from invoices where id = 42");

  await expect(page.getByText("Bindings", { exact: true })).toBeVisible();
  await expect(page.getByText("Result preview", { exact: true })).toBeVisible();
  await expect(page.getByText("1 row returned", { exact: false })).toBeVisible();
  const bindingsPreview = page.getByRole("region", { name: "Bindings preview", exact: true });
  const resultPreview = page.getByRole("region", { name: "Result preview preview", exact: true });
  await bindingsPreview.getByRole("tab", { name: "Tree" }).click();
  await resultPreview.getByRole("tab", { name: "Tree" }).click();
  await expect(bindingsPreview.getByRole("tree", { name: "Bindings JSON tree" })).toBeVisible();
  await expect(resultPreview.getByRole("tree", { name: "Result preview JSON tree" })).toContainText("invoice-42");

  await bindingsPreview.getByRole("tab", { name: "Text" }).click();
  await expect(bindingsPreview.locator("pre")).toContainText('"position": 0');
  expect(await bindingsPreview.locator("pre span").count()).toBeGreaterThan(3);
  await bindingsPreview.getByRole("button", { name: "Copy Bindings" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('"column": "id"');

  await expect(page.getByRole("tabpanel")).toContainText("invoice-42");
  expect(requests.some((request) => request.endsWith("/nodes/span_live_sql"))).toBe(true);

  await page.getByRole("tab", { name: "Metadata" }).click();
  const metadataPreview = page.getByLabel("Metadata", { exact: true });
  await expect(metadataPreview.locator("pre")).toContainText('"db.system.name": "mysql"');
  expect(await metadataPreview.locator("pre span").count()).toBeGreaterThan(3);
  await metadataPreview.getByRole("button", { name: "Wrap Metadata" }).click();
  await metadataPreview.getByRole("button", { name: "Expand Metadata" }).click();
  const metadataDialog = page.getByRole("dialog", { name: "Metadata" });
  await expect(metadataDialog).toBeVisible();
  await metadataDialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const metadataDialogBox = await metadataDialog.boundingBox();
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(metadataDialogBox).not.toBeNull();
  expect(Math.abs(metadataDialogBox!.width - viewport.width * 0.8)).toBeLessThan(1);
  expect(Math.abs(metadataDialogBox!.height - viewport.height * 0.8)).toBeLessThan(1);
  await page.getByRole("button", { name: "Close" }).click();
  await metadataPreview.getByRole("button", { name: "Copy Metadata" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('"db.system.name": "mysql"');
});

test("outgoing HTTP rows expose request and response captures", async ({ page }) => {
  await page.route("**/skyline/api/**", async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith("/nodes/span_live_http")
      ? httpInspectorResponse
      : url.pathname.endsWith("/runs/live-run")
        ? httpTraceResponse
        : runsResponse;
    await route.fulfill({ json: body });
  });

  await page.goto("/skyline/runs/live-run?production=1&node=span_live_http");
  await expect(page.locator('[data-node-id="span_live_http"]')).toBeVisible();
  await expect(page.locator('[data-timeline-node-id="span_live_http"]')).toHaveClass(/bg-cyan-500/);
  await page.getByRole("tab", { name: "Detail" }).click();
  await expect(page.getByRole("region", { name: "Request source" })).toContainText("app/Jobs/LiveInvoiceJob.php:55");
  await expect(page.getByRole("tabpanel")).toContainText("https://api.example.test/invoices");
  const requestHeaders = page.getByRole("region", { name: "Request headers preview" });
  const requestBody = page.getByRole("region", { name: "Request body preview" });
  const responseBody = page.getByRole("region", { name: "Response body preview" });
  await requestHeaders.getByRole("tab", { name: "Tree" }).click();
  await requestBody.getByRole("tab", { name: "Tree" }).click();
  await responseBody.getByRole("tab", { name: "Tree" }).click();
  await expect(requestHeaders.getByRole("tree", { name: "Request headers JSON tree" })).toContainText("[REDACTED]");
  await expect(requestBody.getByRole("tree", { name: "Request body JSON tree" })).toContainText("invoice-42");
  await expect(responseBody.getByRole("tree", { name: "Response body JSON tree" })).toContainText("accepted");
});

test("cache storage and breadcrumbs expose useful operation details", async ({ page }) => {
  await page.route("**/skyline/api/**", async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith("/nodes/span_live_cache")
      ? cacheInspectorResponse
      : url.pathname.endsWith("/nodes/span_live_storage")
        ? storageInspectorResponse
        : url.pathname.endsWith("/nodes/breadcrumb_live_warning")
          ? breadcrumbInspectorResponse
        : detailTraceResponse;
    await route.fulfill({ json: body });
  });

  await page.goto("/skyline/runs/live-run?production=1&node=span_live_cache");
  await expect.poll(() => page.locator("[data-trace-item-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-trace-item-id")))).toEqual([
    "run_live-run",
    "attempt_live-run_1",
    "span_live_cache",
    "breadcrumb_live_warning",
    "breadcrumb_live_error",
    "span_live_storage",
  ]);
  await expect.poll(() => page.locator("[data-timeline-item-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-timeline-item-id")))).toEqual([
    "run_live-run",
    "attempt_live-run_1",
    "span_live_cache",
    "breadcrumb_live_warning",
    "breadcrumb_live_error",
    "span_live_storage",
  ]);

  const breadcrumbRows = page.locator('[data-trace-row-kind="breadcrumb"]');
  await expect(breadcrumbRows).toHaveCount(2);
  await expect(breadcrumbRows.nth(0)).toContainText("WARNING · Import token=[REDACTED] delayed");
  await expect(breadcrumbRows.nth(1)).toContainText("ERROR · Import failed");

  const breadcrumbTimelineRows = page.locator('[data-timeline-row-kind="breadcrumb"]');
  await expect(breadcrumbTimelineRows).toHaveCount(2);
  await expect(breadcrumbTimelineRows.nth(0).locator('[data-timeline-node-point-id="breadcrumb_live_warning"]')).toHaveAttribute("title", /^WARNING · Import token=\[REDACTED\] delayed · Started 260ms · Duration 0ms$/);
  await expect(breadcrumbTimelineRows.nth(1).locator('[data-timeline-node-point-id="breadcrumb_live_error"]')).toHaveAttribute("title", /^ERROR · Import failed · Started 280ms · Duration 0ms$/);

  await breadcrumbRows.first().click();
  await expect(page).toHaveURL(/node=breadcrumb_live_warning/);
  const breadcrumb = page.getByRole("tabpanel");
  await expect(breadcrumb).toContainText("Import token=[REDACTED] delayed");
  await expect(breadcrumb).toContainText("warning");
  await expect(breadcrumb).toContainText("audit");

  await page.locator('[data-node-id="span_live_cache"]').click();
  await page.getByRole("tab", { name: "Detail" }).click();
  const cache = page.getByRole("tabpanel");
  await expect(cache).toContainText("Stale While Revalidate");
  await expect(cache).toContainText("30 seconds");
  await expect(cache).toContainText("2 minutes");
  await expect(cache).toContainText("Key fingerprint");
  await expect(cache).toContainText("Value capture is off");

  await page.locator('[data-node-id="span_live_storage"]').click();
  await page.getByRole("tab", { name: "Detail" }).click();
  const storage = page.getByRole("tabpanel");
  await expect(storage).toContainText("reports/customer report.txt");
  await expect(storage).toContainText("2.0 KB");
  await expect(storage.getByRole("link", { name: "Open source URL" })).toHaveAttribute("href", "https://files.example.test/reports/customer%20report.txt");
  await expect(storage.getByRole("link", { name: "Open source in editor" })).toHaveAttribute("href", "vscode://file//workspace/storage/reports/customer report.txt:1");
  await expect(storage.getByRole("region", { name: "Written contents preview" })).toContainText("private contents");
});

test("production adapter renders authorization failures", async ({ page }) => {
  await page.route("**/skyline/api/**", (route) => route.fulfill({
    status: 403,
    json: { error: { code: "forbidden", message: "Define the viewSkyline Gate." } },
  }));

  await page.goto("/skyline?production=1");
  await expect(page.getByText("Skyline access denied", { exact: true })).toBeVisible();
  await expect(page.getByText("Define the viewSkyline Gate.", { exact: true })).toBeVisible();
});

test("production adapter distinguishes loading and empty states", async ({ page }) => {
  await page.route("**/skyline/api/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: { ...runsResponse, runs: [], hasAnyRuns: false } });
  });

  await page.goto("/skyline?production=1");
  await expect(page.getByText("Loading Runs…", { exact: true })).toBeVisible();
  await expect(page.getByText("No Runs yet.", { exact: true })).toBeVisible();
});

const metadata = {
  schemaVersion: 1,
  packageVersion: "test",
  observedAt: "2026-08-04T20:02:00.000000000Z",
} as const;

const run = {
  id: "live-run",
  name: "App\\Jobs\\LiveInvoiceJob",
  status: "completed",
  connection: "redis",
  queue: "billing",
  attemptCount: 1,
  triggeredAt: "2026-08-04T20:01:00.000000000Z",
  queuedAt: "2026-08-04T20:01:00.100000000Z",
  startedAt: "2026-08-04T20:01:00.200000000Z",
  finishedAt: "2026-08-04T20:01:01.000000000Z",
  queueDurationUs: 100_000,
  durationUs: 800_000,
  activeDurationUs: null,
  revision: 1,
} as const;

const traceNodes = [
  { id: "run_live-run", parentId: null, runId: "live-run", kind: "run", label: "LiveInvoiceJob", level: 0, offsetUs: 0, durationUs: 1_000_000, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: ["attempt_live-run_1"], hasChildren: true, timelineEvents: [] },
  { id: "attempt_live-run_1", parentId: "run_live-run", runId: "live-run", kind: "attempt", label: "Attempt 1", level: 1, offsetUs: 200_000, durationUs: 800_000, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: ["span_live_sql"], hasChildren: true, timelineEvents: [] },
  { id: "span_live_sql", parentId: "attempt_live-run_1", runId: "live-run", kind: "query", label: "select * from invoices where id = ?", level: 2, offsetUs: 300_000, durationUs: 10_000, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: [], hasChildren: false, timelineEvents: [] },
] as const;

const runsResponse = {
  ...metadata,
  runs: [run],
  pagination: { previous: null, next: null },
  pollCursor: "poll",
  polling: { activeRunsIntervalMs: 60_000, newRunsIntervalMs: 60_000 },
  tableState: "table-state",
  filters: {},
  options: { statuses: ["queued", "running", "retrying", "completed", "failed"], jobNames: [run.name], queueTargets: [{ connection: "redis", queue: "billing" }] },
  hasAnyRuns: true,
};

const traceResponse = {
  ...metadata,
  run: { ...run, traceId: "a".repeat(32), rootRunId: "live-run", parentRunId: null },
  trace: { revision: 1, rootStatus: "completed", rootStartedAt: run.triggeredAt, durationUs: 1_000_000, activeDurationUs: null, queuedDurationUs: 100_000, nodes: traceNodes, nodeCount: 3, isTruncated: false, polling: false, pollIntervalMs: 3_000, pollUntil: null },
  navigation: { previousRunId: null, nextRunId: null, tableState: "table-state", listCursor: null },
};

const externalQueueTraceResponse = {
  ...traceResponse,
  run: { ...traceResponse.run, queueDurationUs: 2_000_000, durationUs: 54_000 },
  trace: {
    ...traceResponse.trace,
    durationUs: 54_000,
    queuedDurationUs: 2_000_000,
    nodes: traceResponse.trace.nodes.filter((node) => node.kind !== "query").map((node) => ({
      ...node,
      children: node.kind === "attempt" ? [] : node.children,
      hasChildren: node.kind !== "attempt" && node.hasChildren,
      offsetUs: 0,
      durationUs: 54_000,
    })),
  },
};

const inspectorResponse = {
  ...metadata,
  traceRevision: 1,
  node: {
    ...traceNodes[2],
    overview: { runId: "live-run", spanId: "live_sql" },
    sql: { value: "select * from invoices where id = ?", isTruncated: false, originalBytes: 35 },
    source: { file: "app/Jobs/LiveInvoiceJob.php", line: 42, href: "vscode://file//workspace/app/Jobs/LiveInvoiceJob.php:42" },
    bindings: { items: [{ position: 0, column: "id", value: 42 }], truncated: false },
    result: { kind: "rows", rows: [{ id: 42, reference: "invoice-42" }], rowCount: 1, truncated: false },
    metadata: { value: { attributes: { "db.system.name": "mysql" } }, isTruncated: false, truncated: [] },
  },
};

const httpNode = {
  id: "span_live_http", parentId: "attempt_live-run_1", runId: "live-run", kind: "request", label: "POST https://api.example.test/invoices", level: 2, offsetUs: 350_000, durationUs: 25_000, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: [], hasChildren: false, timelineEvents: [],
} as const;

const httpTraceResponse = {
  ...traceResponse,
  trace: {
    ...traceResponse.trace,
    nodes: [traceNodes[0], { ...traceNodes[1], children: [httpNode.id] }, httpNode],
  },
};

const httpInspectorResponse = {
  ...metadata,
  traceRevision: 1,
  node: {
    ...httpNode,
    overview: { method: "POST", url: "https://api.example.test/invoices", statusCode: 202 },
    source: { file: "app/Jobs/LiveInvoiceJob.php", line: 55, href: "vscode://file//workspace/app/Jobs/LiveInvoiceJob.php:55" },
    http: {
      method: "POST",
      url: "https://api.example.test/invoices",
      statusCode: 202,
      request: {
        headers: { items: { Authorization: ["[REDACTED]"], "Content-Type": ["application/json"] }, truncated: false },
        body: { value: '{"reference":"invoice-42"}', contentType: "application/json", originalBytes: 26, truncated: false, isJson: true, json: { reference: "invoice-42" } },
      },
      response: {
        headers: { items: { "Content-Type": ["application/json"] }, truncated: false },
        body: { value: '{"accepted":true}', contentType: "application/json", originalBytes: 17, truncated: false, isJson: true, json: { accepted: true } },
      },
    },
    metadata: { value: { attributes: { "http.request.method": "POST" } }, isTruncated: false, truncated: [] },
  },
};

const cacheNode = {
  id: "span_live_cache", parentId: "attempt_live-run_1", runId: "live-run", kind: "cache", label: "Cache PUT", level: 2, offsetUs: 300_000, durationUs: 4_000, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: [], hasChildren: false, timelineEvents: [],
} as const;

const storageNode = {
  id: "span_live_storage", parentId: "attempt_live-run_1", runId: "live-run", kind: "storage", label: "Storage WRITE", level: 2, offsetUs: 420_000, durationUs: 5_000, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: [], hasChildren: false, timelineEvents: [],
} as const;

const warningBreadcrumbNode = {
  id: "breadcrumb_live_warning", parentId: "attempt_live-run_1", runId: "live-run", kind: "breadcrumb", label: "WARNING · Import token=[REDACTED] delayed", level: 2, offsetUs: 360_000, durationUs: 0, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: [], hasChildren: false, timelineEvents: [], logLevel: "warning",
} as const;

const errorBreadcrumbNode = {
  id: "breadcrumb_live_error", parentId: "attempt_live-run_1", runId: "live-run", kind: "breadcrumb", label: "ERROR · Import failed", level: 2, offsetUs: 380_000, durationUs: 0, status: "completed", isError: false, isPartial: false, hasErrorDescendant: false, children: [], hasChildren: false, timelineEvents: [], logLevel: "error",
} as const;

const detailTraceResponse = {
  ...traceResponse,
  trace: {
    ...traceResponse.trace,
    nodes: [
      traceNodes[0],
      {
        ...traceNodes[1],
        children: [cacheNode.id, warningBreadcrumbNode.id, errorBreadcrumbNode.id, storageNode.id],
        timelineEvents: [],
      },
      cacheNode,
      warningBreadcrumbNode,
      errorBreadcrumbNode,
      storageNode,
    ],
  },
};

const breadcrumbInspectorResponse = {
  ...metadata,
  traceRevision: 1,
  node: {
    ...warningBreadcrumbNode,
    overview: { level: "warning", channel: "audit" },
    breadcrumb: { message: "Import token=[REDACTED] delayed", level: "warning", channel: "audit", timestamp: "2026-08-04T20:01:00.560000000Z", context: { batch: 42 } },
    metadata: { value: { attributes: {} }, isTruncated: false, truncated: [] },
  },
};

const cacheInspectorResponse = {
  ...metadata,
  traceRevision: 1,
  node: {
    ...cacheNode,
    overview: { operation: "PUT", store: "array" },
    cache: { operation: "PUT", store: "array", key: "sha256:efabc123", keyCaptured: false, keyCount: 1, strategy: "stale_while_revalidate", outcome: "stored", hit: null, ttlSeconds: 120, freshTtlSeconds: 30, forever: false },
    metadata: { value: { attributes: {} }, isTruncated: false, truncated: [] },
  },
};

const storageInspectorResponse = {
  ...metadata,
  traceRevision: 1,
  node: {
    ...storageNode,
    overview: { operation: "write", store: "reports" },
    storage: {
      operation: "write", disk: "reports", driver: "local", path: "reports/customer report.txt", pathCaptured: true, destination: null, destinationCaptured: false, bytes: 2048, outcome: "completed",
      url: "https://files.example.test/reports/customer%20report.txt", destinationUrl: null,
      localFile: { path: "/workspace/storage/reports/customer report.txt", href: "vscode://file//workspace/storage/reports/customer report.txt:1" }, destinationLocalFile: null,
      content: { type: "string", value: "private contents", originalBytes: 18, truncated: false },
      result: { exists: null, lastModified: null, mimeType: null, visibility: null },
    },
    metadata: { value: { attributes: {} }, isTruncated: false, truncated: [] },
  },
};

const longExceptionInspectorResponse = {
  ...metadata,
  traceRevision: 1,
  node: {
    ...traceNodes[1],
    overview: { runId: "live-run", attemptNumber: 1, spanId: "live_attempt" },
    exception: {
      class: "RuntimeException",
      message: "A deliberately long failure stack",
      messageTruncated: false,
      messageOriginalBytes: 33,
      code: "0",
      runtime: { php: "8.4.8", laravel: "12.42.0" },
      location: { file: "app/Jobs/LiveInvoiceJob.php", line: 42, href: "vscode://file//workspace/app/Jobs/LiveInvoiceJob.php:42" },
      frames: [{
        file: "app/Jobs/LiveInvoiceJob.php",
        line: 42,
        class: "App\\Jobs\\LiveInvoiceJob",
        type: "->",
        function: "handle",
        isVendor: false,
        href: "vscode://file//workspace/app/Jobs/LiveInvoiceJob.php:42",
        snippet: { code: "public function handle(): void\n{\n    throw new RuntimeException('Failed');\n}\n", startingLine: 40, highlightedLine: 42 },
      }, ...Array.from({ length: 39 }, (_, index) => ({
        file: `vendor/laravel/framework/src/Illuminate/Queue/Worker${index}.php`,
        line: index + 1,
        class: "Illuminate\\Queue\\Worker",
        type: "->",
        function: `frame${index + 1}`,
        isVendor: true,
        href: null,
        snippet: null,
      }))],
      framesTruncated: false,
      markdown: "# RuntimeException - Job failed\n\nA deliberately long failure stack\n\n## Stack Trace\n",
    },
    metadata: { value: { attributes: {} }, isTruncated: false, truncated: [] },
  },
};
