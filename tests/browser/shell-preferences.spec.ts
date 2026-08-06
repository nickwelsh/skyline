import { expect, test, type Page } from "@playwright/test";
import type { RunsPageDto } from "../../resources/js/skyline/dto";
import fixture from "./fixtures/nw-217-runs.json" with { type: "json" };

const storageKey = "skyline.ui-preferences.v1:/skyline";

test.beforeEach(async ({ page }) => {
  await page.route("**/skyline/api/runs**", (route) => route.fulfill({ json: structuredClone(fixture.apiResponse) as RunsPageDto }));
});

test("source shell exposes only supported surfaces and persists customization", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      version: 1,
      theme: "system",
      contrast: 70,
      favorites: [
        { id: "favorite-run", label: "Pinned Run", url: "/runs/run-01" },
        { id: "future-query", label: "Future Query", url: "/query" },
      ],
    }));
  }, { key: storageKey });
  await page.goto("/skyline/runs");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const label of ["Jobs", "Runs", "Logs", "Errors", "Queues", "Pinned Run"]) {
    await expect(page.getByRole("link", { name: label, exact: true }).first()).toBeVisible();
  }
  for (const label of ["Query", "Dashboards", "Future Query", "Account", "Notifications"]) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }

  await page.getByRole("button", { name: "Help & Feedback" }).click();
  await expect(page.getByText("Shortcuts", { exact: true })).toBeVisible();
  for (const label of ["Ask AI", "Documentation", "Status", "Suggest a feature", "Contact"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
  }
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Appearance" }).click();
  await expect(page.getByText("Contrast", { exact: true })).toBeVisible();
  await page.getByLabel("Interface theme").click();
  await page.getByRole("option", { name: "Classic" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
  await expect(page.getByText("Contrast", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").theme, storageKey)).toBe("classic");
  await page.keyboard.press("Escape");

  await page.getByText("Observability", { exact: true }).hover();
  await page.getByRole("button", { name: "Customize sidebar" }).click();
  await expect(page.getByRole("dialog")).toContainText("Logs");
  await expect(page.getByRole("dialog")).toContainText("Errors");
  await expect(page.getByRole("dialog")).toContainText("Queues");
  await expect(page.getByRole("dialog")).not.toContainText("Query");
  await expect(page.getByRole("dialog")).not.toContainText("Dashboards");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Collapse side menu" }).click();
  await expect.poll(async () => (await page.getByTestId("side-menu").boundingBox())?.width).toBe(44);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").sidebar?.isCollapsed, storageKey)).toBe(true);
  await page.reload();
  await expect.poll(async () => (await page.getByTestId("side-menu").boundingBox())?.width).toBe(44);
});

test("preferences synchronize across tabs and restore root-only URL state", async ({ page, context }) => {
  const second = await context.newPage();
  await second.route("**/skyline/api/runs**", (route) => route.fulfill({ json: structuredClone(fixture.apiResponse) as RunsPageDto }));
  await page.goto("/skyline/runs");
  await second.goto("/skyline/runs");

  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByLabel("Interface theme").click();
  await page.getByRole("option", { name: "Light" }).click();
  await expect(second.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByLabel("Root Runs only").click();
  await expect(page).toHaveURL(/rootOnly=true/);
  await page.goto("/skyline/runs");
  await expect(page).toHaveURL(/rootOnly=true/);
  await expect(page.getByLabel("Root Runs only")).toBeChecked();

  await page.getByLabel("Root Runs only").click();
  await expect(page).toHaveURL(/rootOnly=false/);
  await page.goto("/skyline/runs");
  await expect(page).not.toHaveURL(/rootOnly=/);
  await expect(page.getByLabel("Root Runs only")).not.toBeChecked();

  await page.getByLabel("Root Runs only").click();
  await page.getByLabel("Job type").selectOption("App\\Jobs\\GenerateMonthlyInvoices");
  await expect(page).not.toHaveURL(/rootOnly=/);
  await expect(page.getByLabel("Root Runs only")).toHaveCount(0);
  await second.close();
});

test("storage failure keeps the shell usable and warns once", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("blocked", "SecurityError"); };
  });
  await page.goto("/skyline/runs");
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByLabel("Interface theme").click();
  await page.getByRole("option", { name: "Light" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("status")).toHaveText("Browser storage is unavailable. Preference changes will last for this tab only.");
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
});
