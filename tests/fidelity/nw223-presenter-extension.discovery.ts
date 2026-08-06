import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { expectedCaptureIds, type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import matrix from "./matrix.json" with { type: "json" };
import { capturePartitionedAxe, normalizedPartitionLedger, pairedPresenterAxeDifferences } from "./support/axe";
import { applyLiveSystemChange, prepareCapture, settleCapture } from "./support/capture";
import { discoverPresenterExtensionObservation, type PresenterExtensionDefinition, type PresenterObservationStep } from "./support/difference-regions";
import { expandedDialogCounts, expectedExpandedDialogTranscript } from "./support/dialog-lifecycle";
import { isNw223State, nw223InteractionStates, nw223Presentation, nw223States } from "./support/nw223";
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
  triggerAnchorSelector: "#tree [role='treeitem'][data-index='5']:has(p)",
  skylineAnchorSelector: "#tree [role='treeitem'][data-index='5']:has(p)",
  skylineAccessibleRole: "region",
  skylineAccessibleName: "Database and state operation inspector",
  anchorAccessibleRole: "treeitem",
  anchorAccessibleName: "",
  measurements: {},
};

expect(captures).toHaveLength(nw223States.length * 3);
const referenceFixture = createReferenceFixture();

for (const capture of captures) {
  test(`discover exact NW-223 ${capture}`, async ({ browser }) => {
    test.setTimeout(60_000);
    const scenario = parseScenario(capture);
    if (interactionStates.has(scenario.state)) await proveCaptureInteraction(browser, capture, scenario);
    const context = await browser.newContext({ locale: "en-US", timezoneId: "UTC", deviceScaleFactor: 1 });
    const skyline = await context.newPage();
    const trigger = await context.newPage();
    try {
      const step = observationStep(capture);
      await preparePair(skyline, trigger, capture, scenario, step);
      await reportAnchorPreflight(trigger, skyline, capture, step);
      const observation = await discoverPresenterExtensionObservation(trigger, skyline, {
        ...definition,
        anchorAccessibleName: operationState(scenario.state).label,
      }, undefined, step);
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

async function reportAnchorPreflight(trigger: Page, skyline: Page, capture: string, step: PresenterObservationStep) {
  const [triggerAnchor, skylineAnchor, triggerAncestors, skylineAncestors] = await Promise.all([
    step("anchor-preflight:trigger", () => observeAnchorPreflight(trigger)),
    step("anchor-preflight:skyline", () => observeAnchorPreflight(skyline)),
    step("ancestor-preflight:trigger", () => observeAncestorPreflight(trigger)),
    step("ancestor-preflight:skyline", () => observeAncestorPreflight(skyline)),
  ]);
  expect(triggerAnchor.rect.height).toBe(32);
  expect(skylineAnchor.rect.height).toBe(32);
  expect({ x: skylineAnchor.rect.x, y: skylineAnchor.rect.y }).toEqual({ x: triggerAnchor.rect.x, y: triggerAnchor.rect.y });
  const styleDeltaIndex = Array.from({ length: Math.max(triggerAnchor.computedStyle.length, skylineAnchor.computedStyle.length) })
    .findIndex((_, index) => JSON.stringify(triggerAnchor.computedStyle[index]) !== JSON.stringify(skylineAnchor.computedStyle[index]));
  const firstStyleDelta = styleDeltaIndex === -1 ? null : { trigger: triggerAnchor.computedStyle[styleDeltaIndex], skyline: skylineAnchor.computedStyle[styleDeltaIndex] };
  process.stdout.write(`\nNW223_ANCHOR_PREFLIGHT=${JSON.stringify({ capture, triggerRect: triggerAnchor.rect, skylineRect: skylineAnchor.rect, firstStyleDelta, triggerAncestors, skylineAncestors })}\n`);
}

async function observeAnchorPreflight(page: Page) {
  return page.locator(definition.triggerAnchorSelector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const computedStyle = Array.from(style)
      .filter((property) => !property.startsWith("--"))
      .sort()
      .map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)] as const);
    return { rect: { x: box.x, y: box.y, width: box.width, height: box.height }, computedStyle };
  });
}

