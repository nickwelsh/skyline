import { test, type Page } from "@playwright/test";
import { type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { createDiscoveryStep, type DiscoveryStep } from "./support/discovery";
import { discoverCapabilityOmissionObservation } from "./support/difference-regions";
import { queueCapabilityDefinitions } from "./support/queue-capabilities";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const definitions = queueCapabilityDefinitions(matrix as unknown as FidelityMatrix);
const captures = [...new Set(definitions.flatMap(({ captures }) => captures))].sort();
const referenceFixture = createReferenceFixture();

for (const capture of captures) {
  test(`discover exact NW-221 ${capture}`, async ({ browser }) => {
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
      await Promise.all([
        step("settle:skyline", () => settleCapture(skyline)),
        step("settle:trigger", () => settleCapture(trigger)),
      ]);
      await Promise.all([
        step("canvas:skyline", () => assertFixedCanvas(skyline, capture)),
        step("canvas:trigger", () => assertFixedCanvas(trigger, capture)),
      ]);

      for (const definition of definitions.filter(({ captures }) => captures.includes(capture))) {
        const observation = await discoverCapabilityOmissionObservation(trigger, skyline, definition);
        const measurement = Object.fromEntries(observation.selectorPairs.map(({ id, triggerRect, skylineRect, triggerComputedStyleSha256, skylineComputedStyleSha256, triggerAccessibilitySha256, skylineAccessibilitySha256 }) => [id, {
          triggerRect,
          skylineRect,
          triggerComputedStyleSha256,
          skylineComputedStyleSha256,
          triggerAccessibilitySha256,
          skylineAccessibilitySha256,
        }]));
        process.stdout.write(`\nCAPABILITY_OMISSION_MEASUREMENT=${JSON.stringify({ definition: definition.id, capture, measurement })}\n`);
      }
    } finally {
      await context.close();
    }
  });
}

async function exposeQueueFilteringState(page: Page, application: "skyline" | "trigger", step: DiscoveryStep) {
  const filter = application === "trigger" ? page.getByPlaceholder("Search queues…") : page.getByLabel("Connection");
  const count = await step(`filter:${application}:count`, () => filter.count());
  if (count !== 1) throw new Error(`${application} Queue connection filter must match once; observed ${count}.`);
  await step(`filter:${application}:visible`, () => filter.waitFor({ state: "visible" }));
  if (application === "trigger") {
    await step("filter:trigger:fill", () => filter.fill("reports", { timeout: 1_500 }));
    const value = await step("filter:trigger:value", () => filter.inputValue());
    if (value !== "reports") throw new Error("Trigger Queue search filter did not retain its selection.");
    await step("filter:trigger:navigation", () => page.waitForURL((url) => url.searchParams.get("query") === "reports", { timeout: 1_500 }));
    await step("filter:trigger:ready", () => page.locator('[data-trigger-capability="queue-target-queue_3ac9ae5d-limit"]').waitFor());
    return;
  }
  const options = await step(`filter:${application}:options`, () => filter.locator("option").allTextContents());
  if (options.length < 2) throw new Error(`${application} Queue connection filter lacks a selectable connection.`);
  await step(`filter:${application}:select`, () => filter.selectOption({ index: 1 }, { timeout: 1_500 }));
  const value = await step(`filter:${application}:value`, () => filter.inputValue());
  if (!value) throw new Error(`${application} Queue connection filter did not retain its selection.`);
  await step("filter:skyline:navigation", () => page.waitForURL((url) => url.searchParams.get("connection") === value, { timeout: 1_500 }));
  await step("filter:skyline:ready", () => page.locator('[data-skyline-capability="queue-target-queue_3ac9ae5d-limit"]').waitFor());
}
