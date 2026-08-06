import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { JobDetailDto, JobsPageDto, SkylineCapabilities } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import baseline from "./fixtures/nw-219-trigger-jobs-baseline.json" with { type: "json" };

test("Jobs list and detail keep observed activity in basename URLs", async ({ page }) => {
  await routeJobs(page);
  await page.goto("/skyline/jobs");

  await expect(page.getByLabel("Loading Jobs")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  const listActivity = page.getByRole("img", { name: "Recorded Runs by status" });
  await expect(listActivity.locator('[data-status="running"]')).toHaveAttribute("style", /run-executing/);
  await expect(listActivity.locator('[data-status="completed"]')).toHaveAttribute("style", /run-completed-successfully/);
  await expect(listActivity.locator('[data-status="failed"]')).toHaveAttribute("style", /run-completed-with-errors/);

  const search = page.getByPlaceholder("Search Jobs…");
  await search.fill("invoice");
  await search.press("Enter");
  await expect(page).toHaveURL(/search=invoice/);
  await search.press("Escape");
  await expect(page).not.toHaveURL(/search=/);
  await page.getByLabel("Time range").selectOption("24h");
  await expect(page).toHaveURL(/period=24h/);

  await page.getByText("GenerateMonthlyInvoices", { exact: true }).click();
  await expect(page).toHaveURL(/\/skyline\/jobs\/job_invoice$/);
  await expect(page.getByRole("heading", { name: "GenerateMonthlyInvoices", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run activity" })).toBeVisible();
  const detailActivity = page.getByRole("img", { name: "Recorded Runs by status over time" });
  await expect(detailActivity.locator('[data-status="running"]')).toHaveAttribute("style", /run-executing/);
  await expect(detailActivity.locator('[data-status="completed"]')).toHaveAttribute("style", /run-completed-successfully/);
  await expect(detailActivity.locator('[data-status="failed"]')).toHaveAttribute("style", /run-completed-with-errors/);
  await expect(page.getByRole("link", { name: "redis / billing" })).toHaveAttribute("href", "/skyline/queues/queue_billing");
  await page.getByLabel("Run status").selectOption("failed");
  await expect(page).toHaveURL(/status=failed/);
  await page.getByLabel("Time range").selectOption("7d");
  await expect(page).toHaveURL(/period=7d/);
  await page.locator('a[href^="/skyline/runs/run-1"]').click();
  await expect(page).toHaveURL(/\/skyline\/runs\/run-1\?tableState=/);
});

test("paired pinned Trigger Jobs contract preserves geometry, interaction, focus, and semantics", async ({ page }) => {
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readFileSync(new URL(`../../../trigger.dev/${source.path}`, import.meta.url));
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }

  await page.setViewportSize(baseline.viewport);
  await routeJobs(page);
  await page.goto("/skyline/jobs");

  const sideMenu = page.getByTestId("side-menu");
  const filters = page.getByLabel("Job filters");
  const search = page.getByPlaceholder("Search Jobs…");
  const searchWrapper = search.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' min-w-52 ')][1]");
  await expect.poll(async () => (await sideMenu.boundingBox())?.width).toBe(224);
  await expect.poll(async () => (await filters.boundingBox())?.height).toBe(baseline.contract.list.filterHeight);
  await expect.poll(async () => (await searchWrapper.boundingBox())?.width).toBeGreaterThanOrEqual(baseline.contract.list.searchMinWidth);
  await expect(page.getByRole("columnheader").allTextContents()).resolves.toEqual([
    "Job", "Recent status", "Activity", "Runs", "First observed", "Last observed", "Latest Run",
  ]);

  await search.fill("invoice");
  await expect(search).toBeFocused();
  await search.press(baseline.contract.interaction.searchSubmitKey);
  await expect(page).toHaveURL(/search=invoice/);
  await search.press(baseline.contract.interaction.searchClearKey);
  await expect(search).toBeFocused();
  await expect(page).not.toHaveURL(/search=/);
  await search.press(baseline.contract.interaction.searchClearKey);
  await expect(search).not.toBeFocused();

  await page.getByRole("link", { name: "GenerateMonthlyInvoices" }).first().click();
  const activity = page.getByRole("region", { name: "Run activity" });
  const sidebar = page.getByLabel("Job details");
  await expect.poll(async () => (await activity.boundingBox())?.height).toBeCloseTo(baseline.contract.detail.activityDefaultHeight, 0);
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeCloseTo(baseline.contract.detail.sidebarDefaultWidth, 0);
  await expect(page.getByRole("link", { name: "redis / billing" })).toHaveAttribute("href", "/skyline/queues/queue_billing");
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
  await expect(page.getByRole("heading", { name: longName })).toBeVisible();
  await expect(page.getByText("No activity in this time range.")).toBeVisible();
  await expect(page.getByLabel("Job details").getByText("—")).toBeVisible();
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

test("sidebar customization hides a favorite persistently", async ({ page }) => {
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
  await expect(page.getByRole("alert")).toContainText("Telemetry unavailable.");
  mode = "not-found";
  await page.goto("/skyline/jobs/job_missing");
  await expect(page.getByRole("alert")).toContainText("The Job type was not found.");
});

async function routeJobs(page: Page) {
  await page.route("**/skyline/api/jobs**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ json: pathname.endsWith("/api/jobs") ? jobsPage() : jobDetail() });
  });
}

function jobsPage(): JobsPageDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00.000000000Z",
    capabilities: capabilities(),
    jobs: [jobSummary()],
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
    queueTargets: [{ id: "queue_billing", connection: "redis", queue: "billing", runCount: 3, href: "/skyline/queues/queue_billing" }],
    activity: [{ timestamp: "2026-08-05T00:00:00Z", total: 3, statusCounts: counts() }],
    runs: [{
      id: "run-1", traceId: "trace-1", isRoot: true, name: "App\\Jobs\\GenerateMonthlyInvoices", status: "failed", connection: "redis", queue: "billing",
      attemptCount: 2, triggeredAt: "2026-08-05T11:59:00.000000000Z", queuedAt: "2026-08-05T11:59:00.000000000Z",
      startedAt: "2026-08-05T11:59:00.001000000Z", finishedAt: "2026-08-05T11:59:01.001000000Z", queueDurationUs: 1_000,
      durationUs: 1_000_000, activeDurationUs: null, revision: 2,
    }],
    pagination: { previous: null, next: "next" },
    tableState: "job-table-state",
    filters: { status: [], period: "all" },
    options: { statuses: ["queued", "running", "retrying", "completed", "failed"], timeRanges },
    hasAnyRuns: true,
  };
}

function jobSummary() {
  return {
    id: "job_invoice",
    name: "App\\Jobs\\GenerateMonthlyInvoices",
    href: "/skyline/jobs/job_invoice",
    firstObservedAt: "2026-08-01T12:00:00.000000000Z",
    lastObservedAt: "2026-08-05T12:00:00.000000000Z",
    runCount: 3,
    statusCounts: counts(),
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
