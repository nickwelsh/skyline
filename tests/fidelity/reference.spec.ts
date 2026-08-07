import { expect, test } from "@playwright/test";
import { prepareCapture, settleCapture } from "./support/capture";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { parseScenario } from "./support/skyline";
import { seedOwnedState } from "./support/states";
import { captureAccessibilityTree } from "./support/accessibility";
import { captureAxe } from "./support/axe";
import { observeAction } from "./support/actions";

test.setTimeout(20_000);

const cases = [
  { id: "jobs-populated", text: "Tasks" },
  { id: "job-found", text: "GenerateMonthlyInvoices" },
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
    await expectReferenceHealthy(page);
    expect(errors).toEqual([]);
  });
}

test("reference environment boundary owns API errors", async ({ page }) => {
  await installReferenceFixture(page, await createReferenceFixture());
  await page.goto("http://127.0.0.1:4185/oracle/runs-api-error", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);

  const presenter = page.locator(".fixed.inset-0");
  await expect(presenter).toContainText("Error");
  await expect(presenter).toContainText("Deterministic telemetry error.");
  await expect(presenter.getByRole("link", { name: /Go to homepage/ })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Skyline" })).toHaveCount(0);
});

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
  await expectReferenceHealthy(page);
  expect(errors).toEqual([]);
});

test("reference error-found settles at its canonical error route", async ({ page }) => {
  const capture = "error-found@1440x960-classic";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await prepareCapture(page, capture, "/reference");
  await seedOwnedState(page, parseScenario(capture), "/reference");
  await installReferenceFixture(page, await createReferenceFixture());
  await page.goto("http://127.0.0.1:4185/oracle/error-found", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);
  await settleCapture(page);
  await Promise.all([
    page.screenshot({ animations: "disabled", caret: "hide" }),
    captureAccessibilityTree(page),
    captureAxe(page),
    observeAction(page, "captured"),
  ]);
  await expectReferenceHealthy(page);
  await expect(page).toHaveURL(/\/oracle\/error-found$/);
  await expect.poll(() => page.evaluate(() => (window as Window & { __oracleCanonicalUrl?: string }).__oracleCanonicalUrl)).toMatch(/^\/skyline\/errors\//);
  expect(errors).toEqual([]);
});

test("reference log-found selects its pinned event without fallback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = await createReferenceFixture();
  const selectedLog = (fixture.loaders.log as { selectedLog: { id: string } }).selectedLog;
  await installReferenceFixture(page, fixture);
  await page.goto("http://127.0.0.1:4185/oracle/log-found", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);
  await expect(page).toHaveURL(new RegExp(`/oracle/log-found\\?event=${selectedLog.id}$`));
  await expect(page.getByText("Invoice import delayed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Log not found|Failed to load log details/)).toHaveCount(0);
  await expectReferenceHealthy(page);
  expect(errors).toEqual([]);
});

test("reference queues-populated renders pinned metrics and observed queue identity", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installReferenceFixture(page, await createReferenceFixture());
  await page.goto("http://127.0.0.1:4185/oracle/queues-populated", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);
  await expect(page.getByRole("heading", { name: "Queues" })).toBeVisible();
  await expect(page.getByRole("link", { name: "default", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Delay p95" })).toBeVisible();
  await expect(page.getByRole("button", { name: /pause|resume/i })).toHaveCount(0);
  await expect(page.getByText("Unable to load metrics", { exact: true })).toHaveCount(0);
  await expectReferenceHealthy(page);
  expect(errors).toEqual([]);
});

test("reference queue-found renders pinned detail charts from observed resources", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installReferenceFixture(page, await createReferenceFixture());
  await page.goto("http://127.0.0.1:4185/oracle/queue-found", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);
  await expect(page.getByRole("heading", { name: "default" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
  for (const title of ["Concurrency", "Queue depth", "Scheduling delay"]) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /pause|resume/i })).toHaveCount(0);
  await expectReferenceHealthy(page);
  expect(errors).toEqual([]);
});

test("reference app shell fills the viewport", async ({ page }) => {
  await installReferenceFixture(page, await createReferenceFixture());
  await page.goto("http://127.0.0.1:4185/oracle/runs-populated", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);
  await expect(page.locator("#reference > div")).toHaveCSS("height", "960px");
  await expectReferenceHealthy(page);
});

test("reference pins Trigger's mobile canvas", async ({ page }) => {
  const capture = "error-found@390x844-classic";
  await prepareCapture(page, capture, "/reference");
  await seedOwnedState(page, parseScenario(capture), "/reference");
  await installReferenceFixture(page, await createReferenceFixture());
  await page.goto("http://127.0.0.1:4185/oracle/error-found", { waitUntil: "domcontentloaded", timeout: 10_000 });
  await waitForReference(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
  await expectReferenceHealthy(page);
});

for (const id of ["shell-populated", "runs-populated", "errors-populated", "logs-populated", "queues-populated", "run-found", "error-found", "log-found", "queue-found"]) {
  test(`reference boots ${id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await installReferenceFixture(page, await createReferenceFixture());
    await page.goto(`http://127.0.0.1:4185/oracle/${id}`, { waitUntil: "domcontentloaded", timeout: 10_000 });
    await waitForReference(page);
    await expectReferenceHealthy(page);
    expect(errors).toEqual([]);
  });
}

async function expectReferenceHealthy(page: import("@playwright/test").Page) {
  try {
    await expect(page.locator("body")).not.toContainText(
      /Unexpected Application Error|ReferenceError|TypeError|404: Page not found/
    );
  } catch (error) {
    const state = await page.evaluate(() => (window as Window & {
      __oracleRouter?: { state?: unknown };
    }).__oracleRouter?.state);
    throw new Error(`Reference health failed: ${JSON.stringify(state)}`, { cause: error });
  }
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