async function observeAncestorPreflight(page: Page) {
  return page.locator(definition.triggerAnchorSelector).evaluate((anchor) => {
    const tree = anchor.closest("[role='tree']");
    const treePanel = anchor.closest("[data-splitter-type='panel'][data-splitter-id='tree']");
    const treeSplitter = treePanel?.parentElement ?? null;
    const runPanel = treeSplitter?.closest("[data-splitter-type='panel'][data-splitter-id='run']") ?? null;
    const parentSplitter = runPanel?.parentElement ?? null;
    const main = anchor.closest("main");
    const app = anchor.closest(".isolate");
    const entries = { anchor, tree, treePanel, treeSplitter, runPanel, parentSplitter, main, app };
    return Object.fromEntries(Object.entries(entries).map(([name, element]) => {
      if (!(element instanceof HTMLElement)) return [name, null];
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return [name, {
        tagName: element.tagName.toLowerCase(),
        id: element.id,
        className: element.getAttribute("class") ?? "",
        rect: { x: box.x, y: box.y, width: box.width, height: box.height },
        style: {
          display: style.display,
          fontSize: style.fontSize,
          gridTemplateColumns: style.gridTemplateColumns,
          paddingLeft: style.paddingLeft,
          width: style.width,
        },
      }];
    }));
  });
}

const interactionStates = new Set<string>(nw223InteractionStates);

