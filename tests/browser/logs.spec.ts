import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SkylineCapabilities, TelemetryEventDetailDto, TelemetryEventsPageDto } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import baseline from "./fixtures/nw-225-trigger-logs-baseline.json" with { type: "json" };
import { readPinnedTriggerSource } from "./support/pinned-trigger-source";
import { additionalAxeViolations, captureAxe } from "../fidelity/support/axe";
import { installSkylineFixture, parseScenario, scenarioPath } from "../fidelity/support/skyline";

const operationId = "event_operation";
const logId = "event_log";

test("pinned fixture keeps the Telemetry-event stream visible beside selected detail", async ({ page }) => {
  const scenario = parseScenario("log-found@1440x960-classic");
  const fixture = await installSkylineFixture(page, scenario);
  const listResponses: Array<{ url: string; page: TelemetryEventsPageDto }> = [];
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname.endsWith("/skyline/api/logs")) listResponses.push({ url: response.url(), page: await response.json() });
  });
  await page.goto(scenarioPath(scenario, fixture.catalog));
  await expect.poll(() => listResponses.at(-1)).toEqual(expect.objectContaining({
    url: expect.stringMatching(/\/skyline\/api\/logs$/),
    page: expect.objectContaining({ telemetryEvents: expect.arrayContaining([expect.objectContaining({ id: "event_fixture_operation" }), expect.objectContaining({ id: "event_fixture_log" })]) }),
  }));
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByTestId("telemetry-event-detail")).toContainText("Invoice import delayed");
});

test("paired pinned Trigger Logs preserve list/detail geometry, selection, links, and a11y", async ({ page }) => {
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }

  const reference = await page.context().newPage();
  await reference.goto("http://127.0.0.1:4175/logs");
  await expect(reference.getByRole("columnheader").allTextContents()).resolves.toEqual(["Time", "Run", "Task", "Level", "Message"]);
  const referenceList = await visuals(reference);
  const referenceAxe = await captureAxe(reference);
  await expect(reference.locator("table")).toMatchAriaSnapshot(`
    - table:
      - rowgroup:
        - row "Time Run Task Level Message"
      - rowgroup:
        - row
        - row
  `);
  const referenceFirstCell = reference.locator("tbody tr").first().getByRole("button").first();
  await expect(referenceFirstCell).toHaveAttribute("tabindex", "-1");
  await referenceFirstCell.focus();
  await reference.keyboard.press("Tab");
  const referenceNextFocus = await focusSignature(reference);
  await reference.locator("tbody tr").first().hover();
  await expect(reference.locator("tbody tr").first().getByRole("link", { name: "View run" })).toHaveAttribute("href", "/runs/run_invoice?span=span_job");
  await reference.locator("tbody tr").nth(1).getByRole("button").first().focus();
  await reference.keyboard.press("Enter");
  await expect(reference).toHaveURL(/log=log_error/);
  await expect(reference.getByRole("region", { name: "Pinned log detail" })).toBeVisible();
  const referenceDetail = await detailVisuals(reference.getByRole("region", { name: "Pinned log detail" }));

  await routeLogs(page);
  await page.goto("/skyline/logs");
  await expect(page.getByRole("navigation", { name: "Application" }).getByRole("link", { name: "Logs" })).toHaveAttribute("href", "/skyline/logs");
  await expect(page.getByPlaceholder("Search logs…")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tasks/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Run ID/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Created: 1hr/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Level/ })).toBeVisible();
  await expect(page.getByRole("columnheader").allTextContents()).resolves.toEqual(["Time", "Run", "Task", "Level", "Message"]);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  expect(await visuals(page)).toEqual(referenceList);
  expect(additionalAxeViolations(referenceAxe, await captureAxe(page))).toEqual([]);
  await expect(page.locator("table")).toMatchAriaSnapshot(`
    - table:
      - rowgroup:
        - row "Time Run Task Level Message"
      - rowgroup:
        - row
        - row
  `);
  const skylineFirstCell = page.locator("tbody tr").first().getByRole("button").first();
  await expect(skylineFirstCell).toHaveAttribute("tabindex", "-1");
  await skylineFirstCell.focus();
  await page.keyboard.press("Tab");
  expect(await focusSignature(page)).toEqual(referenceNextFocus);
  await expect(page.getByLabel("Application-log capture")).toContainText("warning, error");
  await page.locator("tbody tr").first().hover();
  await expect(page.locator("tbody tr").first().getByRole("link", { name: "View run" })).toHaveAttribute("href", "/skyline/runs/run_invoice");

  await page.locator("tbody tr").nth(1).getByRole("button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`event=${logId}`));
  const detail = page.getByTestId("telemetry-event-detail");
  await expect(detail).toContainText("Application log context");
  await expect(detail).toContainText("trace_invoice");
  await expect(detail).toContainText("parent_job");
  await expect(detail.getByRole("link", { name: "View full run" })).toHaveAttribute("href", "/skyline/runs/run_invoice");
  await expect.poll(() => detailVisuals(detail)).toEqual(referenceDetail);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/event=/);
  await expect(detail).toHaveCount(0);
  await reference.keyboard.press("Escape");
  await expect(reference).not.toHaveURL(/log=/);
  await page.locator("tbody tr").first().getByRole("button").first().focus();
  await page.keyboard.press("Enter");
  const operationDetail = page.getByRole("region", { name: "Telemetry-event detail" });
  await expect(operationDetail.getByRole("link", { name: "Attempt 2" })).toHaveAttribute("href", "/skyline/runs/run_invoice?node=attempt_2");
  await expect(operationDetail.getByRole("link", { name: "View Job" })).toHaveAttribute("href", "/skyline/jobs/job_invoice");
  await expect(operationDetail.getByRole("link", { name: "Inspect operation" })).toHaveAttribute("href", "/skyline/runs/run_invoice?node=span_operation");
  await expect(operationDetail.getByRole("link", { name: "View Error group" })).toHaveAttribute("href", "/skyline/errors/error_invoice");
  await expect(operationDetail).toContainText("Captured operation detail was truncated");
  await expect(page.getByRole("button", { name: /replay|cancel|delete|retry/i })).toHaveCount(0);
  await reference.close();
});

