import { expect, test } from "@playwright/test";
import { expectedCaptureIds, type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { discoverFrameworkExtensionObservation, type FrameworkExtensionDefinition } from "./support/difference-regions";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const detailStates = ["single-occurrence", "many-occurrences", "affected-job-types", "application-vendor-frames", "stack-expansion", "linked-runs", "long-exception"];
const captures = expectedCaptureIds(matrix as unknown as FidelityMatrix).filter((capture) => capture.startsWith("error-found@") || detailStates.some((state) => capture.startsWith(`errors-${state}@`)));
const definition: FrameworkExtensionDefinition = {
  id: "php-exception-evidence",
  category: "framework-extension",
  decision: "NW-224",
  acceptance: "Detail adds representative application/vendor frames, occurrence activity, and cursor-paginated failed Attempts.",
  captures,
  skylineSelector: "[data-skyline-extension='error-exception-evidence']",
  triggerAnchorSelector: ".border-b.border-grid-dimmed.px-3.py-2 > h2",
  skylineAnchorSelector: ".border-b.border-grid-dimmed.px-3.py-2 > h2",
  accessibleRole: "region",
  accessibleName: "Exception",
  anchorAccessibleRole: "heading",
  anchorAccessibleName: "Details",
  measurements: {},
};

expect(captures).toHaveLength(28);
const referenceFixture = createReferenceFixture();

for (const capture of captures) {
  test(`discover exact NW-224 ${capture}`, async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US", timezoneId: "UTC", deviceScaleFactor: 1 });
    const skyline = await context.newPage();
    const trigger = await context.newPage();
    try {
      const scenario = parseScenario(capture);
      await Promise.all([prepareCapture(skyline, capture, "/skyline"), prepareCapture(trigger, capture, "/reference")]);
      await Promise.all([seedOwnedState(skyline, scenario), seedOwnedState(trigger, scenario, "/reference")]);
      await installReferenceFixture(trigger, await referenceFixture);
      const fixture = await installSkylineFixture(skyline, scenario);
      await Promise.all([
        skyline.goto(scenarioPath(scenario, fixture.catalog)),
        trigger.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`),
      ]);
      await trigger.locator("html[data-oracle-ready='true']").waitFor();
      await Promise.all([exposeOwnedState(skyline, scenario), exposeOwnedState(trigger, scenario)]);
      await Promise.all([applyLiveSystemChange(skyline, capture), applyLiveSystemChange(trigger, capture)]);
      await Promise.all([settleCapture(skyline), settleCapture(trigger)]);
      await Promise.all([assertFixedCanvas(skyline, capture), assertFixedCanvas(trigger, capture)]);
      const observation = await discoverFrameworkExtensionObservation(trigger, skyline, definition);
      const measurement = {
        relativeRect: observation.relativeRect,
        computedStyleSha256: observation.computedStyleSha256,
        anchorRect: observation.anchorRect,
        anchorComputedStyleSha256: observation.anchorComputedStyleSha256,
      };
      process.stdout.write(`\nFRAMEWORK_EXTENSION_MEASUREMENT=${JSON.stringify({ [capture]: measurement })}\n`);
    } finally {
      await context.close();
    }
  });
}
