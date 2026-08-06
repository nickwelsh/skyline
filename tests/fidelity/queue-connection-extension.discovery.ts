import { expect, test } from "@playwright/test";
import type { FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { createDiscoveryStep } from "./support/discovery";
import { discoverFrameworkExtensionObservation } from "./support/difference-regions";
import { queueConnectionExtensionDefinition } from "./support/queue-connection-extension";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const definition = queueConnectionExtensionDefinition(matrix as unknown as FidelityMatrix);
const referenceFixture = createReferenceFixture();

expect(definition.captures).toHaveLength(19);
for (const capture of definition.captures) {
  test(`discover exact NW-221 Connection ${capture}`, async ({ browser }) => {
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
      const connection = skyline.getByLabel("Connection", { exact: true });
      expect(await step("connection:count", () => connection.count())).toBe(1);
      expect(await step("connection:options", () => connection.locator("option").evaluateAll((options) => options.map((option) => ({ value: (option as HTMLOptionElement).value, text: option.textContent })))))
        .toEqual([{ value: "", text: "All" }, { value: "database", text: "database" }, { value: "redis", text: "redis" }, { value: "sqs", text: "sqs" }]);
      if (scenario.id === "queues-filtering") {
        await step("connection:select", () => connection.selectOption("database"));
        await step("connection:navigation", () => skyline.waitForURL((url) => url.searchParams.get("connection") === "database"));
        expect(await connection.inputValue()).toBe("database");
      } else {
        expect(await connection.inputValue()).toBe("");
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
