import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { RunsPageDto } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import fixture from "./fixtures/nw-217-runs.json" with { type: "json" };
import { createFirstResponseGate } from "./support/deferred-response";

const traceId = "00000000000000000000000000000001";

test("pinned shell identifies the Application and keeps Runs state in basename URLs", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-05T12:34:56.000Z"));
  await routeRuns(page, pageResponse("completed"));
  await page.goto("/skyline");

  await expect(page).toHaveURL(/\/skyline\/runs$/);
  await expect(page.getByText("Fixture Laravel", { exact: true })).toBeVisible();
  await expect(page.getByTestId("side-menu-application")).toContainText("Application");
  await expect(page.getByTestId("side-menu-application")).toContainText("Production");
  await expect(page.getByTestId("side-menu-project")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect(page.locator("tbody").getByText("App\\Jobs\\GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await page.getByRole("columnheader", { name: "Duration" }).getByRole("button").hover();
  await expect(page.locator('[role="tooltip"]:visible')).toContainText("The amount of compute time used in the run.");
  await expect(page.getByText("Trigger.dev")).toHaveCount(0);
  await expect(page.getByText("PROTOTYPE")).toHaveCount(0);

  await page.getByLabel("Search Runs").fill("invoice");
  await page.getByLabel("Search Runs").press("Enter");
  await expect(page).toHaveURL(/search=invoice/);
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("s");
  await page.getByPlaceholder("Filter by status...").fill("execut");
  await expect(page.getByRole("option", { name: "Executing 1" })).toBeVisible();
  await page.getByRole("option", { name: "Executing 1" }).click();
  await expect(page).toHaveURL(/status=running/);
  await page.getByPlaceholder("Filter by status...").fill("completed");
  await page.getByRole("option", { name: "Completed" }).click();
  await expect(page).toHaveURL(/status=running.*status=completed/);
  await page.keyboard.press("Escape");
  await page.getByRole("switch", { name: "Root only" }).click();
  await expect(page).toHaveURL(/rootOnly=true/);
  await page.getByRole("switch", { name: "Root only" }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Toggle root only");
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("t");
  await page.getByPlaceholder("Filter by job...").fill("GenerateMonthlyInvoices");
  await page.getByRole("option", { name: /GenerateMonthlyInvoices/ }).click();
  await expect(page.getByRole("switch", { name: "Root only" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/rootOnly=/);
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("f");
  await page.getByRole("option", { name: "Queues 1" }).click();
  await page.getByPlaceholder("Filter by queue...").fill("redis / default");
  await page.getByRole("option", { name: "redis / default 1" }).click();
  await expect(page.getByText("Queue:redis / default", { exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("f");
  await page.getByPlaceholder("Filter by...").fill("tra");
  await page.getByRole("option", { name: "Trace 1" }).click();
  await page.getByPlaceholder("Filter by trace...").fill(traceId.slice(-8));
  await page.getByRole("option", { name: `${traceId} 1` }).click();
  await expect(page.getByText(`Trace:${traceId}`, { exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("d");
  await page.getByRole("button", { name: "1 day" }).click();
  await expect(page.getByText("Created:1 day", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/triggeredFrom=2026-08-04T12%3A34%3A56.000Z/);
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("d");
  await page.getByPlaceholder("Custom").fill("2");
  await page.getByRole("button", { name: "hours" }).click();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Created:2 hours", { exact: true })).toBeVisible();
  const committedUrl = page.url();
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("d");
  await page.getByPlaceholder("Custom").fill("0");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Please enter a valid custom duration")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(committedUrl);
  await expect(page.getByText("Created:2 hours", { exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("d");
  await expect(page.getByPlaceholder("Custom")).toHaveValue("2");
  await expect(page.getByText("Please enter a valid custom duration")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("d");
  await page.getByRole("button", { name: "Yesterday" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Created:", { exact: true }).locator("..").locator("..")).toContainText("–");
  await page.getByRole("heading", { name: "Runs" }).click();
  await page.keyboard.press("d");
  await page.getByRole("dialog").locator("button:has(svg.lucide-x)").nth(1).click();
  await page.getByRole("button", { name: "Now" }).first().click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Created after:", { exact: true }).locator("..").locator("..")).toContainText("Aug 5, 2026, 8:34:56 AM");
  await expect(page).toHaveURL(/job=App%5CJobs%5CGenerateMonthlyInvoices/);
  await expect(page).toHaveURL(/connection=redis/);
  await expect(page).toHaveURL(/trace=00000000000000000000000000000001/);
  await expect(page).toHaveURL(/triggeredFrom=2026-08-05T12%3A34%3A56.000Z/);
  await expect(page).not.toHaveURL(/triggeredTo=/);

  await page.locator('a[href*="cursor=next-cursor"]').click();
  await expect(page).toHaveURL(/cursor=next-cursor/);
  await expect(page).toHaveURL(/direction=forward/);
  await page.locator("tbody").getByText("App\\Jobs\\GenerateMonthlyInvoices", { exact: true }).click();
  await expect(page).toHaveURL(/\/skyline\/runs\/run-01\?tableState=/);
  await page.goBack();
  await expect(page).toHaveURL(/cursor=next-cursor/);
});

test("paired pinned Trigger.dev and Skyline Runs fixture stays deterministic", async ({ page }) => {
  const triggerReference = new URL("./runs-list.spec.ts-snapshots/nw-217-trigger-runs.png", import.meta.url);
  const sourceHash = createHash("sha256").update(readFileSync(triggerReference)).digest("hex");
  expect(sourceHash).toBe(fixture.triggerReference.artifactSha256);

  await page.setViewportSize(fixture.viewport);
  await routeRuns(page, pageResponse("completed"));
  await page.goto("/skyline/runs");
  await expect(page.locator("tbody").getByText("App\\Jobs\\GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main")).toHaveScreenshot("nw-217/skyline-runs.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Runs exposes loading, initial-empty, filtered-empty, API-error, and polling states", async ({ page }) => {
  const firstResponse = createFirstResponseGate();
  let requests = 0;
  let mode: "populated" | "initial-empty" | "filtered-empty" | "error" = "populated";
  await page.route("**/skyline/api/runs**", async (route) => {
    requests += 1;
    await firstResponse.hold();
    if (mode === "error") {
      await route.fulfill({ status: 500, json: { error: { code: "read_failed", message: "Telemetry unavailable." } } });
      return;
    }
    const response = pageResponse(requests > 1 ? "completed" : "running");
    if (mode === "initial-empty" || mode === "filtered-empty") {
      response.runs = [];
      response.hasAnyRuns = mode === "filtered-empty";
      response.filters.search = response.hasAnyRuns ? "missing" : null;
    }
    await route.fulfill({ json: response });
  });

  try {
    await page.goto("/skyline/runs");
    await expect(page.getByLabel("Loading Runs")).toBeVisible();
  } finally {
    firstResponse.release();
  }
  await expect(page.getByTestId("side-menu")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeGreaterThanOrEqual(1024);
  await expect(page.locator("tbody").getByText("App\\Jobs\\GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThan(1);
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  const requestsAfterCompletion = requests;
  await expect.poll(() => requests).toBeGreaterThan(requestsAfterCompletion);

  mode = "initial-empty";
  await page.goto("/skyline/runs");
  await expect(page.getByText("No runs found", { exact: true })).toBeVisible();
  mode = "filtered-empty";
  await page.goto("/skyline/runs?search=missing");
  await expect(page.getByText("No runs match your filters.", { exact: true })).toBeVisible();
  mode = "error";
  await page.goto("/skyline/runs");
  await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  await expect(page.getByText("Telemetry unavailable.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to homepage" })).toBeVisible();
});

async function routeRuns(page: Page, response: ReturnType<typeof pageResponse>) {
  await page.route("**/skyline/api/runs**", (route) => route.fulfill({ json: response }));
}

function pageResponse(status: "running" | "completed" = "running") {
  const response = structuredClone(fixture.apiResponse) as unknown as RunsPageDto;
  response.capabilities = fixtureCapabilities;
  response.runs[0].status = status;
  response.runs[0].finishedAt = status === "completed" ? "2026-08-05T11:59:01.001000000Z" : null;
  response.runs[0].durationUs = status === "completed" ? 1_000_000 : null;
  response.runs[0].activeDurationUs = status === "running" ? 1_000_000 : null;
  response.runs[0].revision = status === "completed" ? 2 : 1;
  return response;
}
