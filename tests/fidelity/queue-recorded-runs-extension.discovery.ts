import { expect, test } from "@playwright/test";
import type { FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { createDiscoveryStep } from "./support/discovery";
import { discoverFrameworkExtensionObservation } from "./support/difference-regions";
import { queueRecordedRunsExtensionDefinition } from "./support/queue-recorded-runs-extension";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const definition = queueRecordedRunsExtensionDefinition(matrix as unknown as FidelityMatrix);
const referenceFixture = createReferenceFixture();

expect(definition.captures).toHaveLength(19);
for (const capture of definition.captures) {
  test(`discover exact NW-221 Recorded Runs ${capture}`, async ({ browser }) => {
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
      const extension = skyline.getByRole("region", { name: "Recorded runs", exact: true });
      expect(await step("recorded-runs:count", () => extension.count())).toBe(1);
      if (scenario.id === "queues-paginated-runs") {
        await step("recorded-runs:table", () => expect(extension.getByRole("table")).toBeVisible());
        await step("recorded-runs:expanded", () => expect(extension.getByRole("button", { name: "Recorded runs", exact: true })).toHaveAttribute("aria-expanded", "true"));
      } else {
        const control = extension.getByRole("button", { name: "Recorded runs", exact: true });
        await step("recorded-runs:collapsed", () => expect(control).toHaveAttribute("aria-expanded", "false"));
        if (capture === "queue-found@1440x960-classic") {
          await step("recorded-runs:open", () => control.click());
          await step("recorded-runs:open-table", () => expect(extension.getByRole("table")).toBeVisible());
          await step("recorded-runs:escape", () => extension.getByRole("button", { name: "Close recorded runs" }).press("Escape"));
          await step("recorded-runs:focus-restored", () => expect(control).toBeFocused());
        }
      }
      await Promise.all([applyLiveSystemChange(skyline, capture), applyLiveSystemChange(trigger, capture)]);
      await Promise.all([step("settle:skyline", () => settleCapture(skyline)), step("settle:trigger", () => settleCapture(trigger))]);
      await Promise.all([step("canvas:skyline", () => assertFixedCanvas(skyline, capture)), step("canvas:trigger", () => assertFixedCanvas(trigger, capture))]);
      const observation = await discoverFrameworkExtensionObservation(trigger, skyline, definition, step);
      const measurement = {
        relativeRect: observation.relativeRect,
        computedStyleSha256: observation.computedStyleSha256,
        accessibilitySha256: observation.accessibilitySha256,
        anchorRect: observation.anchorRect,
        anchorComputedStyleSha256: observation.anchorComputedStyleSha256,
      };
      process.stdout.write(`\nFRAMEWORK_EXTENSION_MEASUREMENT=${JSON.stringify({ definition: definition.id, capture, measurement })}\n`);
    } finally {
      await context.close();
    }
  });
}
