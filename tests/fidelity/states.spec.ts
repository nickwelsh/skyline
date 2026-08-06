import { expect, test } from "@playwright/test";
import fixture from "./fixtures.json" with { type: "json" };
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState } from "./support/states";

test("Logs owned filter state uses source Tasks and Run ID controls", async ({ page }) => {
  const scenario = parseScenario("logs-job-run-filters@classic@1440x960");
  const installed = await installSkylineFixture(page, scenario);
  await page.goto(scenarioPath(scenario, installed.catalog));

  await exposeOwnedState(page, scenario, "skyline");

  const url = new URL(page.url());
  expect(url.searchParams.get("jobType")).toBe(fixture.values.jobType);
  expect(url.searchParams.get("runId")).toBe(fixture.ids.run);
});

test("Queue paginated-runs owned state exposes the recorded Runs table", async ({ page }) => {
  const scenario = parseScenario("queues-paginated-runs@classic@1440x960");
  const installed = await installSkylineFixture(page, scenario);
  await page.goto(scenarioPath(scenario, installed.catalog));

  await exposeOwnedState(page, scenario, "skyline");

  const recordedRuns = page.getByRole("region", { name: "Recorded runs" });
  await expect(recordedRuns.getByRole("table")).toBeVisible();
  await expect(recordedRuns.locator('a[href*="cursor=fixture-next"]')).toBeVisible();
});
