import { expect, test } from "@playwright/test";
import { expectedCaptureIds, type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, prepareCapture, settleCapture } from "./support/capture";
import { discoverPresenterExtensionObservation, type PresenterExtensionDefinition } from "./support/difference-regions";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const states = ["exception", "exception-expanded", "exception-long", "exception-retry"];
const captures = expectedCaptureIds(matrix as unknown as FidelityMatrix).filter((capture) => states.some((state) => capture.startsWith(`runs-${state}@1440x960-`)));
const failedPanelSelector = ".flex.flex-col.gap-2.rounded-sm.border.border-rose-500\\/50";
const definition: PresenterExtensionDefinition = {
  id: "attempt-exception-evidence",
  category: "presenter-extension",
  decision: "NW-222",
  acceptance: [
    "Failed-Attempt detail exposes exception class, original message, application/vendor frames, source location where captured, causal Run/Attempt context.",
    "Absolute Application roots and uncaptured metadata not invented/exposed.",
    "preserved upstream exception presenter supports collapsed/expanded frames, vendor toggle, long-stack scrolling, valid source links.",
    "Copy-as-Markdown behavior/content/feedback/dialogs/wrapping/Escape/focus match pinned source.",
    "distinct evidence per failed Attempt.",
    "selection URL-stable + keyboard navigable.",
    "collapsed/expanded/long/app+vendor/retry/loading/error/unavailable fixtures.",
    "paired tests compare visible/focus/AX/interactions.",
  ],
  citations: [
    "https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L1446-L1513",
    "https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/code/CodeBlock.tsx#L197-L330",
  ],
  captures,
  triggerSelector: `${failedPanelSelector} > [translate='no']`,
  skylineSelector: "[data-skyline-extension='attempt-exception-evidence']",
  triggerAnchorSelector: `${failedPanelSelector} > h3`,
  skylineAnchorSelector: `${failedPanelSelector} > h3`,
  skylineAccessibleRole: "region",
  skylineAccessibleName: "Exception",
  anchorAccessibleRole: "heading",
  anchorAccessibleName: "Illuminate\\Database\\DeadlockException",
  measurements: {},
};

expect(captures).toHaveLength(12);
const referenceFixture = createReferenceFixture();

for (const capture of captures) {
  test(`discover exact NW-222 ${capture}`, async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US", timezoneId: "UTC", deviceScaleFactor: 1 });
    const skyline = await context.newPage();
    const trigger = await context.newPage();
    try {
      const scenario = parseScenario(capture);
      await Promise.all([prepareCapture(skyline, capture, "/skyline"), prepareCapture(trigger, capture, "/reference")]);
      await Promise.all([seedOwnedState(skyline, scenario), seedOwnedState(trigger, scenario, "/reference")]);
      await installReferenceFixture(trigger, await referenceFixture);
      const fixture = await installSkylineFixture(skyline, scenario);
      await Promise.all([skyline.goto(scenarioPath(scenario, fixture.catalog)), trigger.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`)]);
      await trigger.locator("html[data-oracle-ready='true']").waitFor();
      await Promise.all([exposeOwnedState(skyline, scenario), exposeOwnedState(trigger, scenario)]);
      await Promise.all([trigger.locator(definition.triggerSelector).waitFor(), skyline.locator(definition.skylineSelector).waitFor()]);
      await Promise.all([applyLiveSystemChange(skyline, capture), applyLiveSystemChange(trigger, capture)]);
      await Promise.all([settleCapture(skyline), settleCapture(trigger)]);
      const observation = await discoverPresenterExtensionObservation(trigger, skyline, definition);
      const measurement = {
        triggerRelativeRect: observation.triggerRelativeRect,
        skylineRelativeRect: observation.skylineRelativeRect,
        triggerComputedStyleSha256: observation.triggerComputedStyleSha256,
        skylineComputedStyleSha256: observation.skylineComputedStyleSha256,
        triggerAccessibilitySha256: observation.triggerAccessibilitySha256,
        skylineAccessibilitySha256: observation.skylineAccessibilitySha256,
        anchorRect: observation.anchorRect,
        anchorComputedStyleSha256: observation.anchorComputedStyleSha256,
        anchorAccessibilitySha256: observation.anchorAccessibilitySha256,
      };
      process.stdout.write(`\nPRESENTER_EXTENSION_MEASUREMENT=${JSON.stringify({ [capture]: measurement })}\n`);
    } finally {
      await context.close();
    }
  });
}
