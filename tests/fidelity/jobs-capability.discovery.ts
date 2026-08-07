import { test } from "@playwright/test";
import { type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { createDiscoveryStep } from "./support/discovery";
import { discoverCapabilityOmissionObservation } from "./support/difference-regions";
import { jobsCapabilityDefinitions } from "./support/jobs-capabilities";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const definitions = jobsCapabilityDefinitions(matrix as unknown as FidelityMatrix);
const captures = [...new Set(definitions.flatMap(({ captures }) => captures))].sort();
const referenceFixture = createReferenceFixture();

for (const capture of captures) {
  test(`discover exact NW-219 ${capture}`, async ({ browser }) => {
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
      await Promise.all([
        step(`state:skyline-${scenario.state}`, () => exposeOwnedState(skyline, scenario, "skyline")),
        step(`state:trigger-${scenario.state}`, () => exposeOwnedState(trigger, scenario, "trigger")),
      ]);
      await Promise.all([applyLiveSystemChange(skyline, capture), applyLiveSystemChange(trigger, capture)]);
      await Promise.all([step("settle:skyline", () => settleCapture(skyline)), step("settle:trigger", () => settleCapture(trigger))]);
      await Promise.all([step("canvas:skyline", () => assertFixedCanvas(skyline, capture)), step("canvas:trigger", () => assertFixedCanvas(trigger, capture))]);

      for (const definition of definitions.filter(({ captures }) => captures.includes(capture))) {
        const observation = await discoverCapabilityOmissionObservation(trigger, skyline, definition, capture);
        const measurement = Object.fromEntries(observation.selectorPairs.map(({ id, triggerRect, skylineRect, triggerComputedStyleSha256, skylineComputedStyleSha256, triggerAccessibilitySha256, skylineAccessibilitySha256 }) => [id, {
          triggerRect,
          skylineRect,
          triggerComputedStyleSha256,
          skylineComputedStyleSha256,
          triggerAccessibilitySha256,
          skylineAccessibilitySha256,
        }]));
        const protectedMeasurement = Object.fromEntries((observation.protectedSelectors ?? []).map(({ id, rect, computedStyleSha256, accessibilitySha256, crop }) => [id, {
          rect,
          computedStyleSha256,
          accessibilitySha256,
          crop,
        }]));
        process.stdout.write(`\nCAPABILITY_OMISSION_MEASUREMENT=${JSON.stringify({ definition: definition.id, capture, measurement, protectedMeasurement })}\n`);
      }
    } finally {
      await context.close();
    }
  });
}
