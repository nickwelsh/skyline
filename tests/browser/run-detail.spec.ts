import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { FixtureAdapter } from "../../resources/js/skyline/FixtureAdapter";
import type { InspectorDto, TracePageDto } from "../../resources/js/skyline/dto";
import oracle from "./fixtures/nw-218-trigger-run-detail.json" with { type: "json" };
import inspectorOracle from "./fixtures/nw-220-external-inspectors.json" with { type: "json" };
import triggerInspectorBaseline from "./fixtures/nw-220-trigger-inspector-baseline.json" with { type: "json" };
import stateInspectorOracle from "./fixtures/nw-223-database-state-inspectors.json" with { type: "json" };
import failureScenario from "./fixtures/nw-222-failure-scenario.json" with { type: "json" };
import triggerFailureBaseline from "./fixtures/nw-222-trigger-failure-baseline.json" with { type: "json" };
import { createFirstResponseGate } from "./support/deferred-response";
import { readPinnedTriggerSource } from "./support/pinned-trigger-source";
import { applyRunState } from "../fidelity/support/run-states";

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
const rootNodeId = `run_${runId}`;
const failedAttemptId = `attempt_${runId}_1`;

test("paired Run detail scenario preserves navigation, URL state, focus, semantics, and geometry", async ({ page }) => {
  const sourceRoute = readPinnedTriggerSource("apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx");
  expect(createHash("sha256").update(sourceRoute).digest("hex")).toBe(oracle.sourceRouteSha256);
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId, "cursor=opaque");
  detail.attempts[0].finishedAt = null;
  detail.attempts[0].queueDurationUs = null;
  await routeDetail(page, detail, (nodeId) => adapter.inspector(nodeId, runId));
  await page.setViewportSize(oracle.viewport);
  await page.goto(`${oracle.path}?tableState=cursor%3Dopaque`);

  await expect(page.getByRole("heading", { name: oracle.expected.heading })).toBeVisible();
  await expect(page.getByRole("button", { name: runId, exact: true })).toBeVisible();
  await expect(page.getByLabel("Previous Run")).toBeVisible();
  await expect(page.getByLabel("Next Run")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh" })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Runs" })).toHaveAttribute("href", "/skyline/runs?cursor=opaque");
  const tree = page.getByRole("tree", { name: oracle.expected.treeName });
  await expect(tree).toBeVisible();
  await expect(tree).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`node=${oracle.expected.selectedNode}`));
  await expect(page.locator(`[data-node-id="${rootNodeId}"] p > span.flex > span.truncate`)).toHaveText("GenerateMonthlyInvoices");
  const closeInspector = page.getByRole("button", { name: "Esc", exact: true });
  await expect(closeInspector).toBeVisible();
  await expect(closeInspector.locator("svg")).toHaveCount(1);
  for (const tab of oracle.expected.inspectorTabs) {
    await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
  }
  await expect(page.locator('[data-timeline-event="Dequeued"]')).toBeVisible();
  await expect(page.getByRole("tabpanel")).toContainText("Completed");
  await expect(page.getByRole("tabpanel")).toContainText("Triggered");
  await expect(page.getByRole("tabpanel")).toContainText("Dequeued");
  await page.getByRole("tabpanel").getByText("Triggered", { exact: true }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("The run was triggered");
  await expect(page.getByRole("link", { name: /Child:/ })).toHaveAttribute("href", /\/skyline\/runs\/run_01J8R4H9S9J12V04CNH6F6JQ3M/);
  await page.locator('[data-node-id="run_run_01J8R4H9S9J12V04CNH6F6JQ3M"]').click();
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Run" }).locator("+ dd")).toHaveText("run_01J8R4H9S9J12V04CNH6F6JQ3M");
  await expect(page.getByRole("tabpanel").locator("dt", { hasText: "Job type" }).locator("+ dd")).toHaveText("—");
  await page.locator(`[data-node-id="${rootNodeId}"]`).click();
  await page.keyboard.press("w");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toHaveCount(0);
  await page.keyboard.press("e");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toBeVisible();
  const rootTreeItem = tree.getByRole("treeitem", { name: /GenerateMonthlyInvoices Root/ });
  await rootTreeItem.click({ modifiers: ["Alt"], position: { x: 8, y: 16 } });
  await expect(page.locator(`[data-node-id="${failedAttemptId}"]`)).toHaveCount(0);
  await rootTreeItem.click({ modifiers: ["Alt"], position: { x: 8, y: 16 } });
  await expect(page.locator(`[data-node-id="${failedAttemptId}"]`)).toBeVisible();
  await expect(page.locator('[data-node-id="span_a866b446b5df56e3"]')).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(new RegExp(`node=${oracle.expected.nextNode}`));
  await expect(page.getByText("Illuminate\\Database\\DeadlockException", { exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("Finished", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tabpanel").getByText("Queue duration", { exact: true })).toHaveCount(0);

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
  const sourceInspector = page.getByLabel("Run inspector");
  await expect(sourceInspector.getByRole("tablist")).toHaveCount(0);
  await expect(sourceInspector).toContainText("insert into `invoices`");
  await expect(sourceInspector.getByRole("link", { name: "Telemetry event" })).toHaveCount(0);
  await expect(sourceInspector.getByRole("region", { name: "Span evidence" })).toHaveCount(0);
  await sourceInspector.getByRole("button", { name: "Expand Properties" }).click();
  const sourcePropertiesDialog = page.getByRole("dialog");
  const sourceSpanEvidence = sourcePropertiesDialog.getByRole("region", { name: "Span evidence" });
  await expect(sourceSpanEvidence).toBeVisible();
  await expect(sourceSpanEvidence.getByRole("link", { name: "Telemetry event" })).toHaveAttribute("href", /\/skyline\/api\/runs\//);
  await sourcePropertiesDialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Esc", exact: true }).click();
  await expect(page).not.toHaveURL(/node=/);
});

test("Run panel layout persists through the external preference adapter", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  await routeDetail(page, detail, (nodeId) => adapter.inspector(nodeId, runId));
  await page.goto(`/skyline/runs/${runId}?node=${rootNodeId}`);

  const tree = page.locator('[data-splitter-id="tree"]');
  const handle = page.locator('[data-splitter-id="tree-handle"]');
  await expect.poll(() => page.evaluate(() => localStorage.getItem("panel-run-tree"))).toBeNull();
  await expect(tree).toBeVisible();
  const before = await tree.boundingBox();
  const handleBox = await handle.boundingBox();
  expect(before).not.toBeNull();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 20);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 120, handleBox!.y + 20, { steps: 5 });
  await page.mouse.up();

  const resized = await tree.boundingBox();
  expect(resized!.width).toBeGreaterThan(before!.width + 80);
  await expect.poll(() => page.evaluate(() => {
    const value = localStorage.getItem("skyline.ui-preferences.v1:/skyline");
    return value ? JSON.parse(value).panels?.["panel-run-tree"] : null;
  })).not.toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("panel-run-tree"))).toBeNull();
  await page.reload();
  await expect(tree).toBeVisible();
  await expect.poll(async () => (await tree.boundingBox())?.width).toBeGreaterThan(before!.width + 80);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("panel-run-tree"))).toBeNull();
});

