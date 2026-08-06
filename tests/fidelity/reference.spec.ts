import { expect, test } from "@playwright/test";
import { prepareCapture } from "./support/capture";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { parseScenario } from "./support/skyline";
import { seedOwnedState } from "./support/states";

test.setTimeout(20_000);

const cases = [
  { id: "jobs-populated", text: "Tasks" },
  { id: "job-found", text: "Runs" },
  { id: "runs-api-error", text: "Deterministic telemetry error." },
] as const;

for (const scenario of cases) {
  test(`reference ${scenario.id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await installReferenceFixture(page, await createReferenceFixture());
    await page.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await waitForReference(page);
    await expect(page.getByText(scenario.text, { exact: false }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await expect(page.locator("body")).not.toContainText("ReferenceError");
    expect(errors).toEqual([]);
  });
}

test("reference paired jobs-populated readiness", async ({ page }) => {
  const capture = "jobs-populated@1440x960-classic";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await prepareCapture(page, capture, "/reference");
  await seedOwnedState(page, parseScenario(capture), "/reference");
  await installReferenceFixture(page, await createReferenceFixture());
  await page.goto("http://127.0.0.1:4185/oracle/jobs-populated", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);
  await expect(page.getByText("Tasks", { exact: true }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Unexpected Application Error|ReferenceError/);
  expect(errors).toEqual([]);
});

for (const id of ["shell-populated", "runs-populated", "errors-populated", "logs-populated", "queues-populated", "run-found", "error-found", "log-found", "queue-found"]) {
  test(`reference boots ${id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await installReferenceFixture(page, await createReferenceFixture());
    await page.goto(`http://127.0.0.1:4185/oracle/${id}`, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await waitForReference(page);
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
    await expect(page.locator("body")).not.toContainText("ReferenceError");
    expect(errors).toEqual([]);
  });
}

async function waitForReference(page: import("@playwright/test").Page) {
  try {
    await page.locator("html[data-oracle-ready='true']").waitFor({ timeout: 10_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      booted: document.documentElement.dataset.oracleBooted,
      ready: document.documentElement.dataset.oracleReady,
      fonts: document.fonts.status,
      body: document.body.textContent?.slice(0, 500),
      router: (window as Window & { __oracleRouter?: { state?: unknown } }).__oracleRouter?.state,
    }));
    throw new Error(`Reference readiness failed: ${JSON.stringify(state)}`, { cause: error });
  }
}
