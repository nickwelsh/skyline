import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import type { QueueTargetDetailDto, QueueTargetsPageDto, RunStatus } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import baseline from "./fixtures/nw-221-trigger-queues-baseline.json" with { type: "json" };
import { readPinnedTriggerSource } from "./support/pinned-trigger-source";

const queueId = `queue_${"a".repeat(64)}`;

test.setTimeout(10_000);

test("Queues preserve URL filters, keyboard clearing, detail charts, pagination, and Run navigation", async ({ page }) => {
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }
  await routeQueues(page);
  await page.goto("/skyline/queues");

  await expect(page.getByRole("heading", { name: "Queues" })).toBeVisible();
  await expect(page.getByText("this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table", { exact: true })).toBeVisible();
  for (const metric of ["Recorded queued", "Recorded running"]) {
    await expect(page.getByRole("heading", { name: metric }).first()).toBeVisible();
  }
  for (const column of ["Name", "Recorded queued", "Recorded running", "Recorded state", "Queue time p95"]) {
    await expect(page.getByRole("columnheader", { name: column, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Allocated|Environment limit|Limited by|Backlog|Pause\/resume/)).toHaveCount(0);
  await expect(page.getByText("Broker depth")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /pause|resume/i })).toHaveCount(0);

  const connection = page.getByLabel("Connection", { exact: true });
  await expect(connection).toHaveCount(1);
  await expect(connection.locator("option")).toHaveText(["All", "database", "redis", "sqs"]);
  await connection.selectOption("database");
  await expect(page).toHaveURL(/connection=database/);
  await page.reload();
  await expect(connection).toHaveValue("database");
  await page.goBack();
  await expect(page).not.toHaveURL(/connection=/);
  await expect(connection).toHaveValue("");
  await page.goForward();
  await expect(page).toHaveURL(/connection=database/);
  await expect(connection).toHaveValue("database");
  await connection.selectOption("");
  await expect(page).not.toHaveURL(/connection=/);

  const queueSearch = page.getByRole("textbox", { name: "Search queues…" });
  await queueSearch.fill("billing");
  await queueSearch.press("Enter");
  await expect(page).toHaveURL(/search=billing/);
  await queueSearch.press("Escape");
  await expect(page).not.toHaveURL(/search=/);
  await queueSearch.press("Escape");
  await expect(queueSearch).not.toBeFocused();
  const period = page.getByRole("combobox", { name: "Period: 1 hr" });
  await period.focus();
  await period.press("ArrowDown");
  await page.getByRole("option", { name: "24 hours" }).click();
  await expect(page).toHaveURL(/from=/);
  await expect(page).toHaveURL(/to=/);

  const targetLink = page.getByRole("link", { name: /this-is-a-very-long-observed/ });
  await expect(targetLink).toHaveAttribute("tabindex", "0");
  await targetLink.focus();
  await targetLink.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/skyline/queues/${queueId}`));
  await expect(page.getByRole("heading", { name: "this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Concurrency keys" })).toHaveCount(0);
  for (const metric of ["Recorded queued", "Recorded running", "Maximum queue time"]) {
    await expect(page.getByRole("heading", { name: metric }).first()).toBeVisible();
  }
  for (const chart of ["Throughput", "Scheduling delay"]) {
    await expect(page.getByRole("img", { name: `${chart} chart` })).toBeVisible();
  }
  await expect(page.getByText(/Concurrency|Oldest wait|Queue depth|Throttled/)).toHaveCount(0);
  await expect(page.getByText("Recorded Runs, not broker depth")).toHaveCount(0);
  const recordedRuns = page.getByRole("region", { name: "Recorded runs" });
  await expect(recordedRuns).toBeVisible();
  const charts = page.getByRole("region", { name: "Queue-target activity" });
  const chartBounds = await charts.boundingBox();
  const recordedRunsButton = recordedRuns.getByRole("button", { name: "Recorded runs", exact: true });
  await expect(recordedRunsButton).toHaveAttribute("aria-expanded", "false");
  await expect(recordedRunsButton).toHaveAttribute("aria-controls", "queue-recorded-runs-content");
  await recordedRunsButton.focus();
  await expect(recordedRunsButton).toBeFocused();
  await recordedRunsButton.press("Enter");
  await expect(recordedRuns.getByRole("table")).toBeVisible();
  await expect(recordedRuns).toHaveCSS("height", "208px");
  await expect(recordedRunsButton).toHaveAttribute("aria-expanded", "true");
  await expect(recordedRunsButton).toHaveAttribute("aria-controls", "queue-recorded-runs-content");
  expect(await charts.boundingBox()).toEqual(chartBounds);
  await recordedRuns.getByRole("button", { name: "Close recorded runs" }).click();
  await expect(page.getByRole("img", { name: "Scheduling delay chart" })).toBeVisible();
  await expect(recordedRunsButton).toBeFocused();
  await expect(recordedRunsButton).toHaveAttribute("aria-controls", "queue-recorded-runs-content");
  await recordedRunsButton.press("Enter");
  const closeRecordedRuns = recordedRuns.getByRole("button", { name: "Close recorded runs" });
  await closeRecordedRuns.focus();
  await closeRecordedRuns.press("Escape");
  await expect(page.getByRole("img", { name: "Scheduling delay chart" })).toBeVisible();
  await expect(recordedRunsButton).toBeFocused();
  await recordedRunsButton.press("Enter");

  await page.getByLabel("Run status", { exact: true }).selectOption(["failed"]);
  await expect(page).toHaveURL(/status=failed/);
  await recordedRuns.getByText("Invoice", { exact: true }).click();
  await expect(page).toHaveURL(/\/skyline\/runs\/run_1$/);
});

test("Queue Period Select preserves keyboard and browser history semantics", async ({ page }) => {
  await routeQueues(page);
  await page.goto(`/skyline/queues/${queueId}`);

  const period = page.getByRole("combobox", { name: "Period: 1 hr" });
  await period.focus();
  await period.press("ArrowDown");
  const option = page.getByRole("option", { name: "24 hours" });
  await expect(option).toBeVisible();
  await option.press("Enter");
  await expect(page).toHaveURL(/range=24h/);
  await expect(page.getByRole("combobox", { name: "Period: 24 hours" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Period: 1 hr" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("combobox", { name: "Period: 24 hours" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Period: 24 hours" })).toBeVisible();
});

test("Queue search clear control is named and Escape remains its keyboard equivalent", async ({ page }) => {
  await routeQueues(page);
  await page.goto("/skyline/queues?search=billing");

  const search = page.getByRole("textbox", { name: "Search queues…" });
  await expect(page.getByRole("button", { name: "Clear field" })).toBeVisible();
  await search.focus();
  await search.press("Escape");
  await expect(search).toBeFocused();
  await expect(page).not.toHaveURL(/search=/);

  await search.fill("billing");
  const violations = (await new AxeBuilder({ page }).include('[data-skyline-anchor="queue-filter-controls"]').analyze()).violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }));
  expect(violations).toEqual([]);
});

test("Queues cover loading, initial-empty, filtered-empty, API-error, not-found, idle, busy, and insufficient samples", async ({ page }) => {
  let mode: "populated" | "initial-empty" | "filtered-empty" | "error" = "populated";
  let detailMode: "populated" | "filtered-empty" | "error" | "idle" = "populated";
  let delayList = false;
  let delayDetail = false;
  await page.route("**/skyline/api/queues**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("queue_missing")) {
      await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Missing." } } });
      return;
    }
    if (url.pathname.endsWith(queueId)) {
      if (delayDetail) await new Promise((resolve) => setTimeout(resolve, 150));
      if (detailMode === "error") {
        await route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Queue detail unavailable." } } });
        return;
      }
      const response = detailResponse();
      if (detailMode === "filtered-empty") {
        response.runs = [];
        response.hasAnyRuns = true;
        response.filters.status = ["failed"];
      }
      if (detailMode === "idle") response.queueTarget.recordedRunCounts = counts({ completed: 4 });
      await route.fulfill({ json: response });
      return;
    }
    if (delayList) await new Promise((resolve) => setTimeout(resolve, 500));
    if (mode === "error") {
      await route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Queue evidence unavailable." } } });
      return;
    }
    const response = listResponse();
    if (mode !== "populated") {
      response.queueTargets = [];
      response.hasAnyQueueTargets = mode === "filtered-empty";
      response.filters.search = mode === "filtered-empty" ? "missing" : null;
    }
    await route.fulfill({ json: response });
  });

  await page.goto("/skyline/queues");
  await expect(page.getByText("Queued", { exact: true })).toBeVisible();
  await expect(page.getByText("Idle", { exact: true })).toBeVisible();

  delayList = true;
  await page.getByRole("textbox", { name: "Search queues…" }).fill("billing");
  await page.getByRole("textbox", { name: "Search queues…" }).press("Enter");
  await expect(page.locator("tbody")).toHaveClass(/opacity-50/);
  delayList = false;

  mode = "initial-empty";
  await page.goto("/skyline/queues");
  await expect(page.getByRole("heading", { name: "No queues found" })).toBeVisible();
  mode = "filtered-empty";
  await page.goto("/skyline/queues?search=missing");
  await expect(page.getByRole("heading", { name: "No queues found matching your filters" })).toBeVisible();
  mode = "error";
  await page.goto("/skyline/queues");
  await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  await expect(page.getByText("Queue evidence unavailable.", { exact: true })).toBeVisible();
  mode = "populated";
  await page.goto("/skyline/queues/queue_missing");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();

  detailMode = "filtered-empty";
  await page.goto(`/skyline/queues/${queueId}?status=failed`);
  await page.getByRole("region", { name: "Recorded runs" }).getByRole("button", { name: "Recorded runs" }).click();
  await expect(page.getByRole("heading", { name: "No matching Runs" })).toBeVisible();
  detailMode = "populated";
  delayDetail = true;
  await page.getByLabel("Run status", { exact: true }).selectOption([]);
  await expect(page.getByLabel("Loading Queue-target Runs")).toBeVisible();
  delayDetail = false;
  await expect(page.getByText("Invoice", { exact: true })).toBeVisible();
  detailMode = "idle";
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recorded running" }).first()).toBeVisible();
  detailMode = "error";
  await page.reload();
  await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  await expect(page.getByText("Queue detail unavailable.", { exact: true })).toBeVisible();
});

test("Queues cursor-paginate list and recorded Runs through URL-backed API reads", async ({ page }) => {
  await page.route("**/skyline/api/queues**", async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");
    if (url.pathname.endsWith(queueId)) {
      const response = detailResponse();
      response.runs = [run(cursor === "next-runs" ? "run_2" : "run_1")];
      response.pagination = cursor === "next-runs"
        ? { previous: "previous-runs", next: null }
        : { previous: null, next: "next-runs" };
      await route.fulfill({ json: response });
      return;
    }
    const response = listResponse();
    response.queueTargets = cursor === "next-targets"
      ? [summary(`queue_${"c".repeat(64)}`, "exports", {})]
      : [summary(queueId, "billing", { running: 1 })];
    response.pagination = cursor === "next-targets"
      ? { previous: "previous-targets", next: null }
      : { previous: null, next: "next-targets" };
    await route.fulfill({ json: response });
  });

  await page.goto("/skyline/queues");
  await page.locator('a[href*="direction=forward"]').click();
  await expect(page).toHaveURL(/cursor=next-targets&direction=forward/);
  await expect(page.getByText("exports", { exact: true })).toBeVisible();
  await page.locator('a[href*="direction=backward"]').click();
  await expect(page).toHaveURL(/cursor=previous-targets&direction=backward/);
  await expect(page.getByText("billing", { exact: true })).toBeVisible();

  await page.goto(`/skyline/queues/${queueId}?cursor=next-runs&direction=forward`);
  await expect(page.getByRole("region", { name: "Recorded runs" }).getByRole("table")).toBeVisible();
  await expect(page).toHaveURL(/cursor=next-runs&direction=forward/);
  await expect(page.getByText("run_2", { exact: true })).toBeVisible();
  await page.locator('a[href*="direction=backward"]').click();
  await expect(page).toHaveURL(/cursor=previous-runs&direction=backward/);
  await expect(page.getByText("run_1", { exact: true })).toBeVisible();
});

async function routeQueues(page: Page) {
  await page.route("**/skyline/api/queues**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ json: url.pathname.endsWith(queueId) ? detailResponse() : listResponse() });
  });
}

function listResponse(): QueueTargetsPageDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00.000000000Z",
    capabilities: capabilities(),
    environmentSummary: { queued: 1, running: 2, allocated: null, limit: null },
    queueTargets: [summary(queueId, "this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table", { queued: 1, running: 2 }), summary(`queue_${"b".repeat(64)}`, "mail", {})],
    pagination: { previous: null, next: null },
    filters: { connection: null, search: null, from: null, to: null, status: [] },
    options: { connections: ["database", "redis", "sqs"], timeRanges: queueTimeRanges() },
    hasAnyQueueTargets: true,
  };
}

function detailResponse(): QueueTargetDetailDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00.000000000Z",
    capabilities: capabilities(),
    queueCapabilities: { pause: false, resume: false, concurrency: false, allocation: false, rateLimit: false, workers: false, billing: false, environmentControls: false },
    queueTarget: summary(queueId, "this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table", { queued: 1, running: 2 }),
    series: {
      activity: [{ timestamp: "2026-08-05T12:00:00.000000000Z", recordedRuns: 1, recordedRunCounts: counts({ completed: 1 }) }],
      queueTime: [{ timestamp: "2026-08-05T12:00:00.000000000Z", sampleCount: 1, medianUs: 2000, p95Us: 2000, maximumUs: 2000 }],
    },
    runs: [run("run_1")],
    pagination: { previous: null, next: null },
    filters: { connection: null, search: null, from: null, to: null, status: [] },
    options: { statuses: ["queued", "running", "retrying", "completed", "failed"], timeRanges: queueTimeRanges() },
    hasAnyRuns: true,
  };
}

function run(id: string): QueueTargetDetailDto["runs"][number] {
  return {
    id,
    href: `/skyline/runs/${id}`,
    traceId: `trace_${id}`,
    name: "App\\Jobs\\Invoice",
    status: "failed",
    attemptCount: 2,
    triggeredAt: "2026-08-05T12:00:00.000000000Z",
    startedAt: "2026-08-05T12:00:00.002000000Z",
    finishedAt: "2026-08-05T12:00:01.000000000Z",
    queueDurationUs: 2000,
    durationUs: 998000,
    activeDurationUs: null,
  };
}

function summary(id: string, queue: string, active: Partial<Record<RunStatus, number>>) {
  return {
    id,
    connection: queue === "mail" ? "sqs" : "redis",
    queue,
    firstObservedAt: "2026-08-05T11:00:00.000000000Z",
    lastObservedAt: "2026-08-05T12:00:00.000000000Z",
    recordedRunCount: queue === "mail" ? 1 : 4,
    recordedRunCounts: counts({ completed: 1, ...active }),
    queueTime: queue === "mail"
      ? { sampleCount: 0, medianUs: null, p95Us: null, maximumUs: null }
      : { sampleCount: 1, medianUs: 2000, p95Us: 2000, maximumUs: 2000 },
  };
}

function counts(values: Partial<Record<RunStatus, number>>): Record<RunStatus, number> {
  return { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0, ...values };
}

function capabilities() {
  return fixtureCapabilities;
}

function queueTimeRanges() {
  return [
    { value: "all" as const, label: "All time", durationSeconds: null },
    { value: "1h" as const, label: "Last hour", durationSeconds: 3_600 },
    { value: "24h" as const, label: "Last 24 hours", durationSeconds: 86_400 },
    { value: "7d" as const, label: "Last 7 days", durationSeconds: 604_800 },
  ];
}
