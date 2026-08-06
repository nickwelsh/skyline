import type { Page } from "@playwright/test";
import fixture from "../fixtures.json" with { type: "json" };
import type { FidelityScenario } from "./skyline";

export async function seedOwnedState(page: Page, scenario: FidelityScenario, basePath = "/skyline") {
  const storageKey = `skyline.ui-preferences.v1:${basePath}`;
  await page.addInitScript(({ key, id }) => {
    const current = JSON.parse(localStorage.getItem(key) ?? "{\"version\":1}");
    if (id === "shell-collapsed") current.sidebar = { ...(current.sidebar ?? {}), isCollapsed: true };
    if (id === "shell-custom-width") current.sidebar = { ...(current.sidebar ?? {}), width: 320 };
    if (id === "shell-customized") current.sidebar = { ...(current.sidebar ?? {}), hiddenItems: { logs: true }, sectionItemOrder: { metrics: ["queues", "errors", "logs"] } };
    if (id === "shell-favorites" || id === "jobs-favorite") current.favorites = [{ id: "favorite-run", label: "Pinned Run", url: "/runs/run_01J8R4NQX6K3PV4W0A1H2Z7M9C" }];
    localStorage.setItem(key, JSON.stringify(current));
  }, { key: storageKey, id: scenario.id });

  if (scenario.id === "shell-storage-warning") {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new DOMException("blocked", "SecurityError"); };
    });
  }
}

export async function exposeOwnedState(page: Page, scenario: FidelityScenario) {
  if (scenario.id === "shell-appearance") await page.getByRole("button", { name: "Appearance" }).click();
  if (scenario.id === "shell-shortcuts-dialog") {
    await page.getByRole("button", { name: "Help & Feedback" }).click();
    await page.getByRole("button", { name: "Shortcuts" }).click();
  }
  if (scenario.id === "shell-customization-dialog") {
    await page.getByText("Observability", { exact: true }).hover();
    await page.getByRole("button", { name: /^(Sidebar options|Customize sidebar)$/ }).click();
    await page.getByText("Customize sidebar", { exact: true }).click();
  }
  if (scenario.id === "shell-storage-warning") await page.getByRole("button", { name: "Collapse side menu" }).click();
  if (scenario.id === "errors-stack-expansion") await page.getByRole("button", { name: /vendor frame/i }).first().click();
  if (scenario.id === "runs-inspectors" || scenario.id.startsWith("runs-exception")) {
    const attempt = scenario.id === "runs-exception-retry" ? 2 : 1;
    await page.getByRole("treeitem", { name: new RegExp(`Attempt ${attempt}`) }).first().click();
  }
  if (scenario.id === "runs-timeline-extremes") await page.getByRole("switch", { name: "Queue time" }).click();
  if (scenario.id === "jobs-filtering") await page.getByPlaceholder(/Search (?:Jobs|tasks)/i).fill("invoice");
  if (scenario.id === "errors-filters") await page.getByLabel("Job type").selectOption({ index: 1 });
  if (scenario.id === "logs-job-run-filters") {
    await page.getByRole("button", { name: /^Tasks$/ }).click();
    await page.getByRole("menuitemcheckbox", { name: fixture.values.jobType }).click();
    await page.getByRole("button", { name: /^Run ID$/ }).click();
    await page.getByLabel("Run ID value").fill(fixture.ids.run);
    await page.getByRole("button", { name: "Apply" }).click();
  }
  if (scenario.id === "queues-filtering") await page.getByLabel("Connection").selectOption({ index: 1 });
  if (scenario.id === "queues-paginated-runs" && new URL(page.url()).pathname.startsWith("/skyline/")) {
    const recordedRuns = page.locator("[data-skyline-extension='queue-recorded-runs']");
    await recordedRuns.waitFor();
    const table = recordedRuns.getByRole("table");
    if (!await table.isVisible()) await recordedRuns.getByRole("button", { name: "Recorded runs" }).click();
  }
}
