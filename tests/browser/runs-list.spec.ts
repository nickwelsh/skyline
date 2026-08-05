import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { RunsPageDto } from "../../resources/js/skyline/dto";
import fixture from "./fixtures/nw-217-runs.json" with { type: "json" };

const traceId = "00000000000000000000000000000001";

test("pinned shell identifies the Application and keeps Runs state in basename URLs", async ({ page }) => {
  await routeRuns(page, pageResponse("completed"));
  await page.goto("/skyline");

  await expect(page).toHaveURL(/\/skyline\/runs$/);
  await expect(page.getByText("Fixture Laravel", { exact: true })).toBeVisible();
  await expect(page.getByText("testing", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await expect(page.getByText("Trigger.dev")).toHaveCount(0);
  await expect(page.getByText("PROTOTYPE")).toHaveCount(0);

  await page.getByLabel("Search Runs").fill("invoice");
  await expect(page).toHaveURL(/search=invoice/);
  await page.getByLabel("Status").selectOption("running");
  await expect(page).toHaveURL(/status=running/);
  await page.getByLabel("Job type").selectOption("App\\Jobs\\GenerateMonthlyInvoices");
  await page.getByLabel("Queue target").selectOption(`redis\u0000default`);
  await page.getByLabel("Trace").selectOption(traceId);
  await page.getByLabel("Root Runs only").click();
  await page.getByLabel("Triggered from").fill("2026-08-05T08:00");
  await page.getByLabel("Triggered to").fill("2026-08-05T09:00");
  await expect(page).toHaveURL(/job=App%5CJobs%5CGenerateMonthlyInvoices/);
  await expect(page).toHaveURL(/connection=redis/);
  await expect(page).toHaveURL(/trace=00000000000000000000000000000001/);
  await expect(page).toHaveURL(/rootOnly=true/);
  await expect(page).toHaveURL(/triggeredFrom=/);
  await expect(page).toHaveURL(/triggeredTo=/);

  await page.locator('a[href*="cursor=next-cursor"]').click();
  await expect(page).toHaveURL(/cursor=next-cursor/);
  await expect(page).toHaveURL(/direction=forward/);
  await page.getByText("GenerateMonthlyInvoices", { exact: true }).click();
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
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main")).toHaveScreenshot("nw-217/skyline-runs.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
});

test("Runs exposes loading, initial-empty, filtered-empty, API-error, and polling states", async ({ page }) => {
  let requests = 0;
  let mode: "populated" | "initial-empty" | "filtered-empty" | "error" = "populated";
  await page.route("**/skyline/api/runs**", async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, requests === 1 ? 150 : 0));
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

  await page.goto("/skyline/runs");
  await expect(page.getByLabel("Loading Runs")).toBeVisible();
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThan(1);
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  const requestsAfterCompletion = requests;
  await expect.poll(() => requests).toBeGreaterThan(requestsAfterCompletion);

  mode = "initial-empty";
  await page.goto("/skyline/runs");
  await expect(page.getByRole("heading", { name: "No Runs yet" })).toBeVisible();
  mode = "filtered-empty";
  await page.goto("/skyline/runs?search=missing");
  await expect(page.getByRole("heading", { name: "No matching Runs" })).toBeVisible();
  mode = "error";
  await page.goto("/skyline/runs");
  await expect(page.getByRole("alert")).toContainText("Telemetry unavailable.");
});

async function routeRuns(page: Page, response: ReturnType<typeof pageResponse>) {
  await page.route("**/skyline/api/runs**", (route) => route.fulfill({ json: response }));
}

function pageResponse(status: "running" | "completed" = "running") {
  const response = structuredClone(fixture.apiResponse) as RunsPageDto;
  response.runs[0].status = status;
  response.runs[0].finishedAt = status === "completed" ? "2026-08-05T11:59:01.001000000Z" : null;
  response.runs[0].durationUs = status === "completed" ? 1_000_000 : null;
  response.runs[0].activeDurationUs = status === "running" ? 1_000_000 : null;
  response.runs[0].revision = status === "completed" ? 2 : 1;
  return response;
}