test("paired failed Attempt inspection preserves captured evidence and Trigger interactions", async ({ page, browser }) => {
  test.setTimeout(30_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const source of Object.values(triggerFailureBaseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }

  const referenceContext = await browser.newContext();
  const referencePage = await referenceContext.newPage();
  await referencePage.setViewportSize(failureScenario.viewport);
  await referencePage.goto("http://127.0.0.1:4175");
  const triggerBehavior = await exercisePinnedTriggerFailure(referencePage);
  await referenceContext.close();

  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  const retryId = `attempt_${runId}_2`;
  detail.attempts[1].status = "failed";
  detail.attempts[1].failure = { class: "LogicException", message: "Retry failed differently.", messageTruncated: false };
  const retryNode = detail.trace.nodes.find((node) => node.id === retryId)!;
  retryNode.status = "failed";
  retryNode.isError = true;

  await routeDetail(page, detail, async (nodeId) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const inspector = await adapter.inspector(nodeId, runId);
    if (nodeId === retryId) {
      inspector.exception = structuredClone(failureScenario.retrySkylineException) as InspectorDto["exception"];
    } else if (inspector.exception) {
      inspector.exception = structuredClone(failureScenario.skylineException) as InspectorDto["exception"];
    }
    return inspector;
  });

  await page.goto(`/skyline/runs/${runId}?node=${failedAttemptId}`);
  await expect(page.getByLabel("Loading inspector")).toBeVisible();
  const skylineBehavior = await exerciseFailureSurface(page);
  expect(skylineBehavior.shared).toEqual(triggerBehavior.shared);
  expect(skylineBehavior.visual).toEqual(triggerBehavior.visual);
  expect(triggerBehavior.interaction).toMatchObject({ expandFocusable: true, dialogOpened: true, escapeClosed: true, focusReturned: false });
  expect(skylineBehavior).toMatchObject({ dialogClosed: true, inspectorOpen: true, stackFocusReturned: true, traceScrollable: true, copied: "Copied" });

  await page.getByRole("switch", { name: "Errors only" }).click();
  await page.locator(`[data-node-id="${failedAttemptId}"]`).click();
  const tree = page.getByRole("tree", { name: "Run trace" });
  await tree.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/node=span_17ba81b7da8f8b64/);
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(new RegExp(`node=${retryId}`));
  await expect(page.getByLabel("Loading inspector")).toBeVisible();
  const exception = page.getByRole("region", { name: "Exception" });
  await expect(exception.locator("..")).toContainText("Retry failed differently.");
  await exception.getByRole("button", { name: "Expand exception stack trace" }).click();
  const retryEvidence = page.getByRole("dialog").getByRole("region", { name: "exception stack trace" });
  await expect(retryEvidence).toContainText("app/Jobs/FinalizeInvoices.php:73");
  await expect(retryEvidence).toContainText("Show 2 frames");
  await expect(retryEvidence).not.toContainText("Source location not captured");
  await expect(retryEvidence).not.toContainText("Stack trace not captured");
  await expect(retryEvidence).not.toContainText("DeadlockException");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(retryEvidence).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`node=${retryId}`));
  await expect(page.getByRole("region", { name: "Exception" }).locator("..")).toContainText("Retry failed differently.");
});