async function preparePair(skyline: Page, trigger: Page, capture: string, scenario: FidelityScenario, step: PresenterObservationStep) {
  await Promise.all([
    step("fixture-prepare:skyline", () => prepareCapture(skyline, capture, "/skyline")),
    step("fixture-prepare:trigger", () => prepareCapture(trigger, capture, "/reference")),
  ]);
  await Promise.all([
    step("fixture-seed:skyline", () => seedOwnedState(skyline, scenario)),
    step("fixture-seed:trigger", () => seedOwnedState(trigger, scenario, "/reference")),
  ]);
  await step("fixture-install:trigger", async () => installReferenceFixture(trigger, await referenceFixture));
  const fixture = await step("fixture-install:skyline", () => installSkylineFixture(skyline, scenario));
  await Promise.all([
    step("goto:skyline", () => skyline.goto(scenarioPath(scenario, fixture.catalog))),
    step("goto:trigger", () => trigger.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`)),
  ]);
  await step("ready:trigger", () => trigger.locator("html[data-oracle-ready='true']").waitFor());
  await step("node-select:skyline", () => exposeOwnedState(skyline, scenario, "skyline"));
  await step("node-select:trigger", () => exposeOwnedState(trigger, scenario, "trigger"));
  await step("live-change:skyline", () => applyLiveSystemChange(skyline, capture));
  await step("live-change:trigger", () => applyLiveSystemChange(trigger, capture));
  await step("settle:skyline", () => settleCapture(skyline));
  await step("settle:trigger", () => settleCapture(trigger));
  await step("presenter-ready:trigger", () => trigger.locator(definition.triggerSelector).waitFor());
  await step("presenter-ready:skyline", () => skyline.locator(definition.skylineSelector).waitFor());
  const expected = operationState(scenario.state);
  await Promise.all([
    step("anchor-state:trigger", () => expectSelectedOperationState(trigger, expected)),
    step("anchor-state:skyline", () => expectSelectedOperationState(skyline, expected)),
  ]);
}

async function expectSelectedOperationState(page: Page, expected: ReturnType<typeof operationState>) {
  const anchor = page.locator(definition.triggerAnchorSelector);
  await expect(anchor).toHaveCount(1);
  await expect(anchor).toHaveAttribute("aria-expanded", "true");
  await expect(anchor.locator("p")).toHaveText(expected.label);
  await expect(anchor.locator(`svg[aria-hidden='true'].text-${expected.status}`)).toHaveCount(1);
}

function operationState(state: string) {
  if (!isNw223State(state)) throw new Error(`Unexpected NW-223 state: ${state}`);
  const presentation = nw223Presentation(state);
  return {
    label: ({ sql: "SQL query", transaction: "Database transaction", cache: "Cache operation", redis: "Redis command" } as const)[presentation.type],
    status: presentation.failure ? "error" : "success",
  };
}

async function proveCaptureInteraction(browser: Browser, capture: string, scenario: FidelityScenario) {
  const context = await browser.newContext({ locale: "en-US", timezoneId: "UTC", deviceScaleFactor: 1, permissions: ["clipboard-read", "clipboard-write"] });
  const skyline = await context.newPage();
  const trigger = await context.newPage();
  try {
    await preparePair(skyline, trigger, capture, scenario, observationStep(capture));
    const [triggerAxe, skylineAxe] = await Promise.all([
      capturePartitionedAxe(trigger, definition.triggerSelector),
      capturePartitionedAxe(skyline, definition.skylineSelector),
    ]);
    const differences = pairedPresenterAxeDifferences(triggerAxe, skylineAxe);
    const axeLedger = { trigger: normalizedPartitionLedger(triggerAxe), skyline: normalizedPartitionLedger(skylineAxe) };
    process.stdout.write(`\nNW223_AXE_PREFLIGHT=${JSON.stringify({ capture, differences, axeLedger })}\n`);
    expect(differences).toEqual([]);
    if (process.env.SKYLINE_NW223_AXE_ONLY === "1") return;
    const triggerInteraction = await exerciseCapture(trigger, trigger.locator(definition.triggerSelector), false, scenario);
    const skylineInteraction = await exerciseCapture(skyline, skyline.locator(definition.skylineSelector), true, scenario);
    expect(triggerInteraction).toEqual(expectedExpandedDialogTranscript("trigger"));
    expect(skylineInteraction).toEqual(expectedExpandedDialogTranscript("skyline"));
    process.stdout.write(`\nNW223_ESCAPE_PREFLIGHT=${JSON.stringify({ capture, trigger: triggerInteraction, skyline: skylineInteraction })}\n`);
  } finally {
    await context.close();
  }
}

function observationStep(capture: string): PresenterObservationStep {
  return async <T>(label: string, action: () => Promise<T>) => {
    const started = Date.now();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        action(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error(`NW223 discovery phase ${label} exceeded 2000ms for ${capture}.`)), 2_000);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      process.stdout.write(`\nNW223_DISCOVERY_STEP=${JSON.stringify({ capture, label, elapsedMs: Date.now() - started })}\n`);
    }
  };
}

async function exerciseCapture(page: Page, region: Locator, named: boolean, scenario: FidelityScenario) {
  const application = named ? "skyline" : "trigger";
  const step = <T>(label: string, action: () => Promise<T>) => interactionStep(`${application}:${label}`, scenario.id, action);
  const buttons = region.locator("button");
  const wrap = named ? region.getByRole("button", { name: /^Wrap / }).first() : buttons.nth(0);
  const copy = named ? region.getByRole("button", { name: /^Copy / }).first() : buttons.nth(1);
  const expand = named ? region.getByRole("button", { name: /^Expand / }).first() : buttons.nth(2);
  const expandHandle = await step("expand-handle", () => expand.elementHandle());
  if (!expandHandle) throw new Error(`Missing ${application} expand control for ${scenario.id}.`);
  const copiedFeedback = page.getByText("Copied", { exact: true });
  await step("wrap-copy", async () => {
    await wrap.click();
    await copy.click();
    await expect(copiedFeedback).toBeVisible();
    expect((await page.evaluate(() => navigator.clipboard.readText())).length).toBeGreaterThan(0);
  });
  const dialogCountBefore = await step("dialog-baseline", () => page.getByRole("dialog").count());
  const expectedDialogs = expandedDialogCounts(dialogCountBefore);
  await step("expand", async () => {
    await expand.click();
    await expect.poll(() => page.getByRole("dialog").count()).toBe(expectedDialogs.open);
  });
  const dialog = page.getByRole("dialog").last();
  await step("dialog-ready", async () => {
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.closest("[role='dialog']") !== null)).toBe(true);
  });
  if (named) await step("variant", () => exerciseVariantDialog(page, dialog, scenario));
  await step("copy-settle", () => expect(copiedFeedback).not.toBeVisible());
  await step("escape", async () => {
    await page.keyboard.press("Escape");
    await expect.poll(() => page.getByRole("dialog").count()).toBe(expectedDialogs.closed);
  });
  return step("transcript", async () => ({
      dialogCountBefore,
      dialogCountAfterEscape: await page.getByRole("dialog").count(),
      expand: await expandHandle.evaluate((element) => ({ connected: element.isConnected, focused: document.activeElement === element })),
      presenterCount: await region.count(),
      selectedAnchorCount: await page.locator(definition.triggerAnchorSelector).count(),
      active: await page.evaluate(() => {
        const element = document.activeElement;
        return element ? {
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role") ?? "",
          name: element.getAttribute("aria-label") ?? (element.matches("button, [role='tab']") ? element.textContent?.replaceAll(/\s+/g, " ").trim() ?? "" : ""),
        } : null;
      }),
    }));
}

async function interactionStep<T>(label: string, capture: string, action: () => Promise<T>) {
  const started = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      action(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`NW223 interaction phase ${label} exceeded 6000ms for ${capture}.`)), 6_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    process.stdout.write(`\nNW223_INTERACTION_STEP=${JSON.stringify({ capture, label, elapsedMs: Date.now() - started })}\n`);
  }
}

async function exerciseVariantDialog(page: Page, dialog: Locator, scenario: FidelityScenario) {
  const presentation = operationState(scenario.state);
  await expect(dialog.getByRole("heading", { name: presentation.label })).toBeVisible();

  if (scenario.state === "inspectors-sql-applied") {
    const tabs = dialog.getByRole("tablist", { name: "SQL display" });
    await tabs.getByRole("tab", { name: "Parameterized" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "With bindings" })).toBeFocused();
    await expect(tabs.getByRole("tab", { name: "With bindings" })).toHaveAttribute("aria-selected", "true");
  }
  if (scenario.state === "inspectors-sql-result") {
    const tabs = dialog.getByRole("tablist", { name: "Result preview display" });
    await tabs.getByRole("tab", { name: "Text" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Tree" })).toBeFocused();
    await expect(tabs.getByRole("tab", { name: "Tree" })).toHaveAttribute("aria-selected", "true");
  }
  if (scenario.state === "inspectors-sql-long") await expect(dialog.getByRole("button", { name: "Wrap Parameterized SQL" })).toBeVisible();
  if (scenario.state === "inspectors-transaction-nesting") await expect(dialog.getByLabel("Database transaction detail").getByText("2", { exact: true })).toBeVisible();
  if (scenario.state.endsWith("failure")) await expect(dialog.getByRole("alert")).toBeVisible();
  if (scenario.state === "inspectors-cache-long") await expect(dialog.getByRole("button", { name: "Wrap Value" })).toBeVisible();
  if (scenario.state === "inspectors-cache-unavailable") await expect(dialog.getByText("Value not captured", { exact: true })).toBeVisible();
  if (scenario.state === "inspectors-redis-long") await expect(dialog.getByRole("button", { name: "Wrap Arguments" })).toBeVisible();
  if (scenario.state === "inspectors-redis-unavailable") await expect(dialog.getByText("Arguments not captured", { exact: true })).toBeVisible();
}
