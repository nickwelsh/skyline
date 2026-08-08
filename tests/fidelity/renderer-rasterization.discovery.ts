import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import allowedDifferences from "./allowed-differences.json" with { type: "json" };
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { discoverRendererRasterizationObservation, rendererRasterizationAlternativesForCapture, type RendererRasterizationDefinition, validateRendererRasterizationObservation } from "./support/difference-regions";
import { measurePixels } from "./support/pixels";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const definitions = allowedDifferences.regions.filter(({ category }) => category === "renderer-rasterization") as unknown as RendererRasterizationDefinition[];
const referenceFixture = createReferenceFixture();

for (const definition of definitions) {
  for (const capture of definition.captures) {
    test(`discover exact NW-216 renderer rasterization evidence ${definition.id} ${capture}`, async ({ browser }) => {
      test.setTimeout(60_000);
      expect(definition.measurements[capture]).toBeDefined();
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
        await Promise.all([exposeOwnedState(skyline, scenario, "skyline"), exposeOwnedState(trigger, scenario, "trigger")]);
        await Promise.all([applyLiveSystemChange(skyline, capture), applyLiveSystemChange(trigger, capture)]);
        await Promise.all([settleCapture(skyline), settleCapture(trigger)]);
        await Promise.all([assertFixedCanvas(skyline, capture), assertFixedCanvas(trigger, capture)]);
        await trigger.screenshot({ animations: "disabled", caret: "hide" });
        await skyline.screenshot({ animations: "disabled", caret: "hide" });
        await Promise.all([settleCapture(trigger), settleCapture(skyline)]);
        const observation = await discoverRendererRasterizationObservation(trigger, skyline, definition, capture);
        const triggerPng = await trigger.screenshot({ animations: "disabled", caret: "hide" });
        const skylinePng = await skyline.screenshot({ animations: "disabled", caret: "hide" });
        const pixels = exactElementDeltas(triggerPng, skylinePng, observation.trigger.rect);
        process.stdout.write(`\nRENDERER_RASTERIZATION_MEASUREMENT=${JSON.stringify({ [capture]: { runtime: observation.runtime, trigger: observation.trigger, skyline: observation.skyline, pixels } })}\n`);
        expect(() => validateRendererRasterizationObservation(definition, observation, capture)).not.toThrow();
        const region = {
          kind: "renderer-rasterization" as const,
          id: definition.id,
          observation,
          expected: { presentation: definition.presentation, ...definition.measurements[capture] },
          pixels: definition.pixels,
          alternatives: rendererRasterizationAlternativesForCapture(definition, capture),
        };
        expect(measurePixels(triggerPng, skylinePng, [region]).maskedPixels).toBe(pixels.length);
      } finally {
        await context.close();
      }
    });
  }
}

function exactElementDeltas(triggerBuffer: Buffer, skylineBuffer: Buffer, rect: { x: number; y: number; width: number; height: number }) {
  const trigger = PNG.sync.read(triggerBuffer);
  const skyline = PNG.sync.read(skylineBuffer);
  expect({ width: trigger.width, height: trigger.height }).toEqual({ width: skyline.width, height: skyline.height });
  const pixels: RendererRasterizationDefinition["pixels"] = [];
  const left = Math.floor(rect.x);
  const top = Math.floor(rect.y);
  for (let y = top; y < Math.ceil(rect.y + rect.height); y += 1) {
    for (let x = left; x < Math.ceil(rect.x + rect.width); x += 1) {
      const offset = (y * trigger.width + x) * 4;
      const triggerPixel = Array.from(trigger.data.subarray(offset, offset + 4)) as [number, number, number, number];
      const skylinePixel = Array.from(skyline.data.subarray(offset, offset + 4)) as [number, number, number, number];
      if (triggerPixel.every((value, index) => value === skylinePixel[index])) continue;
      pixels.push({ x: x - left, y: y - top, trigger: triggerPixel, skyline: skylinePixel });
    }
  }
  return pixels;
}
