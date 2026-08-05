import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { FixtureAdapter } from "../../resources/js/skyline/FixtureAdapter";
import type { InspectorDto, TracePageDto } from "../../resources/js/skyline/dto";
import oracle from "./fixtures/nw-218-trigger-run-detail.json" with { type: "json" };
import inspectorOracle from "./fixtures/nw-220-external-inspectors.json" with { type: "json" };
import triggerInspectorBaseline from "./fixtures/nw-220-trigger-inspector-baseline.json" with { type: "json" };

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
const rootNodeId = `run_${runId}`;
const failedAttemptId = `attempt_${runId}_1`;

test("paired Run detail scenario preserves navigation, URL state, focus, semantics, and geometry", async ({ page }) => {
  const sourceRoute = readFileSync(new URL("../../../trigger.dev/apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx", import.meta.url));
  expect(createHash("sha256").update(sourceRoute).digest("hex")).toBe(oracle.sourceRouteSha256);
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId, "cursor=opaque");
  detail.attempts[0].finishedAt = null;
  detail.attempts[0].queueDurationUs = null;
  await routeDetail(page, detail, (nodeId) => adapter.inspector(nodeId, runId));
  await page.setViewportSize(oracle.viewport);
  await page.goto(`${oracle.path}?tableState=cursor%3Dopaque`);

  await expect(page.getByRole("heading", { name: oracle.expected.heading })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Runs" })).toHaveAttribute("href", "/skyline/runs?cursor=opaque");
  const tree = page.getByRole("tree", { name: oracle.expected.treeName });
  await expect(tree).toBeVisible();
  await expect(tree).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`node=${oracle.expected.selectedNode}`));
  for (const tab of oracle.expected.inspectorTabs) {
    await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
  }
  await expect(page.locator('[data-timeline-event="Dequeued"]')).toBeVisible();
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Attempts" }).locator("+ dd")).toHaveText("2");
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Triggered" }).locator("+ dd")).toHaveText("2026-08-04T20:01:21.000000000Z");
  await expect(page.getByRole("link", { name: /Child:/ })).toHaveAttribute("href", /\/skyline\/runs\/run_01J8R4H9S9J12V04CNH6F6JQ3M/);
  await page.locator('[data-node-id="run_run_01J8R4H9S9J12V04CNH6F6JQ3M"]').click();
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Run" }).locator("+ dd")).toHaveText("run_01J8R4H9S9J12V04CNH6F6JQ3M");
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Job type" }).locator("+ dd")).toHaveText("—");
  await page.locator(`[data-node-id="${rootNodeId}"]`).click();
  await page.keyboard.press("w");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toHaveCount(0);
  await page.keyboard.press("e");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toBeVisible();
  await page.getByRole("button", { name: "Collapse GenerateMonthlyInvoices" }).click({ modifiers: ["Alt"] });
  await expect(page.locator(`[data-node-id="${failedAttemptId}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: "Expand GenerateMonthlyInvoices" }).click({ modifiers: ["Alt"] });

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(new RegExp(`node=${oracle.expected.nextNode}`));
  await expect(page.getByText("Illuminate\\Database\\DeadlockException", { exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Finished" }).locator("+ dd")).toHaveText("—");
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Queue duration" }).locator("+ dd")).toHaveText("—");

  const timeline = page.locator("[data-timeline-root]");
  const attempt = page.locator(`[data-timeline-node-id="${failedAttemptId}"]`);
  const timelineBox = await timeline.boundingBox();
  const attemptBox = await attempt.boundingBox();
  expect(timelineBox).not.toBeNull();
  expect(attemptBox).not.toBeNull();
  expect(attemptBox!.width / timelineBox!.width).toBeCloseTo(oracle.expected.queueHiddenAttemptRatio, 3);

  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/node=/);
  await expect(page.getByRole("tabpanel")).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`node=${failedAttemptId}`));
  await page.goForward();
  await expect(page).not.toHaveURL(/node=/);

  await page.getByRole("switch", { name: "Queue time" }).click();
  await expect(page.getByRole("switch", { name: "Queue time" })).toHaveAttribute("aria-checked", "true");
  await page.getByPlaceholder("Search logs…").fill("insert into");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toBeVisible();
  await expect(page.locator(`[data-node-id="${failedAttemptId}"]`)).toHaveCount(0);
  await page.locator('[data-node-id="span_4f24adb545b26d31"]').click();
  await page.getByRole("tab", { name: "Detail" }).click();
  await expect(page.getByRole("region", { name: "SQL" })).toContainText("insert into `invoices`");
  await expect(page.getByRole("link", { name: "Telemetry event" })).toHaveAttribute("href", /\/skyline\/api\/runs\//);
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(page).not.toHaveURL(/node=/);
});

test("active Run polls while preserving selection and interaction state", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  detail.run.status = "running";
  detail.trace.rootStatus = "executing";
  detail.trace.polling = true;
  detail.trace.pollIntervalMs = 50;
  let traceRequests = 0;
  await routeDetail(page, detail, async (nodeId) => adapter.inspector(nodeId, runId), () => {
    traceRequests += 1;
    const response = structuredClone(detail);
    response.trace.revision = traceRequests;
    response.generatedAt = `2026-08-04T20:02:0${traceRequests}.000000000Z`;
    return response;
  });

  await page.goto(`/skyline/runs/${runId}?node=${failedAttemptId}`);
  await page.getByRole("switch", { name: "Errors only" }).click();
  await page.getByRole("tab", { name: "Metadata" }).click();
  await expect.poll(() => traceRequests).toBeGreaterThan(1);
  await expect(page).toHaveURL(new RegExp(`node=${failedAttemptId}`));
  await expect(page.getByRole("switch", { name: "Errors only" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("tab", { name: "Metadata" })).toHaveAttribute("aria-selected", "true");
});

test("Run detail preserves loading, stale-refresh, API-error, and not-found treatments", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  let mode: "found" | "error" | "not-found" = "found";
  let requests = 0;
  await page.route("**/skyline/api/runs/**", async (route) => {
    if (route.request().url().includes("/nodes/")) {
      await route.fulfill({ json: { node: await adapter.inspector(rootNodeId, runId) } });
      return;
    }
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (mode === "error") return route.fulfill({ status: 500, json: { error: { message: "Telemetry unavailable." } } });
    if (mode === "not-found") return route.fulfill({ status: 404, json: { error: { message: "The Run was not found." } } });
    await route.fulfill({ json: detail });
  });

  await page.goto(`/skyline/runs/${runId}`);
  await expect(page.getByLabel("Loading Run")).toBeVisible();
  await expect(page.getByRole("heading", { name: runId })).toBeVisible();

  mode = "error";
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Refreshing Run…")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Telemetry unavailable.");

  mode = "not-found";
  await page.goto(`/skyline/runs/${runId}?missing=1`);
  await expect(page.getByRole("heading", { name: "Run not found" })).toBeVisible();
  expect(requests).toBeGreaterThan(2);
});

test("queue time outside represented coordinates cannot distort timeline", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  detail.trace.queuedDurationUs = 90_000_000;
  detail.run.queueDurationUs = 90_000_000;
  await routeDetail(page, detail, (nodeId) => adapter.inspector(nodeId, runId));
  await page.goto(`/skyline/runs/${runId}`);

  const timeline = page.locator("[data-timeline-root]");
  const attempt = page.locator(`[data-timeline-node-id="${failedAttemptId}"]`);
  const timelineBox = await timeline.boundingBox();
  const attemptBox = await attempt.boundingBox();
  expect(timelineBox).not.toBeNull();
  expect(attemptBox).not.toBeNull();
  expect(attemptBox!.width / timelineBox!.width).toBeCloseTo(2_050 / (14_988 * 1.05), 4);
});

test("adjacent Run shortcut replaces an equal-sized trace without stale tree state", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const first = await adapter.trace(runId);
  const nextId = first.navigation.nextRunId!;
  const next = await adapter.trace(nextId);
  await page.route("**/skyline/api/runs/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const nodeMatch = path.match(/\/nodes\/([^/]+)$/);
    if (nodeMatch) {
      const selectedRunId = path.split("/runs/")[1].split("/")[0];
      await route.fulfill({ json: { node: await adapter.inspector(decodeURIComponent(nodeMatch[1]), selectedRunId) } });
      return;
    }
    await route.fulfill({ json: path.includes(nextId) ? next : first });
  });
  await page.goto(`/skyline/runs/${runId}`);
  const historyLength = await page.evaluate(() => history.length);
  await page.keyboard.press("k");

  await expect(page).toHaveURL(new RegExp(`/skyline/runs/${nextId}`));
  await expect(page.getByRole("heading", { name: nextId })).toBeVisible();
  await expect(page.locator(`[data-node-id="run_${nextId}"]`)).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test("long inspector metadata remains readable in the constrained panel", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  detail.trace.isTruncated = true;
  const longValue = "long-payload-".repeat(300);
  await routeDetail(page, detail, async (nodeId) => {
    const inspector = await adapter.inspector(nodeId, runId);
    inspector.metadata.value = { payload: longValue };
    return inspector;
  });
  await page.setViewportSize({ width: 1024, height: 480 });
  await page.goto(`/skyline/runs/${runId}?node=${rootNodeId}&tab=metadata`);

  await expect(page.getByText(/^Showing \d+ of \d+ nodes$/)).toBeVisible();
  const metadata = page.getByRole("tabpanel", { name: "Metadata" }).locator("pre");
  await expect(metadata).toContainText("long-payload-long-payload");
  expect(await metadata.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test("paired external and custom inspectors preserve visible, interaction, focus, and accessibility behavior", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const source of Object.values(triggerInspectorBaseline.sourceFiles)) {
    const contents = readFileSync(new URL(`../../../trigger.dev/${source.path}`, import.meta.url));
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  let activeCase = inspectorOracle.cases[0].key;
  await routeDetail(page, detail, async (nodeId) => {
    const inspector = await adapter.inspector(nodeId, runId);
    inspector.presentation = inspectorPresentation(activeCase);
    inspector.metadata.value = activeCase === "generic" ? { recorded: true, role: "framework" } : inspector.metadata.value;
    return inspector;
  });
  await page.setViewportSize(inspectorOracle.viewport);

  for (const scenario of inspectorOracle.cases) {
    activeCase = scenario.key;
    await page.goto(`/skyline/runs/${runId}?node=${rootNodeId}&tab=detail&fixture=${scenario.key}`);
    const detailRegion = page.getByRole("region", { name: `${scenario.heading} detail` });
    await expect(detailRegion).toBeVisible();
    for (const value of scenario.visible) await expect(detailRegion).toContainText(value);

    const wrap = page.getByRole("button", { name: `Wrap ${scenario.preview}` });
    await wrap.focus();
    await expect(wrap).toBeFocused();
    await wrap.click();
    await expect(page.getByRole("button", { name: `Unwrap ${scenario.preview}` })).toBeVisible();

    if (scenario.key === "process") {
      await expectIndependentInspectorScrolling(page, scenario.preview);
    }

    const copy = page.getByRole("button", { name: `Copy ${scenario.preview}` });
    await copy.click();
    await expect(copy).toHaveAttribute("title", "Copied");

    const expand = page.getByRole("button", { name: `Expand ${scenario.preview}` });
    await expand.focus();
    await expand.click();
    const dialog = page.getByRole("dialog", { name: `Expanded ${scenario.preview}` });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(expand).toBeFocused();
  }
});

async function routeDetail(
  page: Page,
  detail: TracePageDto,
  inspector: (nodeId: string) => Promise<InspectorDto>,
  trace: () => TracePageDto | Promise<TracePageDto> = () => detail,
) {
  await page.route("**/skyline/api/runs/**", async (route) => {
    const match = new URL(route.request().url()).pathname.match(/\/nodes\/([^/]+)$/);
    if (match) {
      await route.fulfill({ json: { node: await inspector(decodeURIComponent(match[1])) } });
      return;
    }
    await route.fulfill({ json: await trace() });
  });
}

function inspectorPresentation(key: string): NonNullable<InspectorDto["presentation"]> {
  const timing = { startedAt: "2026-08-05T12:00:00.000000000Z", endedAt: "2026-08-05T12:00:00.125000000Z", durationUs: 125_000 };
  const captured = (value: unknown) => ({ type: Array.isArray(value) ? "array" : "string", value, originalBytes: JSON.stringify(value).length, truncated: false });

  switch (key) {
    case "http":
      return { type: "http", timing, failure: null, http: { method: "POST", url: "https://api.example.test/people", statusCode: 201, request: { headers: { items: { Accept: ["application/json"] }, truncated: false }, body: { value: '{"name":"Laravel"}', contentType: "application/json", originalBytes: 18, truncated: false, isJson: true, json: { name: "Laravel" } } }, response: { headers: null, body: null } } };
    case "delivery":
      return { type: "delivery", timing, failure: null, delivery: { kind: "notification", messageType: "InvoiceReady", transportOrChannel: "slack", recipientCount: 1, outcome: "sent", recipients: null, recipientIdentity: null, subject: null, text: null, html: null, messageData: null, operationData: captured({ route: "billing" }) } };
    case "storage":
      return { type: "storage", timing, failure: { type: "UnableToReadFile", message: "Unable to read file" }, storage: { operation: "read", disk: "documents", driver: "local", path: "private/report.txt", pathCaptured: true, destination: null, destinationCaptured: false, bytes: null, outcome: "failed", url: null, destinationUrl: null, localFile: null, destinationLocalFile: null, content: captured("captured content"), result: { exists: null, lastModified: null, mimeType: null, visibility: null } } };
    case "process":
      return { type: "process", timing, failure: null, process: { executable: "php", async: false, timeoutSeconds: 10, exitCode: 0, timedOut: false, outcome: "completed", command: captured(["php", "artisan", "queue:work"]), environment: null, input: null, stdout: captured(longProcessOutput()), stderr: captured("warning") } };
    case "breadcrumb":
      return { type: "breadcrumb", breadcrumb: { timestamp: timing.startedAt, level: "warning", channel: "stack", message: "Import delayed", context: { code: 429 } } };
    case "custom":
      return { type: "custom", timing, failure: null, custom: { name: "Generate PDF", attributes: { pages: 12 } } };
    case "summary":
      return { type: "summary", summary: { resources: { peakMemoryBytes: 1_048_576, memoryDeltaBytes: 1_024, cpuTimeUs: 1_250 }, operations: { http: { count: 2, durationMs: 25 } } } };
    default:
      return { type: "generic", timing, failure: null };
  }
}

function longProcessOutput(): string {
  return Array.from(
    { length: triggerInspectorBaseline.contract.capture.visibleLineLimit * 6 },
    (_, index) => `processed record ${String(index + 1).padStart(3, "0")} with independently scrollable inspector evidence`,
  ).join("\n");
}

async function expectIndependentInspectorScrolling(page: Page, previewLabel: string): Promise<void> {
  expect(triggerInspectorBaseline.contract.inspector.overflowY).toBe("auto");
  expect(triggerInspectorBaseline.contract.capture.overflowY).toBe("auto");
  expect(triggerInspectorBaseline.contract.capture.copy).toBe(true);
  expect(triggerInspectorBaseline.contract.capture.wrap).toBe(true);
  expect(triggerInspectorBaseline.contract.capture.expand).toBe(true);
  expect(triggerInspectorBaseline.contract.capture.focusManagedDialog).toBe(true);

  const inspector = page.getByRole("tabpanel", { name: "Detail" });
  const capture = page.getByRole("region", { name: `${previewLabel} preview` }).locator("pre");
  const inspectorGeometry = await inspector.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  const captureGeometry = await capture.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  expect(inspectorGeometry.overflowY).toBe(triggerInspectorBaseline.contract.inspector.overflowY);
  expect(inspectorGeometry.scrollHeight).toBeGreaterThan(inspectorGeometry.clientHeight);
  expect(captureGeometry.overflowY).toBe(triggerInspectorBaseline.contract.capture.overflowY);
  expect(captureGeometry.scrollHeight).toBeGreaterThan(captureGeometry.clientHeight);

  const inspectorStart = await inspector.evaluate((element) => element.scrollTop);
  await capture.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const captureScrolled = await capture.evaluate((element) => element.scrollTop);
  expect(captureScrolled).toBeGreaterThan(0);
  await expect.poll(() => inspector.evaluate((element) => element.scrollTop)).toBe(inspectorStart);

  await inspector.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => inspector.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await capture.evaluate((element) => element.scrollTop)).toBe(captureScrolled);
}
