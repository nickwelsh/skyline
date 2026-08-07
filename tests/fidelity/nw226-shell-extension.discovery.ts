import { expect, test, type Page } from "@playwright/test";
import type { FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { createDiscoveryStep, type DiscoveryStep } from "./support/discovery";
import { discoverFrameworkExtensionObservation } from "./support/difference-regions";
import { nw226ShellExtensionDefinitions } from "./support/nw226-shell-extensions";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const definitions = nw226ShellExtensionDefinitions(matrix as unknown as FidelityMatrix);
const captures = [...new Set(definitions.flatMap(({ captures }) => captures))].sort();
const referenceFixture = createReferenceFixture();

expect(definitions).toHaveLength(5);
expect(captures).toHaveLength(38);

for (const capture of captures) {
  test(`discover exact NW-226 shell ${capture}`, async ({ browser }) => {
    test.setTimeout(30_000);
    const context = await browser.newContext({ locale: "en-US", timezoneId: "UTC", deviceScaleFactor: 1 });
    const skyline = await context.newPage();
    const trigger = await context.newPage();
    try {
      const scenario = parseScenario(capture);
      const step = createDiscoveryStep(capture);
      await Promise.all([prepareCapture(skyline, capture, "/skyline"), prepareCapture(trigger, capture, "/reference")]);
      await Promise.all([seedOwnedState(skyline, scenario), seedOwnedState(trigger, scenario, "/reference")]);
      await installReferenceFixture(trigger, await referenceFixture);
      const fixture = await installSkylineFixture(skyline, scenario);
      await Promise.all([
        step("goto:skyline", () => skyline.goto(scenarioPath(scenario, fixture.catalog))),
        step("goto:trigger", () => trigger.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`)),
      ]);
      await step("ready:trigger", () => trigger.locator("html[data-oracle-ready='true']").waitFor());
      if (scenario.id === "queues-filtering") {
        await Promise.all([
          exposeQueueFilteringState(skyline, "skyline", step),
          exposeQueueFilteringState(trigger, "trigger", step),
        ]);
      } else {
        await Promise.all([
          step(`state:skyline-${scenario.state}`, () => exposeOwnedState(skyline, scenario, "skyline")),
          step(`state:trigger-${scenario.state}`, () => exposeOwnedState(trigger, scenario, "trigger")),
        ]);
      }
      await Promise.all([applyLiveSystemChange(skyline, capture), applyLiveSystemChange(trigger, capture)]);
      await Promise.all([step("settle:skyline", () => settleCapture(skyline)), step("settle:trigger", () => settleCapture(trigger))]);
      await Promise.all([step("canvas:skyline", () => assertFixedCanvas(skyline, capture)), step("canvas:trigger", () => assertFixedCanvas(trigger, capture))]);

      for (const definition of definitions) {
        const observation = await discoverFrameworkExtensionObservation(trigger, skyline, definition, step);
        const measurement = {
          relativeRect: observation.relativeRect,
          computedStyleSha256: observation.computedStyleSha256,
          accessibilitySha256: observation.accessibilitySha256,
          anchorRect: observation.anchorRect,
          anchorComputedStyleSha256: observation.anchorComputedStyleSha256,
        };
        process.stdout.write(`\nFRAMEWORK_EXTENSION_MEASUREMENT=${JSON.stringify({ definition: definition.id, capture, measurement })}\n`);
      }
    } finally {
      await context.close();
    }
  });
}

async function exposeQueueFilteringState(page: Page, application: "skyline" | "trigger", step: DiscoveryStep) {
  if (application === "skyline") {
    const connection = page.getByLabel("Connection", { exact: true });
    await step("filter:skyline:connection-select", () => connection.selectOption("database"));
    await step("filter:skyline:connection-navigation", () => page.waitForURL((url) => url.searchParams.get("connection") === "database", { timeout: 1_500 }));
  }
  const search = page.getByPlaceholder("Search queues…");
  await step(`filter:${application}:fill`, () => search.fill("reports", { timeout: 1_500 }));
  await step(`filter:${application}:submit`, () => search.press("Enter", { timeout: 1_500 }));
  const parameter = application === "trigger" ? "query" : "search";
  await step(`filter:${application}:navigation`, () => page.waitForURL((url) => url.searchParams.get(parameter) === "reports", { timeout: 1_500 }));
  const anchor = page.locator(`[data-${application === "trigger" ? "trigger" : "skyline"}-anchor="queue-filter-controls"]`);
  await step(`filter:${application}:expanded`, () => expect(anchor).toHaveCSS("width", "384px", { timeout: 1_500 }));
}
