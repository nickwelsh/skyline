import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { JobDetailDto, JobsPageDto, SkylineCapabilities } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import baseline from "./fixtures/nw-219-trigger-jobs-baseline.json" with { type: "json" };
import { readPinnedTriggerSource } from "./support/pinned-trigger-source";

test("Jobs list and detail keep observed activity in basename URLs", async ({ page }) => {
  await routeJobs(page);
  await page.goto("/skyline/jobs");

  await expect(page.getByLabel("Loading Jobs")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New task…" })).toHaveCount(0);
  await expect(page.getByText("App\\Jobs\\GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  const listActivity = page.locator(".recharts-wrapper").first();
  await expect(listActivity.locator('[data-status="running"]')).toHaveAttribute("fill", /run-executing/);
  await expect(listActivity.locator('[fill="var(--color-run-completed-successfully)"]')).toBeVisible();
  await expect(listActivity.locator('[data-status="failed"]')).toHaveAttribute("fill", /run-completed-with-errors/);

  const pagination = page.locator('[data-skyline-protected="jobs-list-pagination"]');
  await pagination.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/cursor=next-jobs/);
  await expect(page.getByText("App\\Jobs\\ReconcilePayments", { exact: true })).toBeVisible();
  await expect(page.getByText("App\\Jobs\\GenerateMonthlyInvoices", { exact: true })).toHaveCount(0);
  await expectJobsOmissionMarkers(page);
  await pagination.getByRole("link", { name: "Previous" }).click();
  await expect(page.getByText("App\\Jobs\\GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await expectJobsOmissionMarkers(page);
  await page.getByLabel("Time range").selectOption("24h");
  await expect(page).toHaveURL(/period=24h/);
  await expect(page).not.toHaveURL(/cursor=/);

  const search = page.getByPlaceholder("Search tasks…");
  await search.fill("invoice");
  await search.press("Enter");
  await expect(page).toHaveURL(/search=invoice/);
  await search.press("Escape");
  await expect(page).not.toHaveURL(/search=/);
  await page.getByRole("link", { name: "App\\Jobs\\GenerateMonthlyInvoices" }).first().click();
  await expect(page).toHaveURL(/\/skyline\/jobs\/job_invoice$/);
  await expect(page.getByRole("heading", { name: "App\\Jobs\\GenerateMonthlyInvoices", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runs by status" })).toBeVisible();
  const detailActivity = page.getByRole("img", { name: "Recorded Runs by status over time" });
  await expect(detailActivity.locator('[data-status="running"]')).toHaveAttribute("fill", /run-executing/);
  await expect(detailActivity.locator('[data-status="completed"]')).toHaveAttribute("fill", /run-completed-successfully/);
  await expect(detailActivity.locator('[data-status="failed"]')).toHaveAttribute("fill", /run-completed-with-errors/);
  const jobDetails = page.getByLabel("Job details");
  await expect(jobDetails.getByRole("link", { name: "redis / billing", exact: true })).toHaveAttribute("href", "/skyline/queues/queue_billing");
  await expect(jobDetails.getByRole("link", { name: "database / default", exact: true })).toHaveAttribute("href", "/skyline/queues/queue_default");
  await expect(page.getByLabel("Run status")).toHaveCount(0);
  await expect(page.getByLabel("Time range")).toHaveValue("7d");
  await page.getByLabel("Time range").selectOption("7d");
  await expect(page).toHaveURL(/period=7d/);
  await page.locator('a[href^="/skyline/runs/run-1"]').first().click();
  await expect(page).toHaveURL(/\/skyline\/runs\/run-1\?tableState=/);
});

test("paired pinned Trigger Jobs contract preserves geometry, interaction, focus, and semantics", async ({ page }) => {
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }

  await page.setViewportSize(baseline.viewport);
  await routeJobs(page);
  await page.goto("/skyline/jobs");

  const sideMenu = page.getByTestId("side-menu");
  const filters = page.getByLabel("Task filters");
  const search = page.getByPlaceholder("Search tasks…");
  const searchWrapper = search.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' min-w-52 ')][1]");
  await expect.poll(async () => (await sideMenu.boundingBox())?.width).toBe(224);
  await expect.poll(async () => (await filters.boundingBox())?.height).toBeCloseTo(40, 0);
  await expect.poll(async () => (await searchWrapper.boundingBox())?.width).toBeGreaterThanOrEqual(baseline.contract.list.searchMinWidth);
  await expect(page.getByRole("columnheader").allTextContents()).resolves.toEqual(["ID", "Running", "Activity (24h)", "Go to page"]);
  await expect(page.getByRole("group", { name: "Task type" })).toHaveCount(0);

  await search.fill("invoice");
  await expect(search).toBeFocused();
  await search.press(baseline.contract.interaction.searchSubmitKey);
  await expect(page).toHaveURL(/search=invoice/);
  await search.press(baseline.contract.interaction.searchClearKey);
  await expect(search).toBeFocused();
  await expect(page).not.toHaveURL(/search=/);
  await search.press(baseline.contract.interaction.searchClearKey);
  await expect(search).not.toBeFocused();

  await page.getByRole("link", { name: "App\\Jobs\\GenerateMonthlyInvoices" }).first().click();
  const activity = page.getByRole("region", { name: "Runs by status" });
  const sidebar = page.getByLabel("Job details");
  await expect.poll(async () => (await activity.boundingBox())?.height).toBeCloseTo(baseline.contract.detail.activityDefaultHeight, 0);
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeCloseTo(baseline.contract.detail.sidebarDefaultWidth, 0);
  await expect(sidebar.getByRole("link", { name: "redis / billing", exact: true })).toHaveAttribute("href", "/skyline/queues/queue_billing");
  await expect(sidebar.getByRole("link", { name: "database / default", exact: true })).toHaveAttribute("href", "/skyline/queues/queue_default");
  const favoriteButton = page.getByRole("button", { name: "Add GenerateMonthlyInvoices to favorites" });
  await favoriteButton.focus();
  await expect(favoriteButton).toBeFocused();
  await page.keyboard.press(baseline.contract.interaction.favoriteKey);
  await expect(page.getByRole("button", { name: "Remove GenerateMonthlyInvoices from favorites" })).toHaveAttribute("aria-pressed", "true");
});

test("Job detail tolerates long labels and missing optional observations", async ({ page }) => {
  const longName = `App\\Jobs\\${"VeryLongObservedJobName".repeat(12)}`;
  await page.route("**/skyline/api/jobs/**", async (route) => {
    const response = jobDetail();
    response.job.name = longName;
    response.queueTargets = [];
    response.activity = [];
    return route.fulfill({ json: response });
  });

  await page.goto("/skyline/jobs/job_long");
  await expect(page.getByRole("heading", { name: longName }).first()).toBeVisible();
  await expect(page.getByText("No activity in this time range.")).toBeVisible();
  const detail = page.getByLabel("Job details");
  for (const label of ["File path", "Type", "Version", "Concurrency", "Machine", "Max duration", "TTL", "Retry", "Payload schema"]) {
    await expect(detail.getByText(label, { exact: true })).toHaveCount(0);
  }
});

test("Job detail can be favorited to a persistent valid sidebar destination", async ({ page }) => {
  await routeJobs(page);
  await page.goto("/skyline/jobs/job_invoice");

  await page.getByRole("button", { name: "Add GenerateMonthlyInvoices to favorites" }).click();
  const favorite = page.getByRole("navigation", { name: "Favorites" }).getByRole("link", { name: "GenerateMonthlyInvoices" });
  await expect(favorite).toHaveAttribute("href", "/skyline/jobs/job_invoice");
  await page.reload();
  await expect(favorite).toBeVisible();
  await favorite.click();
  await expect(page).toHaveURL(/\/skyline\/jobs\/job_invoice$/);
  await page.getByRole("button", { name: "Remove GenerateMonthlyInvoices from favorites" }).click();
  await expect(favorite).toHaveCount(0);
});

test("sidebar customization hides and restores a favorite persistently", async ({ page }) => {
  await routeJobs(page);
  await page.goto("/skyline/jobs/job_invoice");

  await page.getByRole("button", { name: "Add GenerateMonthlyInvoices to favorites" }).click();
  const favorite = page.getByRole("navigation", { name: "Favorites" }).getByRole("link", { name: "GenerateMonthlyInvoices" });
  await expect(favorite).toBeVisible();

  const observability = page.getByRole("button", { name: "Observability", exact: true });
  await observability.hover();
  await observability.locator("..").getByRole("button", { name: "Sidebar options" }).click();
  await page.getByText("Customize sidebar", { exact: true }).click();
  const hideFavorite = page.getByRole("button", { name: "Hide GenerateMonthlyInvoices" });
  await hideFavorite.click();
  await expect(page.getByRole("button", { name: "Show GenerateMonthlyInvoices" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("skyline.ui-preferences.v1:/skyline") ?? "{}"))).toMatchObject({
    sidebar: { hiddenItems: { job_invoice: true } },
  });
  await expect(favorite).toHaveCount(0);
  await page.reload();
  await expect(favorite).toHaveCount(0);

  await observability.hover();
  await observability.locator("..").getByRole("button", { name: "Sidebar options" }).click();
  await page.getByText("Customize sidebar", { exact: true }).click();
  await page.getByRole("button", { name: "Show GenerateMonthlyInvoices" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(favorite).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("skyline.ui-preferences.v1:/skyline") ?? "{}").sidebar?.hiddenItems?.job_invoice)).toBeUndefined();
});

test("capability-enabled Job guidance retains its useful-links preference", async ({ page }) => {
  await page.route("**/skyline/api/jobs**", async (route) => {
    const response = jobsPage();
    response.capabilities = {
      ...fixtureCapabilities,
      shell: { ...fixtureCapabilities.shell, jobGuidance: true },
    };
    return route.fulfill({ json: response });
  });

  await page.goto("/skyline/jobs");
  const guidance = page.getByRole("complementary", { name: "Job guidance" });
  await expect(guidance).toBeVisible();
  await expect.poll(async () => (await guidance.boundingBox())?.width).toBeCloseTo(400, 0);
  await expect(guidance.getByRole("heading").allTextContents()).resolves.toEqual([
    "Create a new task",
    "Chat agent",
    "Standard task",
    "Scheduled task",
  ]);
  await expect(page.getByRole("separator", { name: "Resize Handle" })).toBeVisible();
  await page.getByRole("button", { name: "Close Job guidance" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("skyline.ui-preferences.v1:/skyline") ?? "{}").jobs?.usefulLinks)).toBe(false);
  await page.reload();
  await expect(page.getByRole("button", { name: "New task…" })).toBeVisible();
});

test("Jobs covers empty, filtered-empty, API-error, and not-found states", async ({ page }) => {
  let mode: "empty" | "filtered" | "error" | "not-found" = "empty";
  await page.route("**/skyline/api/jobs**", async (route) => {
    if (mode === "error") return route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Telemetry unavailable." } } });
    if (mode === "not-found") return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "The Job type was not found." } } });
    const response = jobsPage();
    response.jobs = [];
    response.hasAnyJobs = mode === "filtered";
    response.filters.search = mode === "filtered" ? "missing" : null;
    return route.fulfill({ json: response });
  });

  await page.goto("/skyline/jobs");
  await expect(page.getByRole("heading", { name: "No Jobs yet" })).toBeVisible();
  mode = "filtered";
  await page.goto("/skyline/jobs?search=missing");
  await expect(page.getByRole("heading", { name: "No matching Jobs" })).toBeVisible();
  mode = "error";
  await page.goto("/skyline/jobs");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Telemetry unavailable.", { exact: true })).toBeVisible();
  mode = "not-found";
  await page.goto("/skyline/jobs/job_missing");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "404: Page not found" })).toBeVisible();
  await expect(page.getByText("Not Found", { exact: true })).toBeVisible();
});

