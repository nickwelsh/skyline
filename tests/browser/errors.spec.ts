import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { ErrorGroupDetailDto, ErrorGroupsPageDto, ExceptionDetails, SkylineCapabilities } from "../../resources/js/skyline/dto";
import baseline from "./fixtures/nw-224-trigger-errors-baseline.json" with { type: "json" };

const errorId = `err_${"a".repeat(64)}`;
const jobType = "App\\Jobs\\GenerateMonthlyInvoices";

test("paired pinned Trigger Errors contract preserves geometry, filters, evidence, and observed links", async ({ page }) => {
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readFileSync(new URL(`../../../trigger.dev/${source.path}`, import.meta.url));
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }
  await routeErrors(page);
  await page.goto("/skyline/errors");

  await expect(page.getByRole("navigation", { name: "Application" }).getByRole("link", { name: "Errors" })).toHaveAttribute("href", "/skyline/errors");
  await expect(page.getByRole("heading", { name: "Errors" })).toBeVisible();
  await expect.poll(async () => (await page.getByLabel("Error group filters").boundingBox())?.height).toBe(baseline.contract.geometry.listFilterHeight);
  await expect(page.getByRole("columnheader").allTextContents()).resolves.toEqual(["ID", "Job", "Exception", "Error", "Occurrences", "Latest", "First seen", "Last seen"]);
  await expect(page.getByText("Connection timed out for tenant 7413", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /resolve|ignore|assign|replay|cancel/i })).toHaveCount(0);

  await page.getByLabel("Job type").selectOption(jobType);
  await expect(page).toHaveURL(/jobType=App%5CJobs%5CGenerateMonthlyInvoices/);
  await page.getByLabel("Exception class").selectOption("RuntimeException");
  await expect(page).toHaveURL(/exceptionClass=RuntimeException/);
  await page.getByLabel("Time range").selectOption("24h");
  await expect(page).toHaveURL(/period=24h/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/skyline\/errors$/);

  const errorLink = page.locator(`a[href="/skyline/errors/${errorId}"]`).first();
  await expect(errorLink).toHaveAttribute("tabindex", "0");
  await errorLink.focus();
  await errorLink.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/skyline/errors/${errorId}$`));
  await expect(page.getByRole("heading", { name: "Occurrence activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Failed Attempts" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Error occurrences over time" })).toBeVisible();
  await expect.poll(async () => (await page.getByLabel("Error group details").boundingBox())?.width).toBeCloseTo(baseline.contract.geometry.detailSidebarWidth, 0);
  await expect(page.getByRole("region", { name: "Exception" })).toContainText("Connection timed out for tenant 7413");
  await expect(page.getByRole("button", { name: "Show 2 frames" })).toBeVisible();
  await expect(page.getByRole("link", { name: jobType })).toHaveAttribute("href", "/skyline/jobs/job_invoice");
  await expect(page.getByRole("link", { name: "Attempt 2" })).toHaveAttribute("href", "/skyline/runs/run_invoice?attempt=2");
  await expect(page.getByRole("link", { name: "run_invoice" })).toHaveAttribute("href", "/skyline/runs/run_invoice");
  await expect(page.getByRole("button", { name: /resolve|ignore|assign|replay|cancel/i })).toHaveCount(0);
});

test("Errors URL-cursor paginate groups and failed Attempts", async ({ page }) => {
  await page.route("**/skyline/api/errors**", async (route) => {
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");
    if (url.pathname.endsWith(errorId)) {
      const response = detailResponse();
      response.failedAttempts = [occurrence(cursor === "next-attempts" ? "run_next" : "run_invoice")];
      response.pagination = cursor === "next-attempts" ? { previous: "previous-attempts", next: null } : { previous: null, next: "next-attempts" };
      return route.fulfill({ json: response });
    }
    const response = listResponse();
    response.errorGroups = [summary(cursor === "next-errors" ? `err_${"b".repeat(64)}` : errorId, cursor === "next-errors" ? "LogicException" : "RuntimeException")];
    response.pagination = cursor === "next-errors" ? { previous: "previous-errors", next: null } : { previous: null, next: "next-errors" };
    return route.fulfill({ json: response });
  });

  await page.goto("/skyline/errors");
  await page.locator('a[href*="cursor=next-errors"]').click();
  await expect(page).toHaveURL(/cursor=next-errors&direction=forward/);
  await expect(page.getByRole("link", { name: "LogicException" })).toBeVisible();
  await page.locator('a[href*="cursor=previous-errors"]').click();
  await expect(page).toHaveURL(/cursor=previous-errors&direction=backward/);

  await page.goto(`/skyline/errors/${errorId}`);
  await expect(page.getByText("run_invoice", { exact: true })).toBeVisible();
  await page.locator('a[href*="cursor=next-attempts"]').click();
  await expect(page).toHaveURL(/cursor=next-attempts&direction=forward/);
  await expect(page.getByText("run_next", { exact: true })).toBeVisible();
  await page.locator('a[href*="cursor=previous-attempts"]').click();
  await expect(page).toHaveURL(/cursor=previous-attempts&direction=backward/);
});

test("Errors cover loading, long evidence, empty, filtered-empty, API-error, and not-found states", async ({ page }) => {
  let mode: "populated" | "initial-empty" | "filtered-empty" | "error" = "populated";
  let delay = false;
  await page.route("**/skyline/api/errors**", async (route) => {
    const url = new URL(route.request().url());
    if (delay) await new Promise((resolve) => setTimeout(resolve, 200));
    if (url.pathname.endsWith("err_missing")) return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Missing." } } });
    if (mode === "error") return route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Error evidence unavailable." } } });
    if (url.pathname.endsWith(errorId)) return route.fulfill({ json: detailResponse() });
    const response = listResponse();
    if (mode !== "populated") {
      response.errorGroups = [];
      response.hasAnyErrorGroups = mode === "filtered-empty";
      response.filters.exceptionClass = mode === "filtered-empty" ? "MissingException" : null;
    }
    return route.fulfill({ json: response });
  });

  await page.goto("/skyline/errors");
  delay = true;
  await page.getByLabel("Time range").selectOption("7d");
  await expect(page.getByLabel("Loading Errors")).toBeVisible();
  delay = false;
  mode = "initial-empty";
  await page.goto("/skyline/errors");
  await expect(page.getByRole("heading", { name: "No Error groups yet" })).toBeVisible();
  mode = "filtered-empty";
  await page.goto("/skyline/errors?exceptionClass=MissingException");
  await expect(page.getByRole("heading", { name: "No matching Error groups" })).toBeVisible();
  mode = "error";
  await page.goto("/skyline/errors");
  await expect(page.getByRole("alert")).toContainText("Error evidence unavailable.");
  mode = "populated";
  await page.goto("/skyline/errors/err_missing");
  await expect(page.getByRole("alert")).toContainText("Error group not found");
  await page.goto(`/skyline/errors/${errorId}?period=1h`);
  await expect(page.getByText("/srv/application/app/Jobs/GenerateMonthlyInvoices.php:42")).toBeVisible();
});

async function routeErrors(page: Page) {
  await page.route("**/skyline/api/errors**", async (route) => {
    const url = new URL(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: url.pathname.endsWith(errorId) ? detailResponse() : listResponse(url) });
  });
}

function listResponse(url?: URL): ErrorGroupsPageDto {
  const response: ErrorGroupsPageDto = {
    schemaVersion: 1, packageVersion: "fixture", generatedAt: "2026-08-05T12:00:00.000000000Z", capabilities: capabilities(),
    errorGroups: [summary(errorId, "RuntimeException")], pagination: { previous: null, next: null },
    filters: { jobType: null, exceptionClass: null, period: "all" },
    options: { jobTypes: [jobType], exceptionClasses: ["RuntimeException", "LogicException"], timeRanges }, hasAnyErrorGroups: true,
  };
  if (url) {
    response.filters.jobType = url.searchParams.get("jobType");
    response.filters.exceptionClass = url.searchParams.get("exceptionClass");
    response.filters.period = (url.searchParams.get("period") as ErrorGroupsPageDto["filters"]["period"]) ?? "all";
  }
  return response;
}

function detailResponse(): ErrorGroupDetailDto {
  return {
    schemaVersion: 1, packageVersion: "fixture", generatedAt: "2026-08-05T12:00:00.000000000Z", capabilities: capabilities(),
    errorGroup: summary(errorId, "RuntimeException"), representative: exception(),
    activity: [{ timestamp: "2026-08-05T10:00:00Z", occurrences: 2 }, { timestamp: "2026-08-05T11:00:00Z", occurrences: 1 }],
    failedAttempts: [occurrence("run_invoice")], pagination: { previous: null, next: null },
    filters: { period: "all" }, options: { timeRanges }, hasAnyOccurrences: true,
  };
}

function summary(id: string, exceptionClass: string): ErrorGroupsPageDto["errorGroups"][number] {
  return {
    id, fingerprint: `fp:${id}`, href: `/skyline/errors/${id}`, jobType, jobId: "job_invoice", jobHref: "/skyline/jobs/job_invoice",
    exceptionClass, representativeMessage: "Connection timed out for tenant 7413", firstObservedAt: "2026-08-04T10:00:00Z",
    lastObservedAt: "2026-08-05T11:59:00Z", occurrenceCount: 3,
    latest: { runId: "run_invoice", attemptNumber: 2, observedAt: "2026-08-05T11:59:00Z", runHref: "/skyline/runs/run_invoice", attemptHref: "/skyline/runs/run_invoice?attempt=2" },
  };
}

function occurrence(runId: string): ErrorGroupDetailDto["failedAttempts"][number] {
  return {
    id: `occ_${runId}`, runId, attemptNumber: 2, jobType, startedAt: "2026-08-05T11:58:00Z", finishedAt: "2026-08-05T11:59:00Z",
    observedAt: "2026-08-05T11:59:00Z", runHref: `/skyline/runs/${runId}`, attemptHref: `/skyline/runs/${runId}?attempt=2`, exception: exception(),
  };
}

function exception(): ExceptionDetails {
  return {
    class: "RuntimeException", message: "Connection timed out for tenant 7413", messageTruncated: false, messageOriginalBytes: 36, code: "504",
    location: { file: "/srv/application/app/Jobs/GenerateMonthlyInvoices.php", line: 42, href: null },
    frames: [
      { file: "/srv/application/app/Jobs/GenerateMonthlyInvoices.php", line: 42, class: jobType, type: "->", function: "handle", isVendor: false, href: null, snippet: { code: "public function handle(): void\n{\n    throw new RuntimeException('timeout');\n}", startingLine: 40, highlightedLine: 42 } },
      { file: "/srv/application/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php", line: 36, class: "Illuminate\\Container\\BoundMethod", type: "::", function: "call", isVendor: true, href: null, snippet: null },
    ],
    framesTruncated: false, markdown: "# RuntimeException\n\nConnection timed out for tenant 7413",
  };
}

const timeRanges = [
  { value: "1h" as const, label: "Last hour" }, { value: "24h" as const, label: "Last 24 hours" },
  { value: "7d" as const, label: "Last 7 days" }, { value: "30d" as const, label: "Last 30 days" }, { value: "all" as const, label: "All time" },
];

function capabilities(): SkylineCapabilities {
  return {
    navigation: { jobs: true, runs: true, queues: true, errors: true }, jobs: { view: true, testJob: false },
    errors: { view: true, assign: false, ignore: false, resolve: false, alerts: false, replay: false, cancel: false, versions: false, bulkActions: false },
    runs: { view: true, cancel: false, replay: false }, shell: { shortcuts: true },
  };
}