test("failed Attempt inspector reports request, copy, and source-link outcomes", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  let requestFails = true;
  await routeDetail(page, detail, async (nodeId) => {
    if (requestFails) throw new Error("Exception evidence unavailable.");
    const inspector = await adapter.inspector(nodeId, runId);
    inspector.exception = structuredClone(failureScenario.skylineException) as InspectorDto["exception"];
    return inspector;
  });

  await page.goto(`/skyline/runs/${runId}?node=${failedAttemptId}`);
  await expect(page.getByRole("alert")).toContainText("Exception evidence unavailable.");

  requestFails = false;
  await page.reload();
  await page.getByRole("button", { name: "Expand exception stack trace" }).click();
  const source = page.getByRole("link", { name: "app/Jobs/GenerateMonthlyInvoices.php:58" });
  await expect(source).toHaveAttribute("href", "https://example.test/source/app/Jobs/GenerateMonthlyInvoices.php#L58");
  await expect(source).toHaveAttribute("title", "Open app/Jobs/GenerateMonthlyInvoices.php:58 in editor");
  await source.focus();
  await expect(source).toBeFocused();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  const copy = page.getByRole("button", { name: "Copy exception as Markdown" });
  await copy.click();
  await expect(copy).toContainText("Copy failed");
  await expect(copy).toHaveAttribute("title", "Copy failed");
});