async function routeJobs(page: Page) {
  await page.route("**/skyline/api/jobs**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith("/api/jobs")) return route.fulfill({ json: jobDetail() });
    const response = jobsPage();
    if (url.searchParams.get("cursor") === "next-jobs") {
      response.jobs = [jobSummary({ id: "job_reconcile", name: "App\\Jobs\\ReconcilePayments" })];
      response.pagination = { previous: "previous-jobs", next: null };
    }
    return route.fulfill({ json: response });
  });
}

async function expectJobsOmissionMarkers(page: Page) {
  const markers = page.locator('[data-skyline-capability-boundary^="jobs-list-"]');
  await expect(markers).toHaveCount(5);
  expect(await markers.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-skyline-capability-boundary")))).toEqual([
    "jobs-list-task-type-filter",
    "jobs-list-type-header",
    "jobs-list-file-header",
    "jobs-list-type-row-1",
    "jobs-list-file-row-1",
  ]);
  expect(await markers.evaluateAll((nodes) => nodes.every((node) => node.getAttribute("aria-hidden") === "true" && !node.querySelector("a, button, input, svg")))).toBe(true);
  await expect(page.locator('[data-skyline-protected="jobs-list-search"]')).toBeVisible();
  await expect(page.locator('[data-skyline-protected="jobs-list-pagination"]')).toBeVisible();
}