test("rapid Logs selection ignores aborted and stale detail responses", async ({ page }) => {
  let releaseLog!: () => void;
  const heldLog = new Promise<void>((resolve) => { releaseLog = resolve; });
  let holdLog = true;

  await page.route("**/skyline/api/logs**", async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.match(/\/api\/logs\/([^/]+)$/)?.[1];
    if (!id) return route.fulfill({ json: listResponse(url) });
    if (id === logId && holdLog) await heldLog;
    return route.fulfill({ json: detailResponse(id) });
  });

  await page.goto("/skyline/logs");
  await page.locator("tbody tr").nth(1).getByRole("button").first().click();
  await expect(page).toHaveURL(new RegExp(`event=${logId}`));
  await expect(page.getByLabel("Loading Telemetry-event detail")).toBeVisible();
  await page.locator("tbody tr").first().getByRole("button").first().click();
  await expect(page).toHaveURL(new RegExp(`event=${operationId}`));
  const detail = page.getByRole("region", { name: "Telemetry-event detail" });
  await expect(detail).toContainText("Inspect operation");

  holdLog = false;
  releaseLog();
  await page.waitForTimeout(50);
  await expect(detail).toContainText("Inspect operation");
  await expect(detail).not.toContainText("Application log context");
});

test("Logs filters and opaque cursor stay URL/server-backed", async ({ page }) => {
  await routeLogs(page, { paginate: true });
  await page.goto("/skyline/logs");
  await expect(page.getByText("Showing all 2 logs")).toHaveCount(0);
  const searchRequest = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/skyline/api/logs") && new URL(request.url()).searchParams.get("search") === "invoice");
  await page.getByPlaceholder("Search logs…").fill("invoice");
  await page.getByPlaceholder("Search logs…").press("Enter");
  await searchRequest;
  await expect(page).toHaveURL(/search=invoice/);
  await toggleLevel(page, "ERROR");
  await expect(page).toHaveURL(/levels=ERROR/);
  await toggleLevel(page, "WARN");
  await expect(page).toHaveURL(/levels=ERROR&levels=WARN/);
  await page.getByRole("button", { name: /^Tasks$/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "App\\Jobs\\GenerateMonthlyInvoices" }).click();
  await page.getByRole("button", { name: /^Run ID$/ }).click();
  await page.getByLabel("Run ID value").fill("run_invoice");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/runId=run_invoice/);
  await page.getByRole("button", { name: /Created:/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Last 7 days" }).click();
  await expect(page).toHaveURL(/jobType=App%5CJobs%5CGenerateMonthlyInvoices/);
  await expect(page).toHaveURL(/runId=run_invoice/);
  await expect(page).toHaveURL(/period=7d/);
  await expect(page.getByLabel("Loading Telemetry events")).toHaveCount(0);
  await page.getByRole("menuitemcheckbox", { name: "All time" }).click();
  await expect(page).toHaveURL(/period=all/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/skyline\/logs$/);
  await page.locator('a[href*="cursor=opaque-next"]').click();
  await expect(page).toHaveURL(/cursor=opaque-next&direction=forward/);
  await expect(page.getByText("Showing all 2 logs")).toHaveCount(0);
  await page.locator('a[href*="cursor=opaque-previous"]').click();
  await expect(page).toHaveURL(/cursor=opaque-previous&direction=backward/);
});

test("Logs cover operation/log, loading, long, capture-disabled, empty, filtered-empty, errors, and detail failures", async ({ page }) => {
  let mode: "populated" | "initial-empty" | "filtered-empty" | "capture-disabled" | "error" = "populated";
  let detailMode: "normal" | "error" | "not-found" = "normal";
  let delay = false;
  let detailDelay = false;
  await page.route("**/skyline/api/logs**", async (route) => {
    const url = new URL(route.request().url());
    if (delay) await new Promise((resolve) => setTimeout(resolve, 200));
    const id = url.pathname.match(/\/api\/logs\/([^/]+)$/)?.[1];
    if (id) {
      if (detailDelay) await new Promise((resolve) => setTimeout(resolve, 250));
      if (detailMode === "not-found") return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Telemetry event missing." } } });
      if (detailMode === "error") return route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Telemetry detail unavailable." } } });
      return route.fulfill({ json: detailResponse(id) });
    }
    if (mode === "error") return route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Telemetry evidence unavailable." } } });
    const response = listResponse(url);
    if (mode === "initial-empty" || mode === "filtered-empty") {
      response.telemetryEvents = [];
      response.hasAnyTelemetryEvents = mode === "filtered-empty";
      if (mode === "filtered-empty") response.filters.levels = ["ERROR"];
    }
    if (mode === "capture-disabled") response.capture.enabled = false;
    return route.fulfill({ json: response });
  });

  await page.goto("/skyline/logs");
  delay = true;
  await toggleLevel(page, "TRACE");
  await expect(page.getByLabel("Loading Telemetry events")).toBeVisible();
  delay = false;
  detailDelay = true;
  await page.goto(`/skyline/logs?event=${logId}`);
  const logDetail = page.getByTestId("telemetry-event-detail");
  await expect(logDetail).toContainText("Application log context ");
  await expect(page.getByLabel("Loading Telemetry-event detail")).toBeVisible();
  await expect(logDetail).toContainText("Application log context ");
  await expect(logDetail).toContainText("stack");
  await expect(logDetail).not.toContainText("Captured operation detail was truncated");
  await toggleLevel(page, "TRACE");
  await expect(page.getByLabel("Refreshing Telemetry-event detail")).toBeVisible();
  await expect(logDetail).toContainText("Application log context ");
  await expect(page.getByLabel("Refreshing Telemetry-event detail")).toHaveCount(0);
  detailDelay = false;

  mode = "capture-disabled";
  await page.goto("/skyline/logs");
  await expect(page.getByLabel("Application-log capture disabled")).toContainText("previously captured logs remain available");
  mode = "initial-empty";
  await page.goto("/skyline/logs");
  await expect(page.getByText("No Telemetry events yet")).toBeVisible();
  mode = "filtered-empty";
  await page.goto("/skyline/logs?levels=ERROR");
  await expect(page.getByText("No matching Telemetry events")).toBeVisible();
  mode = "error";
  await page.goto("/skyline/logs");
  await expect(page.getByRole("alert")).toContainText("Telemetry evidence unavailable.");

  mode = "populated";
  detailMode = "not-found";
  await page.goto("/skyline/logs?event=missing");
  await expect(page.getByRole("alert")).toContainText("Telemetry event not found");
  detailMode = "error";
  await page.goto(`/skyline/logs?event=${operationId}`);
  await expect(page.getByRole("alert")).toContainText("Telemetry detail unavailable.");
});

async function routeLogs(page: Page, options: { paginate?: boolean } = {}) {
  await page.route("**/skyline/api/logs**", async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.match(/\/api\/logs\/([^/]+)$/)?.[1];
    if (id) return route.fulfill({ json: detailResponse(id) });
    const response = listResponse(url);
    if (options.paginate) response.pagination = url.searchParams.has("cursor") ? { previous: "opaque-previous", next: null } : { previous: null, next: "opaque-next" };
    await route.fulfill({ json: response });
  });
}

