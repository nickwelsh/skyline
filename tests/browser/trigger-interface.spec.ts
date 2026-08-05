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

test("trace preserves selection, keyboard controls, filters, panels, and inspector", async ({ page }) => {
  await page.goto(`/skyline/runs/${retryRun}?node=run_${retryRun}`);

  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/node=attempt_01J8R4NQX6K3PV4W0A1H2Z7M9C_1/);
  await expect(page.getByText("Illuminate\\Database\\DeadlockException")).toBeVisible();

  const queueTime = page.getByRole("switch", { name: "Queue time" });
  await expect(queueTime).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("q");
  await expect(queueTime).toHaveAttribute("aria-checked", "true");

  await page.getByPlaceholder("Search Trace").fill("insert into");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toBeVisible();
  await page.locator('[data-node-id="span_4f24adb545b26d31"]').click();
  await page.getByRole("tab", { name: "Detail" }).click();
  await expect(page.getByText("Parameterized SQL")).toBeVisible();

  const menu = page.getByTestId("side-menu");
  await expect(menu).toHaveCSS("width", "224px");
  await page.getByTestId("side-menu-resizer").click();
  await expect(menu).toHaveCSS("width", "44px");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
});

test("SQL queries have distinct minimum-width timeline marks", async ({ page }) => {
  await page.goto(`/skyline/runs/${retryRun}?node=run_${retryRun}`);

  const queryMark = page.locator('[data-timeline-node-id="span_17ba81b7da8f8b64"]');
  await expect(queryMark).toBeVisible();
  await expect(queryMark).toHaveClass(/bg-query/);
  await expect(queryMark).toHaveAttribute("title", /Started 208ms · Duration 46ms$/);
  expect((await queryMark.boundingBox())?.width).toBeGreaterThanOrEqual(6);
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
});

test("production adapter drives real endpoint state, stable node URLs, and lazy inspector", async ({ page }) => {
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
  await expect(page.getByRole("tabpanel").locator("pre")).toHaveText("select * from invoices where id = ?");
  expect(requests.some((request) => request.endsWith("/nodes/span_live_sql"))).toBe(true);
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

const inspectorResponse = {
  ...metadata,
  traceRevision: 1,
  node: {
    ...traceNodes[2],
    overview: { runId: "live-run", spanId: "live_sql" },
    sql: { value: "select * from invoices where id = ?", isTruncated: false, originalBytes: 35 },
    metadata: { value: { attributes: { "db.system.name": "mysql" } }, isTruncated: false, truncated: [] },
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
      frames: Array.from({ length: 40 }, (_, index) => ({
        file: `vendor/laravel/framework/src/Illuminate/Queue/Worker${index}.php`,
        line: index + 1,
        class: "Illuminate\\Queue\\Worker",
        type: "->",
        function: `frame${index}`,
      })),
    },
    metadata: { value: { attributes: {} }, isTruncated: false, truncated: [] },
  },
};