function jobsPage(): JobsPageDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00.000000000Z",
    capabilities: capabilities(),
    jobs: [jobSummary()],
    pagination: { previous: null, next: "next-jobs" },
    filters: { search: null, period: "all" },
    options: { timeRanges },
    hasAnyJobs: true,
  };
}

function jobDetail(): JobDetailDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00.000000000Z",
    capabilities: capabilities(),
    job: jobSummary(),
    queueTargets: [
      { id: "queue_billing", connection: "redis", queue: "billing", runCount: 2, href: "/skyline/queues/queue_billing" },
      { id: "queue_default", connection: "database", queue: "default", runCount: 1, href: "/skyline/queues/queue_default" },
    ],
    activity: [{ timestamp: "2026-08-05T00:00:00Z", total: 3, statusCounts: counts() }],
    runs: [{
      id: "run-1", traceId: "trace-1", parentRunId: null, isRoot: true, name: "App\\Jobs\\GenerateMonthlyInvoices", status: "failed", connection: "redis", queue: "billing", driverId: null,
      attemptCount: 2, triggeredAt: "2026-08-05T11:59:00.000000000Z", queuedAt: "2026-08-05T11:59:00.000000000Z",
      startedAt: "2026-08-05T11:59:00.001000000Z", finishedAt: "2026-08-05T11:59:01.001000000Z", queueDurationUs: 1_000, queueTimeSource: null,
      durationUs: 1_000_000, activeDurationUs: null, revision: 2,
    }],
    pagination: { previous: null, next: "next" },
    tableState: "job-table-state",
    filters: { status: [], period: "all" },
    options: { statuses: ["queued", "running", "retrying", "completed", "failed"], timeRanges },
    hasAnyRuns: true,
  };
}

function jobSummary(overrides: { id?: string; name?: string } = {}) {
  const id = overrides.id ?? "job_invoice";
  const name = overrides.name ?? "App\\Jobs\\GenerateMonthlyInvoices";
  return {
    id,
    name,
    href: `/skyline/jobs/${id}`,
    firstObservedAt: "2026-08-01T12:00:00.000000000Z",
    lastObservedAt: "2026-08-05T12:00:00.000000000Z",
    runCount: 3,
    statusCounts: counts(),
    activity: [{ timestamp: "2026-08-05T11:00:00Z", total: 3, statusCounts: counts() }],
    latestRun: { id: "run-1", status: "failed" as const, triggeredAt: "2026-08-05T11:59:00.000000000Z", href: "/skyline/runs/run-1" },
  };
}

function counts() {
  return { queued: 0, running: 1, retrying: 0, completed: 1, failed: 1 };
}

const timeRanges = [
  { value: "1h" as const, label: "Last hour" }, { value: "24h" as const, label: "Last 24 hours" },
  { value: "7d" as const, label: "Last 7 days" }, { value: "30d" as const, label: "Last 30 days" }, { value: "all" as const, label: "All time" },
];

function capabilities(): SkylineCapabilities {
  return fixtureCapabilities;
}
