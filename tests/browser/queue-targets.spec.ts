import { expect, test, type Page } from "@playwright/test";
import type { QueueTargetDetailDto, QueueTargetsPageDto, RunStatus } from "../../resources/js/skyline/dto";

const queueId = `queue_${"a".repeat(64)}`;

test("Queues preserve URL filters, keyboard clearing, detail charts, pagination, and Run navigation", async ({ page }) => {
  await routeQueues(page);
  await page.goto("/skyline/queues");

  await expect(page.getByRole("heading", { name: "Queues" })).toBeVisible();
  await expect(page.getByText("this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table", { exact: true })).toBeVisible();
  await expect(page.getByText("Recorded Runs", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Broker depth")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /pause|resume/i })).toHaveCount(0);

  await page.getByLabel("Connection").selectOption("redis");
  await expect(page).toHaveURL(/connection=redis/);
  await page.getByLabel("Search queues").fill("billing");
  await page.getByLabel("Search queues").press("Enter");
  await expect(page).toHaveURL(/search=billing/);
  await page.getByLabel("Search queues").press("Escape");
  await expect(page).not.toHaveURL(/search=/);
  await page.getByLabel("Time range").selectOption("24h");
  await expect(page).toHaveURL(/from=/);
  await expect(page).toHaveURL(/to=/);

  await page.getByRole("link", { name: /this-is-a-very-long-observed/ }).click();
  await expect(page).toHaveURL(new RegExp(`/skyline/queues/${queueId}`));
  await expect(page.getByRole("heading", { name: "this-is-a-very-long-observed-billing-queue-name-that-must-not-distort-the-table" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Recorded Run activity chart" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Queue time chart" })).toBeVisible();
  await expect(page.getByText("Insufficient samples for a queue-time trend.")).toBeVisible();
  await expect(page.getByText("Recorded Runs, not broker depth")).toBeVisible();

  await page.getByLabel("Run status").selectOption(["failed"]);
  await expect(page).toHaveURL(/status=failed/);
  await page.getByText("Invoice", { exact: true }).click();
  await expect(page).toHaveURL(/\/skyline\/runs\/run_1$/);
});

test("Queues cover loading, initial-empty, filtered-empty, API-error, not-found, idle, busy, and insufficient samples", async ({ page }) => {
  let mode: "populated" | "initial-empty" | "filtered-empty" | "error" = "populated";
  let delay = false;
  await page.route("**/skyline/api/queues**", async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, 150));
    if (mode === "error") {
      await route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Queue evidence unavailable." } } });
      return;
    }
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("queue_missing")) {
      await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Missing." } } });
      return;
    }
    if (url.pathname.endsWith(queueId)) {
      await route.fulfill({ json: detailResponse() });
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

  delay = true;
  await page.getByLabel("Connection").selectOption("redis");
  await expect(page.locator("tbody")).toHaveAttribute("aria-busy", "true");
  delay = false;

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
    options: { connections: ["redis", "sqs"] },
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
    runs: [{
      id: "run_1",
      href: "/skyline/runs/run_1",
      traceId: "trace_1",
      name: "App\\Jobs\\Invoice",
      status: "failed",
      attemptCount: 2,
      triggeredAt: "2026-08-05T12:00:00.000000000Z",
      startedAt: "2026-08-05T12:00:00.002000000Z",
      finishedAt: "2026-08-05T12:00:01.000000000Z",
      queueDurationUs: 2000,
      durationUs: 998000,
      activeDurationUs: null,
    }],
    pagination: { previous: null, next: null },
    filters: { connection: null, search: null, from: null, to: null, status: [] },
    options: { statuses: ["queued", "running", "retrying", "completed", "failed"] },
    hasAnyRuns: true,
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
  return {
    navigation: { jobs: true, runs: true, queues: true },
    jobs: { view: true, testJob: false },
    runs: { view: true, cancel: false, replay: false },
    shell: { shortcuts: true },
  };
}
