import { expect, test, type Page } from "@playwright/test";
import { FixtureAdapter } from "../../resources/js/skyline/FixtureAdapter";
import type { InspectorDto, TracePageDto } from "../../resources/js/skyline/dto";
import oracle from "./fixtures/nw-218-trigger-run-detail.json" with { type: "json" };

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
const rootNodeId = `run_${runId}`;
const failedAttemptId = `attempt_${runId}_1`;

test("paired Run detail scenario preserves navigation, URL state, focus, semantics, and geometry", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId, "cursor=opaque");
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
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Attempts" }).locator("+ dd")).toHaveText("2");
  await expect(page.getByRole("link", { name: /Child:/ })).toHaveAttribute("href", /\/skyline\/runs\/run_01J8R4H9S9J12V04CNH6F6JQ3M/);

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(new RegExp(`node=${oracle.expected.nextNode}`));
  await expect(page.getByText("Illuminate\\Database\\DeadlockException", { exact: true })).toBeVisible();

  const timeline = page.locator("[data-timeline-root]");
  const attempt = page.locator(`[data-timeline-node-id="${failedAttemptId}"]`);
  const timelineBox = await timeline.boundingBox();
  const attemptBox = await attempt.boundingBox();
  expect(timelineBox).not.toBeNull();
  expect(attemptBox).not.toBeNull();
  expect(attemptBox!.width / timelineBox!.width).toBeCloseTo(oracle.expected.queueHiddenAttemptRatio, 4);

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
  expect(attemptBox!.width / timelineBox!.width).toBeCloseTo(2_050 / 14_988, 4);
});

test("long inspector metadata remains readable in the constrained panel", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  const longValue = "long-payload-".repeat(300);
  await routeDetail(page, detail, async (nodeId) => {
    const inspector = await adapter.inspector(nodeId, runId);
    inspector.metadata.value = { payload: longValue };
    return inspector;
  });
  await page.setViewportSize({ width: 1024, height: 480 });
  await page.goto(`/skyline/runs/${runId}?node=${rootNodeId}&tab=metadata`);

  const metadata = page.getByRole("tabpanel", { name: "Metadata" }).locator("pre");
  await expect(metadata).toContainText("long-payload-long-payload");
  expect(await metadata.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
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