async function toggleLevel(page: Page, level: string) {
  const option = page.getByRole("menuitemcheckbox", { name: level });
  if (!await option.isVisible()) await page.getByRole("button", { name: /Level/ }).click();
  await option.click();
}

function listResponse(url = new URL("https://example.test")): TelemetryEventsPageDto {
  return {
    schemaVersion: 1, packageVersion: "fixture", generatedAt: "2026-08-05T12:00:02Z", capabilities: capabilities(),
    telemetryEvents: [operation(), log()], pagination: { previous: null, next: null },
    filters: { search: url.searchParams.get("search"), levels: url.searchParams.getAll("levels[]") as TelemetryEventsPageDto["filters"]["levels"], jobType: url.searchParams.get("jobType"), runId: url.searchParams.get("runId"), period: url.searchParams.get("period") as TelemetryEventsPageDto["filters"]["period"] ?? "1h" },
    options: { levels: ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"], jobTypes: ["App\\Jobs\\GenerateMonthlyInvoices"], timeRanges },
    capture: { enabled: true, supportedLevels: ["warning", "error"], perAttemptLimit: 100 }, hasAnyTelemetryEvents: true,
  };
}

function detailResponse(id: string): TelemetryEventDetailDto {
  if (id === logId) {
    const base = log();
    if (base.variant !== "log") throw new Error("Expected log fixture");
    return { ...listResponse(), telemetryEvent: { ...base, relationships: { traceId: base.traceId, spanId: base.spanId, parentSpanId: base.parentSpanId }, errorHref: null, channel: "stack", attributes: { "log.level": "error", "log.message": base.message, "log.context": base.context }, capture: { isTruncated: false, truncated: [] } } };
  }

  const base = operation();
  if (base.variant !== "operation") throw new Error("Expected operation fixture");
  return { ...listResponse(), telemetryEvent: { ...base, relationships: { traceId: base.traceId, spanId: base.spanId, parentSpanId: base.parentSpanId }, errorHref: "/skyline/errors/error_invoice", attributes: { statement: "select " + "invoice ".repeat(120) }, events: [{ name: "query.completed", timestamp: "2026-08-05T12:00:00.001Z", attributes: { rows: 1 } }], links: [{ traceId: "trace_parent", spanId: "span_parent", traceFlags: 1, remote: false, attributes: {} }], resource: { "service.name": "fixture-worker" }, instrumentation: { name: "nickwelsh/skyline", version: "1.0" }, capture: { isTruncated: true, truncated: [{ path: "attributes.statement", originalBytes: 2048 }] } } };
}

function operation(): TelemetryEventsPageDto["telemetryEvents"][number] {
  return { id: operationId, href: `/skyline/logs?event=${operationId}`, variant: "operation", runId: "run_invoice", runHref: "/skyline/runs/run_invoice", attemptNumber: 2, attemptHref: "/skyline/runs/run_invoice?node=attempt_2", jobType: "App\\Jobs\\GenerateMonthlyInvoices", jobHref: "/skyline/jobs/job_invoice", timestamp: "2026-08-05T12:00:00Z", traceId: "trace_invoice", spanId: "span_operation", parentSpanId: "parent_job", level: "TRACE", name: "SELECT invoices", role: "sql", kind: 3, status: "failed", durationUs: 125_000, operationHref: "/skyline/runs/run_invoice?node=span_operation" };
}

function log(): TelemetryEventsPageDto["telemetryEvents"][number] {
  return { id: logId, href: `/skyline/logs?event=${logId}`, variant: "log", runId: "run_invoice", runHref: "/skyline/runs/run_invoice", attemptNumber: 2, attemptHref: "/skyline/runs/run_invoice?node=attempt_2", jobType: "App\\Jobs\\GenerateMonthlyInvoices", jobHref: "/skyline/jobs/job_invoice", timestamp: "2026-08-05T12:00:01Z", traceId: "trace_invoice", spanId: "span_job", parentSpanId: "parent_job", level: "ERROR", message: "Application log context " + "long-value ".repeat(80), context: { provider: "fixture", customer_id: 42 } };
}

const timeRanges = [{ value: "1h" as const, label: "Last hour" }, { value: "24h" as const, label: "Last 24 hours" }, { value: "7d" as const, label: "Last 7 days" }, { value: "30d" as const, label: "Last 30 days" }, { value: "all" as const, label: "All time" }];
function capabilities(): SkylineCapabilities { return fixtureCapabilities; }

async function visuals(page: Page) {
  return page.locator("table").first().evaluate((table) => {
    const header = table.querySelector("th")!; const row = table.querySelector("tbody tr")!; const cell = row.querySelector("td")!;
    const hs = getComputedStyle(header); const rs = getComputedStyle(row); const cs = getComputedStyle(cell);
    return { tableTag: table.tagName, headerTag: table.querySelector("thead")?.tagName, bodyTag: table.querySelector("tbody")?.tagName, headerFontSize: hs.fontSize, headerFontWeight: hs.fontWeight, headerPaddingTop: hs.paddingTop, headerPaddingBottom: hs.paddingBottom, rowPosition: rs.position, cellFontSize: cs.fontSize };
  });
}

async function detailVisuals(detail: Locator) {
  return detail.evaluate((detail) => {
    let panel: HTMLElement | null = detail.parentElement;
    while (panel && panel.previousElementSibling?.getAttribute("role") !== "separator") {
      panel = panel.parentElement;
    }
    if (!panel) throw new Error("Telemetry-event detail panel is unavailable.");
    const handle = panel.previousElementSibling as HTMLElement;
    const layout = getComputedStyle(detail).display === "grid" ? detail : detail.firstElementChild!;
    const title = detail.querySelector("h2")!; const style = getComputedStyle(title);
    return { width: Math.round(panel.getBoundingClientRect().width), handleWidth: getComputedStyle(handle).width, titleFontSize: style.fontSize, titleFontWeight: style.fontWeight, rows: getComputedStyle(layout).gridTemplateRows.split(" ").length };
  });
}

async function focusSignature(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return { tag: active?.tagName, role: active?.getAttribute("role"), text: active?.textContent?.trim() };
  });
}