async function exerciseFailureSurface(page: Page) {
  const exception = page.getByRole("region", { name: "Exception" });
  const panel = exception.locator("..");
  await expect(panel).toContainText("Illuminate\\Database\\DeadlockException");
  await expect(panel).toContainText("Deadlock found when trying to get lock; retry transaction");
  const shared = {
    heading: await panel.getByRole("heading", { level: 3 }).textContent(),
    message: failureScenario.skylineException.message,
    containerClass: await panel.getAttribute("class"),
    headingTag: await panel.getByRole("heading", { level: 3 }).evaluate((element) => element.tagName),
  };
  const visual = await failureVisuals(panel);

  const expandStack = exception.getByRole("button", { name: "Expand exception stack trace" });
  await expandStack.focus();
  await page.keyboard.press("Enter");
  const stackDialog = page.getByRole("dialog");
  await expect(stackDialog).toBeVisible();
  const evidence = stackDialog.getByRole("region", { name: "exception stack trace" });

  const source = evidence.getByRole("link", { name: "app/Jobs/GenerateMonthlyInvoices.php:58" }).first();
  await source.focus();
  await expect(source).toBeFocused();

  const traceButton = evidence.locator('button[aria-controls="exception-trace"]');
  const initialTraceExpanded = await traceButton.getAttribute("aria-expanded");
  await traceButton.focus();
  await expect(traceButton).toBeFocused();
  await traceButton.click();
  const tracePanelId = await traceButton.getAttribute("aria-controls");
  const tracePanel = evidence.locator(`#${tracePanelId}`);
  await expect(tracePanel).toBeVisible();

  const application = evidence.getByRole("button", { name: "App\\Jobs\\GenerateMonthlyInvoices->handle" });
  const applicationPanelId = await application.getAttribute("aria-controls");
  await expect(evidence.locator(`#${applicationPanelId}`)).toBeVisible();
  await traceButton.focus();
  await page.keyboard.press("Tab");
  await expect(application).toBeFocused();

  const vendor = evidence.getByRole("button", { name: "1 vendor frame" });
  const initialVendorExpanded = await vendor.getAttribute("aria-expanded");
  await vendor.click();
  const vendorPanelId = await vendor.getAttribute("aria-controls");
  const vendorPanel = evidence.locator(`#${vendorPanelId}`);
  await expect(vendorPanel).toContainText("Illuminate\\Queue\\CallQueuedHandler->call");

  const copy = evidence.getByRole("button", { name: "Copy exception as Markdown" });
  await copy.click();
  await expect(copy).toContainText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(failureScenario.skylineException.markdown);

  const wrap = evidence.getByRole("button", { name: "Wrap application frame 1" });
  await wrap.click();
  await expect(evidence.getByRole("button", { name: "Unwrap application frame 1" })).toBeVisible();
  await expect(evidence.getByRole("button", { name: "Expand application frame 1" })).toHaveCount(0);

  const evidenceResult = {
    shared,
    visual,
    sourceHref: await source.getAttribute("href"),
    sourceTitle: await source.getAttribute("title"),
    initialTraceExpanded,
    tracePanelId,
    traceExpanded: await traceButton.getAttribute("aria-expanded"),
    applicationPanelId,
    applicationExpanded: await application.getAttribute("aria-expanded"),
    initialVendorExpanded,
    vendorPanelId,
    vendorExpanded: await vendor.getAttribute("aria-expanded"),
    copied: (await copy.textContent())?.trim(),
    wrapped: await evidence.getByRole("button", { name: "Unwrap application frame 1" }).isVisible(),
    traceScrollable: await tracePanel.evaluate((element) => element.scrollHeight > element.clientHeight),
  };
  await page.keyboard.press("Escape");
  await expect(evidence).toHaveCount(0);
  await expect(page.getByLabel("Run inspector")).toBeVisible();
  await expect(expandStack).toBeFocused();
  return {
    ...evidenceResult,
    dialogClosed: true,
    inspectorOpen: true,
    stackFocusReturned: true,
  };
}

async function exercisePinnedTriggerFailure(page: Page) {
  const heading = page.getByRole("heading", { name: failureScenario.triggerError.name, level: 3 });
  await expect(heading).toBeVisible();
  const container = heading.locator("..");
  await expect(container).toContainText(failureScenario.triggerError.message);
  await expect(container).toContainText("app/Jobs/GenerateMonthlyInvoices.php:58");

  const expand = container.getByRole("button").first();
  await expand.focus();
  const expandFocusable = await expand.evaluate((element) => element === document.activeElement);
  await expand.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dialogOpened = await dialog.isVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  return {
    shared: {
      heading: await heading.textContent(),
      message: failureScenario.triggerError.message,
      containerClass: await container.getAttribute("class"),
      headingTag: await heading.evaluate((element) => element.tagName),
    },
    visual: await failureVisuals(container),
    interaction: {
      expandFocusable,
      dialogOpened,
      escapeClosed: await dialog.count() === 0,
      focusReturned: await expand.evaluate((element) => element === document.activeElement),
    },
  };
}

async function failureVisuals(container: ReturnType<Page["locator"]>) {
  return container.evaluate((element) => {
    const heading = element.querySelector("h3")!;
    const containerStyle = getComputedStyle(element);
    const headingStyle = getComputedStyle(heading);
    return {
      borderStyle: containerStyle.borderTopStyle,
      borderRadius: containerStyle.borderTopLeftRadius,
      paddingTop: containerStyle.paddingTop,
      headingFontSize: headingStyle.fontSize,
      headingFontWeight: headingStyle.fontWeight,
    };
  });
}

