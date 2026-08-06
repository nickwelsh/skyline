import type { Page } from "@playwright/test";
import fixture from "../fixtures.json" with { type: "json" };
import type { FidelityScenario } from "./skyline";
import { isNw223State } from "./nw223";

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

export async function exposeOwnedState(page: Page, scenario: FidelityScenario, application: "skyline" | "trigger", options: { expandException?: boolean } = {}) {
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
  if (scenario.id === "errors-stack-expansion" && application === "skyline") {
    const disclosure = page.getByRole("button", { name: "Show 2 frames", exact: true });
    const count = await disclosure.count();
    if (count !== 1) throw new Error(`Stack expansion disclosure must match exactly once; observed ${count}.`);
    await disclosure.waitFor({ state: "visible" });
    if (!await disclosure.isEnabled()) throw new Error("Stack expansion disclosure must be enabled.");
    const controlledId = await disclosure.getAttribute("aria-controls");
    if (!controlledId) throw new Error("Stack expansion disclosure must control the trace.");
    await disclosure.click();
    const expandedDisclosure = page.locator(`[aria-controls=${JSON.stringify(controlledId)}]`);
    const expandedCount = await expandedDisclosure.count();
    if (expandedCount !== 1) throw new Error(`Expanded stack disclosure must match exactly once; observed ${expandedCount}.`);
    if (await expandedDisclosure.getAttribute("aria-expanded") !== "true") throw new Error("Stack expansion disclosure must be expanded.");
    await page.locator(`[id=${JSON.stringify(controlledId)}]`).waitFor({ state: "visible" });
  }
  if (scenario.id === "runs-inspectors" || scenario.id.startsWith("runs-exception")) {
    const attempt = scenario.id === "runs-exception-retry" ? 2 : 1;
    await page.getByRole("treeitem", { name: new RegExp(`Attempt ${attempt}`) }).first().click();
  }
  if (scenario.surface === "runs" && isNw223State(scenario.state)) {
    await page.getByRole("treeitem", { name: /(?:SQL query|Database transaction|Cache operation|Redis command)/ }).first().click();
    if (application === "skyline") {
      await page.getByRole("tab", { name: "Detail", exact: true }).click();
      if (scenario.state === "inspectors-sql-applied") await page.getByRole("tab", { name: "With bindings" }).click();
      if (scenario.state === "inspectors-sql-result") await page.getByRole("tab", { name: "Tree" }).click();
    }
  }
  if (scenario.id === "runs-exception-expanded" && options.expandException !== false) {
    if (application === "skyline") {
      await page.getByRole("button", { name: "Expand exception stack trace" }).click();
    } else {
      const code = page.locator(".flex.flex-col.gap-2.rounded-sm.border.border-rose-500\\/50 > [translate='no']");
      await code.getByRole("button").last().click();
    }
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
  if (scenario.id === "queues-paginated-runs" && application === "skyline") {
    const recordedRuns = page.locator("[data-skyline-extension='queue-recorded-runs']");
    await recordedRuns.waitFor();
    const table = recordedRuns.getByRole("table");
    if (!await table.isVisible()) await recordedRuns.getByRole("button", { name: "Recorded runs" }).click();
  }
}
