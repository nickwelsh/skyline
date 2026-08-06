import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { ErrorGroupDetailDto, ErrorGroupsPageDto, ExceptionDetails, SkylineCapabilities } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import errorsScenario from "./fixtures/nw-224-trigger-errors-scenario.json" with { type: "json" };
import baseline from "./fixtures/nw-224-trigger-errors-baseline.json" with { type: "json" };

const primaryError = errorsScenario.errorGroups[0];
const secondaryError = errorsScenario.errorGroups[1];
const errorId = primaryError.id;
const jobType = primaryError.taskIdentifier;

test("paired pinned Trigger Errors contract preserves geometry, filters, evidence, and observed links", async ({ page }) => {
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readFileSync(new URL(`../../../trigger.dev/${source.path}`, import.meta.url));
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }

  const referencePage = await page.context().newPage();
  await referencePage.goto("http://127.0.0.1:4175/errors");
  await expect(referencePage.getByRole("table")).toBeVisible();
  await expect(referencePage.getByRole("columnheader").allTextContents()).resolves.toEqual(["ID", "Status", "Task", "Error", "Occurrences", "Activity", "First seen", "Last seen"]);
  await expect(referencePage.locator("thead th[scope=col]")).toHaveCount(8);
  await expect(referencePage.locator("tbody tr")).toHaveCount(2);
  const triggerErrorLink = referencePage.locator(`a[href="/errors/${primaryError.fingerprint}"]`).first();
  await expect(triggerErrorLink).toHaveAttribute("tabindex", "-1");
  const triggerListVisuals = await errorListVisuals(referencePage);
  await triggerErrorLink.focus();
  await triggerErrorLink.press("Enter");
  await expect(referencePage).toHaveURL(new RegExp(`/errors/${primaryError.fingerprint}$`));
  const triggerDetailVisuals = await errorDetailVisuals(referencePage);

  await routeErrors(page);
  await page.goto("/skyline/errors");

  await expect(page.getByRole("navigation", { name: "Application" }).getByRole("link", { name: "Errors" })).toHaveAttribute("href", "/skyline/errors");
  await expect(page.getByRole("heading", { name: "Errors" })).toBeVisible();
  await expect(page.getByRole("columnheader").allTextContents()).resolves.toEqual(["ID", "Job type", "Error", "Occurrences", "Activity", "First seen", "Last seen"]);
  await expect(page.locator("thead th[scope=col]")).toHaveCount(7);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText(primaryError.errorMessage, { exact: true })).toBeVisible();
  await expect(page.locator("tbody").getByText("321", { exact: true })).toBeVisible();
  await expect(page.locator("tbody").getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /resolve|ignore|assign|replay|cancel/i })).toHaveCount(0);
  expect(await errorListVisuals(page)).toEqual(triggerListVisuals);

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
  const exceptionEvidence = page.getByRole("region", { name: "Exception" });
  await expect(exceptionEvidence).toContainText(primaryError.errorMessage);
  await exceptionEvidence.getByRole("button", { name: "Show 3 frames" }).click();
  await expect(exceptionEvidence.getByRole("button", { name: `${jobType}->handle` })).toBeVisible();
  const vendorFrames = exceptionEvidence.getByRole("button", { name: "2 vendor frames" });
  await vendorFrames.click();
  await expect(exceptionEvidence).toContainText("Illuminate\\Container\\BoundMethod::call");
  await expect(exceptionEvidence).toContainText("Illuminate\\Queue\\CallQueuedHandler->call");
  await expect(page.getByRole("link", { name: jobType })).toHaveAttribute("href", "/skyline/jobs/job_invoice");
  await expect(page.getByRole("link", { name: "Attempt 2" })).toHaveAttribute("href", "/skyline/runs/run_invoice?attempt=2");
  await expect(page.getByRole("link", { name: "run_invoice" })).toHaveAttribute("href", "/skyline/runs/run_invoice");
  await expect(page.getByRole("button", { name: /resolve|ignore|assign|replay|cancel/i })).toHaveCount(0);
  expect(await errorDetailVisuals(page)).toEqual(triggerDetailVisuals);
  await referencePage.close();
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
  let detailMode: "populated" | "filtered-empty" | "error" = "populated";
  let delay = false;
  let delayDetail = false;
  await page.route("**/skyline/api/errors**", async (route) => {
    const url = new URL(route.request().url());
    if (delay || (delayDetail && url.pathname.endsWith(errorId))) await new Promise((resolve) => setTimeout(resolve, 200));
    if (url.pathname.endsWith("err_missing")) return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Missing." } } });
    if (mode === "error") return route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Error evidence unavailable." } } });
    if (url.pathname.endsWith(errorId)) {
      if (detailMode === "error") return route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Error detail unavailable." } } });
      const response = detailResponse();
      if (detailMode === "filtered-empty") {
        response.failedAttempts = [];
        response.activity = [];
        response.filters.period = "1h";
        response.hasAnyOccurrences = true;
      }
      return route.fulfill({ json: response });
    }
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

  await page.goto(`/skyline/errors/${errorId}`);
  delayDetail = true;
  await page.getByLabel("Time range").selectOption("24h");
  await expect(page.getByLabel("Loading Error group")).toBeVisible();
  delayDetail = false;

  detailMode = "filtered-empty";
  await page.goto(`/skyline/errors/${errorId}?period=1h`);
  await expect(page.getByRole("heading", { name: "No matching failed Attempts" })).toBeVisible();
  await expect(page.getByText("No occurrences in this time range.")).toBeVisible();

  detailMode = "error";
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Unable to load Error group");

  detailMode = "populated";
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

async function errorListVisuals(page: Page) {
  const table = page.locator("table").first();
  await expect(table).toBeVisible();
  return table.evaluate((element) => {
    const container = element.parentElement!;
    const header = element.querySelector("th")!;
    const row = element.querySelector("tbody tr")!;
    const cell = row.querySelector("td")!;
    const headerStyle = getComputedStyle(header);
    const rowStyle = getComputedStyle(row);
    const cellStyle = getComputedStyle(cell);
    return {
      tableTag: element.tagName,
      headerTag: element.querySelector("thead")?.tagName,
      bodyTag: element.querySelector("tbody")?.tagName,
      containerOverflowX: getComputedStyle(container).overflowX,
      headerFontSize: headerStyle.fontSize,
      headerFontWeight: headerStyle.fontWeight,
      headerPaddingTop: headerStyle.paddingTop,
      headerPaddingBottom: headerStyle.paddingBottom,
      rowPosition: rowStyle.position,
      cellFontSize: cellStyle.fontSize,
    };
  });
}

async function errorDetailVisuals(page: Page) {
  const heading = page.getByRole("heading", { name: "Details" });
  await expect(heading).toBeVisible();
  return heading.evaluate((element) => {
    const sidebar = element.parentElement?.parentElement;
    const panel = sidebar?.parentElement;
    const handle = panel?.previousElementSibling;
    const main = handle?.previousElementSibling;
    const grid = main?.firstElementChild;
    if (!sidebar || !panel || !handle || !main || !grid) throw new Error("Error detail geometry unavailable.");
    const headingStyle = getComputedStyle(element);
    const rows = getComputedStyle(grid).gridTemplateRows.split(" ");
    return {
      activityHeight: rows[0],
      sidebarWidth: Math.round(panel.getBoundingClientRect().width),
      handleWidth: getComputedStyle(handle).width,
      sidebarBackground: getComputedStyle(sidebar).backgroundColor,
      headingFontSize: headingStyle.fontSize,
      headingFontWeight: headingStyle.fontWeight,
    };
  });
}

function listResponse(url?: URL): ErrorGroupsPageDto {
  const response: ErrorGroupsPageDto = {
    schemaVersion: 1, packageVersion: "fixture", generatedAt: "2026-08-05T12:00:00.000000000Z", capabilities: capabilities(),
    errorGroups: [summary(errorId, "RuntimeException", primaryError), summary(secondaryError.id, "LogicException", secondaryError)], pagination: { previous: null, next: null },
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

function summary(id: string, exceptionClass: string, fixture = primaryError): ErrorGroupsPageDto["errorGroups"][number] {
  return {
    id, fingerprint: `fp:${id}`, href: `/skyline/errors/${id}`, jobType: fixture.taskIdentifier, jobId: "job_invoice", jobHref: "/skyline/jobs/job_invoice",
    exceptionClass, representativeMessage: fixture.errorMessage, firstObservedAt: fixture.firstSeen,
    lastObservedAt: fixture.lastSeen, occurrenceCount: fixture.count,
    activity: [{ timestamp: "2026-08-05T10:00:00Z", occurrences: 2 }, { timestamp: "2026-08-05T11:00:00Z", occurrences: 1 }],
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
  return structuredClone(errorsScenario.representative) as ExceptionDetails;
}

const timeRanges = [
  { value: "1h" as const, label: "Last hour" }, { value: "24h" as const, label: "Last 24 hours" },
  { value: "7d" as const, label: "Last 7 days" }, { value: "30d" as const, label: "Last 30 days" }, { value: "all" as const, label: "All time" },
];

function capabilities(): SkylineCapabilities {
  return fixtureCapabilities;
}