test("active Run polls while preserving selection and interaction state", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  applyRunState(detail, "running");
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
  await page.locator(`[data-node-id="${rootNodeId}"]`).click();
  await expect(page.getByRole("tabpanel").getByText("Finished", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("tabpanel").getByText("Started", { exact: true })).toHaveCount(0);
});

test("Run detail preserves loading, stale-refresh, API-error, and not-found treatments", async ({ page }) => {
  const firstResponse = createFirstResponseGate();
  const refreshResponse = createFirstResponseGate();
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  detail.trace.polling = true;
  detail.trace.pollIntervalMs = 50;
  let mode: "found" | "error" | "not-found" = "found";
  let requests = 0;
  await page.route("**/skyline/api/runs/**", async (route) => {
    if (route.request().url().includes("/nodes/")) {
      await route.fulfill({ json: { node: await adapter.inspector(rootNodeId, runId) } });
      return;
    }
    requests += 1;
    if (requests === 1) await firstResponse.hold();
    else await refreshResponse.hold();
    if (mode === "error") return route.fulfill({ status: 500, json: { error: { message: "Telemetry unavailable." } } });
    if (mode === "not-found") return route.fulfill({ status: 404, json: { error: { message: "The Run was not found." } } });
    await route.fulfill({ json: detail });
  });

  try {
    await page.goto(`/skyline/runs/${runId}?node=${rootNodeId}`);
    await expect(page.getByLabel("Loading Run")).toBeVisible();
  } finally {
    firstResponse.release();
  }
  await expect(page.getByTestId("side-menu")).toBeVisible();
  await expect(page.getByRole("heading", { name: runId })).toBeVisible();

  await expect(page).toHaveURL(/node=/);
  await refreshResponse.waitUntilHeld();
  await expect(page.getByText("Refreshing Run…")).toBeVisible();
  await expect(page.getByLabel("Loading Run")).toBeHidden();
  await expect(page.getByRole("heading", { name: runId })).toBeVisible();
  detail.trace.polling = false;
  refreshResponse.release();
  await expect(page.getByText("Refreshing Run…")).toBeHidden();
  await expect(page.getByLabel("Loading Run")).toBeHidden();
  await expect(page.getByRole("heading", { name: runId })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`node=${rootNodeId}`));

  mode = "error";
  await page.goto(`/skyline/runs/${runId}?api-error=1`);
  await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  await expect(page.getByText("Telemetry unavailable.", { exact: true })).toBeVisible();

  mode = "not-found";
  await page.goto(`/skyline/runs/${runId}?missing=1`);
  await expect(page.getByRole("heading", { name: "404: Page not found" })).toBeVisible();
  await expect(page.getByText("Not Found", { exact: true })).toBeVisible();
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

test("Run timeline controls stay client-side and restore source interactions", async ({ page }) => {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  let traceRequests = 0;
  await routeDetail(page, detail, (nodeId) => adapter.inspector(nodeId, runId), () => {
    traceRequests += 1;
    return detail;
  });
  await page.goto(`/skyline/runs/${runId}?tableState=cursor%3Dopaque&node=${rootNodeId}`);

  await expect(page.getByRole("button", { name: `Add ${runId} to favorites` })).toBeVisible();
  await expect(page.getByLabel("Previous Run").locator("svg")).toHaveClass(/size-3/);
  await expect(page.getByLabel("Next Run").locator("svg")).toHaveClass(/size-3/);
  for (const label of ["Navigate", "Next/previous run", "Expand all", "Collapse all", "Toggle level"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("paragraph").filter({ hasText: /^Queue time$/ })).toBeVisible();

  const timeline = page.locator("[data-timeline-root]");
  const slider = page.getByRole("slider", { name: "Timeline zoom" });
  const widthBefore = (await timeline.boundingBox())!.width;
  const requestsBefore = traceRequests;
  await slider.focus();
  await slider.press("End");
  await expect.poll(async () => (await timeline.boundingBox())!.width).toBeGreaterThan(widthBefore * 2);
  expect(traceRequests).toBe(requestsBefore);
  await expect(page).not.toHaveURL(/scale=/);

  const timelineBox = (await timeline.boundingBox())!;
  await page.mouse.move(timelineBox.x + Math.min(150, timelineBox.width * 0.35), timelineBox.y + 20);
  await expect(page.locator("[data-timeline-playhead]")).toBeVisible();
  await expect(page.locator("[data-timeline-playhead]")).toContainText("–");

  await page.getByRole("switch", { name: "Queue time" }).click();
  for (const event of ["Triggered", "Dequeued", "Started"]) {
    await expect(page.locator(`[data-timeline-event="${event}"]`).first()).toBeVisible();
  }
  await expect(page.locator(`[data-timeline-lifecycle-line="${rootNodeId}"]`)).toBeVisible();

  const overview = page.getByRole("tab", { name: "Overview" });
  const detailTab = page.getByRole("tab", { name: "Detail" });
  const overviewIndicator = overview.locator(".bg-indigo-500");
  const beforeX = (await overviewIndicator.boundingBox())!.x;
  await detailTab.click();
  const detailIndicator = detailTab.locator(".bg-indigo-500");
  await expect(detailIndicator).toBeVisible();
  expect((await detailIndicator.boundingBox())!.x).toBeGreaterThan(beforeX);
  await expect(page.getByRole("tabpanel", { name: "Detail" })).toContainText("Status");
  await expect(page.getByRole("tabpanel", { name: "Detail" }).getByRole("link", { name: "App\\Jobs\\GenerateMonthlyInvoices", exact: true })).toHaveAttribute("href", /\/skyline\/jobs\/job_/);

  await page.getByRole("tab", { name: "Metadata" }).click();
  await expect(page.getByRole("button", { name: "Wrap Metadata" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Metadata" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand Metadata" })).toBeVisible();
  await page.getByRole("button", { name: "Show Metadata tree" }).click();
  await expect(page.getByRole("tree", { name: "Metadata JSON tree" })).toBeVisible();
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
  await page.getByRole("button", { name: "Wrap Metadata" }).click();
  expect(await metadata.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test("paired external and custom inspectors preserve visible, interaction, focus, and accessibility behavior", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const source of Object.values(triggerInspectorBaseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
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
    const detailTab = page.getByRole("tab", { name: "Detail", exact: true });
    const detailRegion = page.getByRole("region", { name: `${scenario.heading} detail` });
    await expect(detailRegion).toBeVisible();
    for (const value of scenario.visible) await expect(detailRegion).toContainText(value);

    const contextExpectation = { http: runId, delivery: "billing", breadcrumb: "429" }[scenario.key];
    const contextTab = page.getByRole("tab", { name: "Context", exact: true });
    await expect(contextTab).toBeVisible();
    await contextTab.click();
    if (contextExpectation) {
      await expect(page.getByRole("tabpanel", { name: "Context" })).toContainText(contextExpectation);
    } else {
      await expect(page.getByRole("tabpanel", { name: "Context" }).locator("pre")).toHaveText("{}");
    }
    await detailTab.click();
    await expect(detailRegion).toBeVisible();

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
    await expect(copy).toHaveClass(/text-success/);

    const expand = page.getByRole("button", { name: `Expand ${scenario.preview}` });
    await expand.focus();
    await expand.click();
    const dialog = page.getByRole("dialog", { name: scenario.key === "generic" ? scenario.preview : `Expanded ${scenario.preview}` });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    if (scenario.key === "generic") await expect(page.getByLabel("Run inspector")).toHaveCount(0);
    else await expect(expand).not.toBeFocused();
  }
});

test("database and state inspectors preserve captured, unavailable, failed, and long evidence", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  expect(stateInspectorOracle.sourceCommit).toBe(triggerInspectorBaseline.sourceCommit);
  for (const source of Object.values(triggerInspectorBaseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  const queryNodeId = "span_4f24adb545b26d31";
  let activeCase = stateInspectorOracle.cases[0].key;
  await routeDetail(page, detail, async (nodeId) => {
    const inspector = await adapter.inspector(nodeId, runId);
    inspector.overview = {
      runId,
      attemptNumber: 1,
      traceId: "00000000000000000000000000000001",
      spanId: "4f24adb545b26d31",
      parentSpanId: "4f24adb545b26d30",
    };
    inspector.source = { file: "app/Jobs/GenerateMonthlyInvoices.php", line: 42, href: "vscode://file//workspace/app/Jobs/GenerateMonthlyInvoices.php:42" };
    inspector.metadata = {
      value: {
        attributes: { "db.namespace": "testing" },
      },
      isTruncated: false,
      truncated: [],
    };
    inspector.timelineEvents = [{ name: "query.completed", offsetUs: 125_000, kind: "event" }];
    inspector.presentation = databaseStatePresentation(activeCase);
    return inspector;
  });
  await page.setViewportSize(stateInspectorOracle.viewport);
  for (const scenario of stateInspectorOracle.cases) {
    activeCase = scenario.key;
    await page.goto(`/skyline/runs/${runId}?node=${queryNodeId}&fixture=${scenario.key}`);
    const inspector = page.getByLabel("Run inspector");
    await expect(inspector.getByText("Completed", { exact: true })).toBeVisible();
    await expect(inspector).toContainText("Message");
    await expect(inspector).toContainText("Properties");
    await expect(inspector.getByRole("tablist")).toHaveCount(0);
    await expect(inspector.getByRole("link", { name: "app/Jobs/GenerateMonthlyInvoices.php:42" })).toHaveCount(0);
    await expect(inspector.getByRole("link", { name: "Telemetry event" })).toHaveCount(0);
    await expect(inspector.getByRole("region", { name: "Span evidence" })).toHaveCount(0);
    await expect(inspector.getByRole("heading", { name: "query.completed", level: 3 })).toBeVisible();
    await expect(inspector.getByRole("region", { name: "Database and state operation inspector" })).toContainText('"db.namespace": "testing"');
    await inspector.getByRole("button", { name: "Expand Properties" }).click();
    const propertiesDialog = page.getByRole("dialog");
    const spanEvidence = propertiesDialog.getByRole("region", { name: "Span evidence" });
    await expect(spanEvidence).toBeVisible();
    await expect(spanEvidence.getByRole("link", { name: "app/Jobs/GenerateMonthlyInvoices.php:42" })).toHaveAttribute("href", "vscode://file//workspace/app/Jobs/GenerateMonthlyInvoices.php:42");
    await expect(spanEvidence.getByRole("link", { name: "Telemetry event" })).toHaveAttribute("href", /\/skyline\/api\/runs\//);
    const detailRegion = propertiesDialog.getByRole("region", { name: `${scenario.heading} detail` });
    await expect(detailRegion).toBeVisible();
    for (const value of scenario.visible) await expect(detailRegion).toContainText(value);
    for (const value of scenario.absent) await expect(detailRegion).not.toContainText(value);

    if (!scenario.preview) {
      await propertiesDialog.getByRole("button", { name: "Close" }).click();
      continue;
    }

    const wrap = page.getByRole("button", { name: `Wrap ${scenario.preview}` });
    await wrap.click();
    await expect(page.getByRole("button", { name: `Unwrap ${scenario.preview}` })).toBeVisible();
    const copy = page.getByRole("button", { name: `Copy ${scenario.preview}` });
    await copy.click();
    await expect(copy).toHaveAttribute("title", "Copied");
    const expand = page.getByRole("button", { name: `Expand ${scenario.preview}` });
    await expand.click();
    const dialog = page.getByRole("dialog", { name: `Expanded ${scenario.preview}` });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(propertiesDialog).toBeVisible();

    if (scenario.key === "sql-captured") {
      await expectCaptureTabKeyboard(page, detailRegion);
      await page.getByRole("tab", { name: "With bindings" }).click();
      await expect(detailRegion).toContainText("[REDACTED]");
      await page.getByRole("tab", { name: "Tree" }).click();
      await expect(page.getByRole("tree", { name: "Result preview JSON tree" })).toBeVisible();
    }
    await propertiesDialog.getByRole("button", { name: "Close" }).click();
  }
});

async function expectCaptureTabKeyboard(page: Page, detailRegion: ReturnType<Page["getByRole"]>) {
  const parameterized = detailRegion.getByRole("tab", { name: "Parameterized" });
  const bindings = detailRegion.getByRole("tab", { name: "With bindings" });
  await expect(parameterized).toHaveAttribute("tabindex", "0");
  await expect(bindings).toHaveAttribute("tabindex", "-1");
  await parameterized.focus();
  await page.keyboard.press("ArrowRight");
  await expect(bindings).toBeFocused();
  await expect(bindings).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(parameterized).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(bindings).toBeFocused();
  await page.keyboard.press("End");
  await expect(bindings).toBeFocused();

  const text = detailRegion.getByRole("tab", { name: "Text" });
  const tree = detailRegion.getByRole("tab", { name: "Tree" });
  await text.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tree).toBeFocused();
  await expect(page.getByRole("tree", { name: "Result preview JSON tree" })).toBeVisible();
}

async function routeDetail(
  page: Page,
  detail: TracePageDto,
  inspector: (nodeId: string) => Promise<InspectorDto>,
  trace: () => TracePageDto | Promise<TracePageDto> = () => detail,
) {
  await page.route("**/skyline/api/runs/**", async (route) => {
    const match = new URL(route.request().url()).pathname.match(/\/nodes\/([^/]+)$/);
    if (match) {
      try {
        await route.fulfill({ json: { node: await inspector(decodeURIComponent(match[1])) } });
      } catch (error) {
        await route.fulfill({ status: 500, json: { error: { message: error instanceof Error ? error.message : "Inspector unavailable." } } });
      }
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

function databaseStatePresentation(key: string): NonNullable<InspectorDto["presentation"]> {
  const timing = { startedAt: "2026-08-05T12:00:00.000000000Z", endedAt: "2026-08-05T12:00:00.125000000Z", durationUs: 125_000 };
  const captured = (value: unknown, truncated = false) => ({ type: Array.isArray(value) ? "array" : "string", value, originalBytes: JSON.stringify(value).length, truncated });

  switch (key) {
    case "sql-captured":
      return { type: "sql", timing, failure: null, sql: { statement: { value: "select * from invoices where customer_id = ?", isTruncated: false, originalBytes: 44 }, bindings: { items: [{ position: 0, column: "customer_id", value: "[REDACTED]" }], truncated: false, originalBytes: 88 }, result: { kind: "rows", rows: [{ id: 42, total: "125.00" }], rowCount: 1, truncated: true, originalBytes: 128 } } };
    case "sql-failed-long":
      return { type: "sql", timing, failure: { type: "QueryException", message: "Deadlock while updating invoices" }, sql: { statement: { value: `update invoices set notes = ? where id in (${"?,".repeat(180)}?)`, isTruncated: true, originalBytes: 2_048 }, bindings: { items: [{ position: 0, column: "notes", value: "[REDACTED]" }], truncated: true, originalBytes: 4_096 }, result: { kind: "rows", rows: [{ id: 42, diagnostic: "result-".repeat(100) }], rowCount: 20, truncated: true, originalBytes: 8_192 } } };
    case "sql-unavailable":
      return { type: "sql", timing, failure: null, sql: { statement: { value: "select 1", isTruncated: false, originalBytes: 8 }, bindings: null, result: null } };
    case "transaction-committed":
      return { type: "transaction", timing, failure: null, transaction: { connection: "testing", driver: "sqlite", depth: 2, outcome: "committed", queryTimeMs: 12.5 } };
    case "transaction-failed":
      return { type: "transaction", timing, failure: { type: null, message: null }, transaction: { connection: "testing", driver: "sqlite", depth: 2, outcome: "rolled_back", queryTimeMs: 12.5 } };
    case "cache-unavailable":
      return { type: "cache", timing, failure: null, cache: { operation: "GET", store: "redis", key: "sha256:0123456789abcdef", keyCaptured: false, keyCount: 1, strategy: null, outcome: "miss", hit: false, ttlSeconds: null, freshTtlSeconds: null, forever: null, value: null } };
    case "cache-long":
      return { type: "cache", timing, failure: null, cache: { operation: "PUT", store: "redis", key: "customer:42", keyCaptured: true, keyCount: 1, strategy: "remember", outcome: "stored", hit: null, ttlSeconds: 60, freshTtlSeconds: null, forever: null, value: captured("long-value-".repeat(80), true) } };
    case "cache-failed":
      return { type: "cache", timing, failure: { type: "CacheException", message: "Lock flush failed" }, cache: { operation: "LOCK FLUSH", store: "redis", key: null, keyCaptured: false, keyCount: null, strategy: null, outcome: "failed", hit: null, ttlSeconds: null, freshTtlSeconds: null, forever: null, value: null } };
    case "redis-failed":
      return { type: "redis", timing, failure: { type: "RedisException", message: "Connection lost" }, redis: { command: "SET", connection: "default", outcome: "failed", arguments: captured(["private-key", "private-value"]) } };
    case "redis-truncated":
      return { type: "redis", timing, failure: null, redis: { command: "MSET", connection: "default", outcome: "completed", arguments: captured(["redis-key-".repeat(40), "redis-value-".repeat(40)], true) } };
    default:
      return { type: "redis", timing, failure: null, redis: { command: "GET", connection: "default", outcome: "completed", arguments: null } };
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
