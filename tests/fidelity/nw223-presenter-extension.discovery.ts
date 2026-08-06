import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { expectedCaptureIds, type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { applyLiveSystemChange, prepareCapture, settleCapture } from "./support/capture";
import { discoverPresenterExtensionObservation, type PresenterExtensionDefinition } from "./support/difference-regions";
import { nw223States } from "./support/nw223";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath, type FidelityScenario } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";

const captures = expectedCaptureIds(matrix as unknown as FidelityMatrix)
  .filter((capture) => nw223States.some((state) => capture.startsWith(`runs-${state}@1440x960-`)));
const definition: PresenterExtensionDefinition = {
  id: "database-state-operation-inspector",
  category: "presenter-extension",
  decision: "NW-223",
  acceptance: [
    "Operation projections expose discriminated SQL, transaction, cache, and Redis variants using recorded evidence only.",
    "SQL preserves parameterized and binding-applied views, bindings, result preview, source, copy, wrap, expand, tree, and text treatments where captured.",
    "Transactions preserve supported nesting, status, timing, and causal relationships.",
    "Cache and Redis preserve recorded commands, keys, outcomes, timings, attributes, and failures.",
    "Versioned API privacy sanitization and capture limits remain enforced.",
    "Missing bindings, unavailable results, long values, failures, and capture limits stay truthful.",
    "Tabs, keyboard, focus, dialogs, copy feedback, and accessible names preserve source behavior.",
    "Paired fixtures cover every variant and meaningful unavailable, failure, long, and limited state.",
    "Projection, API, adapter, browser, typecheck, and build gates pass.",
  ],
  citations: [
    "https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L1533-L1591",
    "https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/code/CodeBlock.tsx#L197-L360",
    "https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/primitives/PropertyTable.tsx#L1-L31",
  ],
  captures,
  triggerSelector: "div[translate='no']",
  skylineSelector: "[data-skyline-extension='database-state-operation-inspector']",
  triggerAnchorSelector: "[role='tree'][aria-label='Run trace']",
  skylineAnchorSelector: "[role='tree'][aria-label='Run trace']",
  skylineAccessibleRole: "region",
  skylineAccessibleName: "Database and state operation inspector",
  anchorAccessibleRole: "tree",
  anchorAccessibleName: "Run trace",
  measurements: {},
};

expect(captures).toHaveLength(nw223States.length * 3);
const referenceFixture = createReferenceFixture();

for (const capture of captures) {
  test(`discover exact NW-223 ${capture}`, async ({ browser }) => {
    test.setTimeout(30_000);
    const scenario = parseScenario(capture);
    if (interactionStates.has(scenario.state)) await proveCaptureInteraction(browser, capture, scenario);
    const context = await browser.newContext({ locale: "en-US", timezoneId: "UTC", deviceScaleFactor: 1 });
    const skyline = await context.newPage();
    const trigger = await context.newPage();
    try {
      await preparePair(skyline, trigger, capture, scenario);
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
        anchorAccessibleName: observation.anchorAccessibleName,
      };
      process.stdout.write(`\nNW223_PRESENTER_MEASUREMENT=${JSON.stringify({ [capture]: measurement })}\n`);
    } finally {
      await context.close();
    }
  });
}

const interactionStates = new Set([
  "inspectors-sql-applied", "inspectors-sql-result", "inspectors-sql-long",
  "inspectors-cache-long", "inspectors-redis-long",
]);

async function preparePair(skyline: Page, trigger: Page, capture: string, scenario: FidelityScenario) {
  await Promise.all([prepareCapture(skyline, capture, "/skyline"), prepareCapture(trigger, capture, "/reference")]);
  await Promise.all([seedOwnedState(skyline, scenario), seedOwnedState(trigger, scenario, "/reference")]);
  await installReferenceFixture(trigger, await referenceFixture);
  const fixture = await installSkylineFixture(skyline, scenario);
  await Promise.all([skyline.goto(scenarioPath(scenario, fixture.catalog)), trigger.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`)]);
  await trigger.locator("html[data-oracle-ready='true']").waitFor();
  await Promise.all([exposeOwnedState(skyline, scenario), exposeOwnedState(trigger, scenario)]);
  await Promise.all([applyLiveSystemChange(skyline, capture), applyLiveSystemChange(trigger, capture)]);
  await Promise.all([settleCapture(skyline), settleCapture(trigger)]);
  await trigger.locator(definition.triggerSelector).waitFor();
  await skyline.locator(definition.skylineSelector).waitFor();
}

async function proveCaptureInteraction(browser: Browser, capture: string, scenario: FidelityScenario) {
  const context = await browser.newContext({ locale: "en-US", timezoneId: "UTC", deviceScaleFactor: 1, permissions: ["clipboard-read", "clipboard-write"] });
  const skyline = await context.newPage();
  const trigger = await context.newPage();
  try {
    await preparePair(skyline, trigger, capture, scenario);
    await exerciseCapture(trigger, trigger.locator(definition.triggerSelector), false);
    await exerciseCapture(skyline, skyline.locator(definition.skylineSelector), true);
  } finally {
    await context.close();
  }
}

async function exerciseCapture(page: Page, region: Locator, named: boolean) {
  const buttons = region.locator("button");
  const wrap = named ? region.getByRole("button", { name: /^Wrap / }).first() : buttons.nth(0);
  const copy = named ? region.getByRole("button", { name: /^Copy / }).first() : buttons.nth(1);
  const expand = named ? region.getByRole("button", { name: /^Expand / }).first() : buttons.nth(2);
  await wrap.click();
  await copy.click();
  expect((await page.evaluate(() => navigator.clipboard.readText())).length).toBeGreaterThan(0);
  await expand.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
