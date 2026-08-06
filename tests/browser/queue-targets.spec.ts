import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import type { QueueTargetDetailDto, QueueTargetsPageDto, RunStatus } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import baseline from "./fixtures/nw-221-trigger-queues-baseline.json" with { type: "json" };
import { readPinnedTriggerSource } from "./support/pinned-trigger-source";

const queueId = `queue_${"a".repeat(64)}`;

test("Queues preserve URL filters, keyboard clearing, detail charts, pagination, and Run navigation", async ({ page }) => {
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }
  await routeQueues(page);
  await page.goto("/skyline/queues");

  await expect(page.getByRole("heading", { name: "Queues" })).toBeVisible();
  await expect(page.getByText("this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table", { exact: true })).toBeVisible();
  await expect(page.getByText("Recorded Runs", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Recorded Runs by status" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Queue-time samples" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "First observed" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Last observed" })).toBeVisible();
  await expect(page.getByLabel("Recorded Run status breakdown").first()).toContainText("queued1");
  await expect(page.getByText("Broker depth")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /pause|resume/i })).toHaveCount(0);

  await page.getByLabel("Connection").selectOption("redis");
  await expect(page).toHaveURL(/connection=redis/);
  await page.getByLabel("Search queues").fill("billing");
  await page.getByLabel("Search queues").press("Enter");
  await expect(page).toHaveURL(/search=billing/);
  await page.getByLabel("Search queues").press("Escape");
  await expect(page).not.toHaveURL(/search=/);
  await page.getByLabel("Search queues").press("Escape");
  await expect(page.getByLabel("Search queues")).not.toBeFocused();
  await page.getByLabel("Time range").selectOption("24h");
  await expect(page).toHaveURL(/from=/);
  await expect(page).toHaveURL(/to=/);

  const targetLink = page.getByRole("link", { name: /this-is-a-very-long-observed/ });
  await expect(targetLink).toHaveAttribute("tabindex", "0");
  await targetLink.focus();
  await targetLink.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/skyline/queues/${queueId}`));
  await expect(page.getByRole("heading", { name: "this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Recorded Run activity chart" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Queue time chart" })).toBeVisible();
  await expect(page.getByText("Insufficient samples for a queue-time trend.")).toBeVisible();
  await expect(page.getByText("Recorded Runs, not broker depth")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Queue-time samples" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First observed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Last observed" })).toBeVisible();
  await expect(page.getByLabel("Recorded Run status breakdown")).toContainText("running2");

  await page.getByLabel("Run status", { exact: true }).selectOption(["failed"]);
  await expect(page).toHaveURL(/status=failed/);
  await page.getByText("Invoice", { exact: true }).click();
  await expect(page).toHaveURL(/\/skyline\/runs\/run_1$/);
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
  await expect(page.getByText("Busy", { exact: true })).toBeVisible();
  await expect(page.getByText("Idle", { exact: true })).toBeVisible();

  delayList = true;
  await page.getByLabel("Connection").selectOption("redis");
  await expect(page.locator("tbody")).toHaveClass(/opacity-50/);
  delayList = false;

  mode = "initial-empty";
  await page.goto("/skyline/queues");
  await expect(page.getByRole("heading", { name: "No Queue targets yet" })).toBeVisible();
  mode = "filtered-empty";
  await page.goto("/skyline/queues?search=missing");
  await expect(page.getByRole("heading", { name: "No matching Queue targets" })).toBeVisible();
  mode = "error";
  await page.goto("/skyline/queues");
  await expect(page.getByRole("alert")).toContainText("Queue evidence unavailable.");
  mode = "populated";
  await page.goto("/skyline/queues/queue_missing");
  await expect(page.getByRole("alert")).toContainText("Queue target not found");

  detailMode = "filtered-empty";
  await page.goto(`/skyline/queues/${queueId}?status=failed`);
  await expect(page.getByRole("heading", { name: "No matching Runs" })).toBeVisible();
  detailMode = "populated";
  delayDetail = true;
  await page.getByLabel("Run status", { exact: true }).selectOption([]);
  await expect(page.getByLabel("Loading Queue-target Runs")).toBeVisible();
  delayDetail = false;
  await expect(page.getByText("Invoice", { exact: true })).toBeVisible();
  detailMode = "idle";
  await page.reload();
  await expect(page.getByText("Idle", { exact: true })).toBeVisible();
  detailMode = "error";
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Queue-target evidence could not be loaded.");
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

  await page.goto(`/skyline/queues/${queueId}`);
  await expect(page.getByText("run_1", { exact: true })).toBeVisible();
  await page.locator('a[href*="direction=forward"]').click();
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
    queueTargets: [summary(queueId, "this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table", { queued: 1, running: 2 }), summary(`queue_${"b".repeat(64)}`, "mail", {})],
    pagination: { previous: null, next: null },
    filters: { connection: null, search: null, from: null, to: null, status: [] },
    options: { connections: ["redis", "sqs"], timeRanges: queueTimeRanges() },
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
