import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { RunsPageDto } from "../../resources/js/skyline/dto";
import { fixtureCapabilities } from "../../resources/js/skyline/FixtureAdapter";
import fixture from "./fixtures/nw-217-runs.json" with { type: "json" };
import baseline from "./fixtures/nw-226-trigger-shell-baseline.json" with { type: "json" };
import { pinnedTriggerCommit, readPinnedTriggerSource } from "./support/pinned-trigger-source";

const storageKey = "skyline.ui-preferences.v1:/skyline";
test.beforeEach(async ({ page }) => {
  await page.route("**/skyline/api/runs**", (route) => route.fulfill({ json: runsResponse() }));
});

test("source shell exposes only supported surfaces and persists customization", async ({ page }) => {
  expect(pinnedTriggerCommit()).toBe(baseline.sourceCommit);
  for (const source of Object.values(baseline.sourceFiles)) {
    const contents = readPinnedTriggerSource(source.path);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(source.sha256);
  }
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
  for (const label of [...baseline.contract.navigation, "Pinned Run"]) {
    await expect(page.getByRole("link", { name: label, exact: true }).first()).toBeVisible();
  }
  for (const label of ["Query", "Dashboards", "Future Query", "Account", "Notifications"]) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }

  await page.getByRole("button", { name: "Help & Feedback" }).click();
  for (const label of baseline.contract.help) await expect(page.getByText(label, { exact: true })).toBeVisible();
  for (const label of ["Ask AI", "Documentation", "Status", "Suggest a feature", "Contact"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
  }
  await page.getByText("Shortcuts", { exact: true }).click();
  const shortcutsDialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(shortcutsDialog).toBeVisible();
  for (const label of baseline.contract.shortcuts) await expect(shortcutsDialog.getByText(label, { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Appearance" }).click();
  await expect(page.getByText("Contrast", { exact: true })).toBeVisible();
  await page.getByLabel("Interface theme").click();
  for (const label of baseline.contract.themes) await expect(page.getByRole("option", { name: label })).toBeVisible();
  await page.getByRole("option", { name: "Classic" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
  await expect(page.getByText("Contrast", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").theme, storageKey)).toBe("classic");
  await page.keyboard.press("Escape");

  await page.getByText("Observability", { exact: true }).hover();
  await page.getByRole("button", { name: "Sidebar options" }).click();
  await page.getByText("Customize sidebar", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Logs");
  await expect(page.getByRole("dialog")).toContainText("Errors");
  await expect(page.getByRole("dialog")).toContainText("Queues");
  await expect(page.getByRole("dialog")).not.toContainText("Query");
  await expect(page.getByRole("dialog")).not.toContainText("Dashboards");
  for (const label of baseline.contract.customization) await expect(page.getByRole("dialog")).toContainText(label);
  await page.getByRole("button", { name: "Hide Logs" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").sidebar?.hiddenItems?.logs, storageKey)).toBe(true);
  await expect(page.getByRole("link", { name: "Logs", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Collapse side menu" }).click();
  await expect.poll(async () => (await page.getByTestId("side-menu").boundingBox())?.width).toBe(44);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").sidebar?.isCollapsed, storageKey)).toBe(true);
  await page.reload();
  await expect.poll(async () => (await page.getByTestId("side-menu").boundingBox())?.width).toBe(44);
  await expect(page.getByRole("link", { name: "Logs", exact: true })).toHaveCount(0);
});

test("paired pinned Trigger and Skyline shells preserve reached behavior", async ({ page, context }) => {
  test.setTimeout(60_000);
  const reference = await context.newPage();
  await reference.goto("http://127.0.0.1:4175/shell");
  await reference.evaluate(() => document.fonts.ready);
  await expect(reference).toHaveScreenshot("nw-226/trigger-shell.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  const triggerContract = await exerciseShell(reference);

  await page.goto("/skyline/runs");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("nw-226/skyline-shell.png", { animations: "disabled", caret: "hide", maxDiffPixels: 0 });
  const skylineContract = await exerciseShell(page);

  expect(skylineContract).toEqual(triggerContract);
  await reference.close();
});

test("preferences synchronize across tabs and restore root-only URL state", async ({ page, context }) => {
  const second = await context.newPage();
  await second.route("**/skyline/api/runs**", (route) => route.fulfill({ json: runsResponse() }));
  await page.goto("/skyline/runs");
  await second.goto("/skyline/runs");

  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByLabel("Interface theme").click();
  await page.getByRole("option", { name: "Light" }).click();
  await expect(second.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Observability" }).click();
  await expect(page.getByRole("button", { name: "Observability" })).toHaveAttribute("aria-expanded", "false");
  await expect(second.getByRole("button", { name: "Observability" })).toHaveAttribute("aria-expanded", "false");

  await page.getByLabel("Root Runs only").click();
  await expect(page).toHaveURL(/rootOnly=true/);
  await page.goto("/skyline/runs");
  await expect(page).toHaveURL(/rootOnly=true/);
  await expect(page.getByLabel("Root Runs only")).toBeChecked();

  await page.getByLabel("Root Runs only").click();
  await expect(page).toHaveURL(/rootOnly=false/);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").runs?.rootOnly, storageKey)).toBe(false);
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

function runsResponse(): RunsPageDto {
  const response = structuredClone(fixture.apiResponse) as unknown as RunsPageDto;
  response.capabilities = fixtureCapabilities;
  return response;
}

async function exerciseShell(page: Page) {
  const navigation = ["tasks", "runs", "logs", "errors", "queues"];
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: storageKey,
    value: {
      version: 1,
      theme: "system",
      contrast: 70,
      sidebar: {
        isCollapsed: false,
        width: 224,
        sectionOrder: ["favorites", "metrics"],
        collapsedSections: {},
        hiddenItems: { prompts: true, models: true, query: true, dashboards: true, deployments: true, "environment-variables": true, "preview-branches": true, regions: true, "waitpoint-tokens": true, batches: true, "bulk-actions": true, "api-keys": true, alerts: true, limits: true, integrations: true },
        sectionItemOrder: { metrics: ["logs", "errors", "queues"] },
      },
      favorites: [
        { id: "favorite-run", label: "Pinned Run", url: "/runs/run-01" },
        { id: "future-query", label: "Future Query", url: "/query" },
      ],
    },
  });
  await page.reload();

  for (const action of navigation) await expect(page.locator(`[data-action="${action}"]`).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Pinned Run", exact: true })).toBeVisible();
  const unsupported = ["Sessions", "Prompts", "Models", "Query", "Dashboards", "Deployments", "Deploys", "Environment variables", "Preview branches", "Regions", "Manage", "Waitpoint tokens", "Batches", "Bulk actions", "API keys", "Alerts", "Concurrency", "Limits", "Integrations", "Future Query", "Account", "Notifications", "Job guidance", "Switch organization", "Switch project", "Switch environment", "Ask AI", "Documentation", "Status", "Suggest a feature", "Contact us…", "Full changelog"];
  for (const label of unsupported) {
    await expect(shellMenu(page).getByText(label, { exact: true })).toHaveCount(0);
  }

  await page.keyboard.press("Control+b");
  await expect.poll(async () => (await shellMenu(page).boundingBox())?.width).toBe(44);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").sidebar?.isCollapsed, storageKey)).toBe(true);
  await page.reload();
  await expect.poll(async () => (await shellMenu(page).boundingBox())?.width).toBe(44);
  await page.keyboard.press("Control+b");
  await expect.poll(async () => (await shellMenu(page).boundingBox())?.width).toBe(224);

  const helpButton = page.getByRole("button", { name: "Help & Feedback" });
  await helpButton.focus();
  await page.keyboard.down("Shift");
  await page.keyboard.press("Slash");
  await page.keyboard.up("Shift");
  await expect(page.getByText("Keyboard shortcuts", { exact: true })).toBeVisible();
  for (const label of baseline.contract.shortcuts) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Keyboard shortcuts", { exact: true })).not.toBeVisible();

  await helpButton.click();
  for (const label of ["Ask AI", "Documentation", "Status", "Suggest a feature", "Contact us…", "Full changelog"]) await expect(page.getByRole("dialog").getByText(label, { exact: true })).toHaveCount(0);
  const shortcutsButton = page.getByRole("button", { name: "Shortcuts" });
  await shortcutsButton.click();
  await expect(page.getByText("Keyboard shortcuts", { exact: true })).toBeVisible();
  for (const label of baseline.contract.shortcuts) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Keyboard shortcuts", { exact: true })).not.toBeVisible();
  const focusedButton = page.locator("button:focus");
  await expect(focusedButton).toHaveCount(1);
  await expect(focusedButton).toHaveAccessibleName("Shortcuts ⇧ ?");

  const observability = page.getByRole("button", { name: "Observability", exact: true });
  await observability.hover();
  await observability.locator("..").getByRole("button", { name: /^(Sidebar options|Customize sidebar)$/ }).click();
  await page.getByText("Customize sidebar", { exact: true }).click();
  for (const label of unsupported) await expect(page.getByRole("dialog").getByText(label, { exact: true })).toHaveCount(0);
  await page.getByLabel("Rename Pinned Run").fill("Important Run");
  await page.getByRole("button", { name: "Hide Logs" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("link", { name: "Important Run", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Logs", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "Logs", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Important Run", exact: true })).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("blocked", "SecurityError"); }; });
  await page.getByRole("button", { name: "Collapse side menu" }).click();
  await expect.poll(async () => (await shellMenu(page).boundingBox())?.width).toBe(44);
  await expect(page.getByRole("status")).toHaveText("Browser storage is unavailable. Preference changes will last for this tab only.");
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();

  return { navigation, favorite: "Important Run", shortcuts: baseline.contract.shortcuts, focusReturned: true, persistence: true, storageFallback: true, unsupportedHidden: true, logsVisibleAfterCustomization: false };
}

function shellMenu(page: Page) {
  return page.locator('[data-testid="side-menu"], div.relative.h-full.border-r.bg-background-bright').first();
}
