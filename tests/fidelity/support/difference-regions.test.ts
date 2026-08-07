import type { Page } from "@playwright/test";
import { PNG } from "pngjs";
import { describe, expect, test, vi } from "vitest";
import {
  applicableCapabilityOmissions,
  applicableFrameworkExtensions,
  applicablePresenterExtensions,
  accessibilityOmissionSelectors,
  captureProtectedElementCrop,
  fingerprintAccessibility,
  fingerprintCapabilityAccessibility,
  fingerprintComputedStyle,
  omitFrameworkExtensionAccessibility,
  observeElementAccessibility,
  observeElementDom,
  requireSingleMatch,
  resolveFrameworkExtensionAccessibilitySelector,
  settleStableElementPair,
  validateFrameworkExtensionObservation,
  validateCapabilityOmissionObservation,
  validateProtectedElementPresentation,
  validatePairedAnchor,
  validatePresenterExtensionObservation,
  waitForDifferenceRegions,
  waitForStableElementStyle,
  type CapabilityOmissionDefinition,
  type FrameworkExtensionDefinition,
  type PresenterExtensionDefinition,
} from "./difference-regions";

describe("framework-extension fidelity regions", () => {
  test("capability markers fingerprint ignored wrapper subtrees without role identity", async () => {
    const snapshot = "- text: unavailable";
    const ariaSnapshot = vi.fn(async () => snapshot);

    await expect(fingerprintCapabilityAccessibility({ ariaSnapshot })).resolves.toBe(fingerprintAccessibility(snapshot));
    expect(ariaSnapshot).toHaveBeenCalledOnce();
  });

  test("capability markers lock distinct null and empty subtree sentinels", async () => {
    await expect(fingerprintCapabilityAccessibility({ ariaSnapshot: async () => null })).resolves.toBe(fingerprintAccessibility("<null-capability-subtree>"));
    await expect(fingerprintCapabilityAccessibility({ ariaSnapshot: async () => "" })).resolves.toBe(fingerprintAccessibility("<empty-capability-subtree>"));
  });

  test("requires the exact selector, anchor-relative geometry, style, and accessible identity", () => {
    const expected = definition();
    const observed = {
      skylineSelector: expected.skylineSelector,
      triggerAnchorSelector: expected.triggerAnchorSelector,
      skylineAnchorSelector: expected.skylineAnchorSelector,
      accessibleRole: expected.accessibleRole,
      accessibleName: expected.accessibleName,
      rect: { x: 10, y: 20, width: 30, height: 40 },
      accessibilitySha256: "c".repeat(64),
      ...expected.measurements[expected.captures[0]],
    };

    expect(validateFrameworkExtensionObservation(expected, observed, expected.captures[0])).toBe(observed);
    expect(() => validateFrameworkExtensionObservation(expected, { ...observed, relativeRect: { ...observed.relativeRect, y: 9 } }, expected.captures[0])).toThrow(/anchor-relative geometry/i);
    expect(() => validateFrameworkExtensionObservation(expected, { ...observed, computedStyleSha256: "b".repeat(64) }, expected.captures[0])).toThrow(/computedStyleSha256/i);
    expect(() => validateFrameworkExtensionObservation(expected, { ...observed, accessibilitySha256: "d".repeat(64) }, expected.captures[0])).toThrow(/accessibilitySha256/i);
    expect(() => validateFrameworkExtensionObservation(expected, { ...observed, accessibleName: "Changed" }, expected.captures[0])).toThrow(/accessibleName/i);
    expect(() => validateFrameworkExtensionObservation(expected, observed, "error-found@1440x960-dark")).toThrow(/lacks measurement/i);
  });

  test("fails on duplicate selectors or paired anchor drift", () => {
    const expected = definition();
    const measurement = expected.measurements[expected.captures[0]];
    const anchor = { rect: measurement.anchorRect, accessibleRole: "heading", accessibleName: "Details", computedStyleSha256: measurement.anchorComputedStyleSha256, accessibilitySha256: "c".repeat(64) };

    expect(() => requireSingleMatch(2, expected.id, "Skyline extension")).toThrow(
      "Allowed region php-exception-evidence Skyline extension must match exactly one element; observed 2.",
    );
    expect(() => validatePairedAnchor(expected, anchor, { ...anchor, rect: { ...anchor.rect, x: 11 } }, expected.captures[0])).toThrow(/geometry/i);
    expect(() => validatePairedAnchor(expected, anchor, { ...anchor, computedStyleSha256: "c".repeat(64) }, expected.captures[0])).toThrow(/computed style/i);
    expect(() => validatePairedAnchor(expected, anchor, { ...anchor, accessibleName: "Changed" }, expected.captures[0])).toThrow(/accessible identity/i);
  });

  test("captures one exact DOM match in one page task", async () => {
    document.body.innerHTML = `<section id="evidence" class="panel" role="region" aria-label="Exception" style="color: rgb(1, 2, 3)"></section>`;
    const element = document.querySelector("#evidence") as HTMLElement;
    element.getBoundingClientRect = () => ({ x: 10, y: 20, width: 30, height: 40 } as DOMRect);
    const page = evaluatingPage();

    const observation = await observeElementDom(page.page, "php-exception-evidence", "#evidence", "Skyline extension");

    expect(page.evaluate).toHaveBeenCalledTimes(1);
    expect(observation).toMatchObject({
      rect: { x: 10, y: 20, width: 30, height: 40 },
      identity: { tagName: "section", id: "evidence", className: "panel", role: "region", ariaLabel: "Exception" },
    });
    expect(observation.computedStyle).toContainEqual(["color", "rgb(1, 2, 3)", ""]);
  });

  test("defaults framework accessibility identity to the geometry selector", async () => {
    const expected = definition();
    const page = countingPage(1);

    await expect(resolveFrameworkExtensionAccessibilitySelector(page.page, expected)).resolves.toBe(expected.skylineSelector);
    expect(page.locator).toHaveBeenCalledWith(expected.skylineSelector);
  });

  test("requires one exact optional framework accessibility selector", async () => {
    const expected = { ...definition(), skylineAccessibilitySelector: "[data-extension] > select" };
    const page = countingPage(1);

    await expect(resolveFrameworkExtensionAccessibilitySelector(page.page, expected)).resolves.toBe(expected.skylineAccessibilitySelector);
    expect(page.locator).toHaveBeenCalledWith(expected.skylineAccessibilitySelector);
    await expect(resolveFrameworkExtensionAccessibilitySelector(countingPage(0).page, expected)).rejects.toThrow(/exactly one element; observed 0/i);
    await expect(resolveFrameworkExtensionAccessibilitySelector(countingPage(2).page, expected)).rejects.toThrow(/exactly one element; observed 2/i);
  });

  test("fingerprints the outer framework marker while reading identity from its inner control", async () => {
    const page = accessibilityPage();
    const observation = { rect: { x: 1, y: 2, width: 3, height: 4 }, computedStyleSha256: "a".repeat(64) };

    const result = await observeElementAccessibility(page.page, "[data-extension] > select", observation, "[data-extension]");

    expect(result).toMatchObject({ accessibleRole: "combobox", accessibleName: "Connection" });
    expect(result.accessibilitySha256).toBe(fingerprintAccessibility("- combobox \"Connection\""));
    expect(page.locator).toHaveBeenCalledWith("[data-extension]");
    expect(page.querySelectorCalls()).toEqual(["[data-extension] > select"]);
  });

  test("waits for three consecutive attached visible semantic style frames", async () => {
    const page = styleStabilityPage([
      styleSample("transition-property:all"),
      styleSample("transition-property:none"),
      styleSample("transition-property:none"),
      styleSample("transition-property:none"),
    ]);

    await waitForStableElementStyle(page.page, "[data-extension]", { consecutiveFrames: 3, maxFrames: 6 });

    expect(page.wait).toHaveBeenCalledWith({ state: "visible" });
    expect(page.sampleCount()).toBe(4);
  });

  test("fails closed when an attached visible style never stabilizes", async () => {
    const page = styleStabilityPage([
      styleSample("transition-property:all"),
      styleSample("transition-property:none"),
      styleSample("transition-property:all"),
    ]);

    await expect(waitForStableElementStyle(page.page, "[data-extension]", { consecutiveFrames: 2, maxFrames: 3 }))
      .rejects.toThrow(/stable computed style/i);
  });

  test("settles both visible presenters only between paired stable observations", async () => {
    const trigger = styleStabilityPage(Array.from({ length: 6 }, () => styleSample("transition-property:none")));
    const skyline = styleStabilityPage(Array.from({ length: 6 }, () => styleSample("transition-property:none")));
    const settled: Page[] = [];

    await settleStableElementPair([
      { label: "trigger", page: trigger.page, selector: "[data-trigger]" },
      { label: "skyline", page: skyline.page, selector: "[data-skyline]" },
    ], async (page) => {
      expect(trigger.sampleCount()).toBe(3);
      expect(skyline.sampleCount()).toBe(3);
      settled.push(page);
    });

    expect(settled).toEqual([trigger.page, skyline.page]);
    expect(trigger.sampleCount()).toBe(6);
    expect(skyline.sampleCount()).toBe(6);
  });

  test("fails closed when the atomic DOM task finds missing or duplicate matches", async () => {
    const page = evaluatingPage();
    document.body.innerHTML = "";
    await expect(observeElementDom(page.page, "php-exception-evidence", ".evidence", "Skyline extension")).rejects.toThrow(/exactly one/i);

    document.body.innerHTML = `<div class="evidence"></div><div class="evidence"></div>`;
    await expect(observeElementDom(page.page, "php-exception-evidence", ".evidence", "Skyline extension")).rejects.toThrow(/exactly one/i);
  });

  test("keeps the selected element identity when it is replaced during observation", async () => {
    document.body.innerHTML = `<section id="original" class="evidence"></section>`;
    const original = document.querySelector(".evidence") as HTMLElement;
    original.getBoundingClientRect = () => {
      const replacement = document.createElement("aside");
      replacement.id = "replacement";
      replacement.className = "evidence";
      original.replaceWith(replacement);
      return { x: 1, y: 2, width: 3, height: 4 } as DOMRect;
    };

    const observation = await observeElementDom(evaluatingPage().page, "php-exception-evidence", ".evidence", "Skyline extension");

    expect(observation.identity).toMatchObject({ tagName: "section", id: "original", className: "evidence" });
    expect(document.querySelector(".evidence")?.id).toBe("replacement");
  });

  test("ignores only non-rendered custom-property inventory", () => {
    const trigger = [["--unused-trigger", "1", ""], ["color", "rgb(1, 2, 3)", ""]] as [string, string, string][];
    const skyline = [["--unused-skyline", "2", ""], ["color", "rgb(1, 2, 3)", ""]] as [string, string, string][];

    expect(fingerprintComputedStyle(trigger)).toBe(fingerprintComputedStyle(skyline));
    expect(fingerprintComputedStyle(trigger)).not.toBe(fingerprintComputedStyle([["color", "rgb(3, 2, 1)", ""]]));
  });

  test("allows multiple uniquely identified framework controls on one shared anchor", () => {
    const region = definition();
    const siblings = ["Occurrence activity", "Logs", "Errors", "Queues"].map((accessibleName, index) => ({
      ...definition(),
      id: `shell-control-${index}`,
      skylineSelector: `[data-skyline-extension='shell-control-${index}']`,
      accessibleRole: "button",
      accessibleName,
    }));
    const sibling = siblings[0];
    const queue = { ...definition(), id: "queue-recorded-runs", captures: ["queue-found@1440x960-classic"], skylineSelector: "[data-skyline-extension='queue-recorded-runs']", triggerAnchorSelector: ".queue-heading", skylineAnchorSelector: ".queue-heading" };
    expect(applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [region, ...siblings] })).toEqual([region, ...siblings]);
    expect(applicableFrameworkExtensions("queue-found@1440x960-classic", { regions: [region, queue] })).toEqual([queue]);
    expect(applicableFrameworkExtensions("errors-populated@1440x960-classic", { regions: [region] })).toEqual([]);
    expect(() => applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [region, { ...sibling, accessibleRole: region.accessibleRole, accessibleName: region.accessibleName }] })).toThrow(/identity/i);
    expect(() => applicableFrameworkExtensions("queue-found@1440x960-classic", { regions: [region, { ...queue, skylineSelector: region.skylineSelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [region, { ...sibling, triggerAnchorSelector: ".other-heading" }] })).toThrow(/anchor|selector/i);
    expect(() => applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [region, { ...sibling, triggerAnchorSelector: region.skylineSelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [region, { ...presenterDefinition(), captures: region.captures }] })).toThrow(/overlap|presenter/i);
    expect(() => applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [{ ...region, triggerAnchorSelector: region.skylineSelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [{ ...region, skylineAnchorSelector: region.skylineSelector }] })).toThrow(/selector/i);
  });

  test("owns optional accessibility selectors without weakening selector collisions", () => {
    const region = { ...definition(), skylineAccessibilitySelector: "[data-extension-control]" };
    const sibling = { ...definition(), id: "sibling", skylineSelector: "[data-sibling]", accessibleName: "Sibling" };
    const presenter = { ...presenterDefinition(), captures: ["runs-other@1440x960-classic"], triggerSelector: region.skylineAccessibilitySelector };
    const capability = capabilityDefinition();
    capability.selectorPairs[0] = { ...capability.selectorPairs[0], skylineSelector: region.skylineAccessibilitySelector };

    expect(() => applicableFrameworkExtensions(region.captures[0], { regions: [{ ...region, skylineAccessibilitySelector: region.skylineSelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions(region.captures[0], { regions: [{ ...region, skylineAccessibilitySelector: region.triggerAnchorSelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions(region.captures[0], { regions: [{ ...region, skylineAccessibilitySelector: region.skylineAnchorSelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions(region.captures[0], { regions: [region, { ...sibling, skylineSelector: region.skylineAccessibilitySelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions(region.captures[0], { regions: [region, { ...sibling, triggerAnchorSelector: region.skylineAccessibilitySelector, skylineAnchorSelector: region.skylineAccessibilitySelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions(region.captures[0], { regions: [region, presenter] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions(region.captures[0], { regions: [region, capability] })).toThrow(/selector/i);
  });

  test("omits exactly the named extension AX subtree", () => {
    const tree = { role: "main", children: [{ role: "heading", name: "Error" }, { role: "region", name: "Exception", children: [{ role: "button", name: "Show 2 frames" }] }] };
    const manifest = { regions: [definition()] };

    expect(omitFrameworkExtensionAccessibility(tree, "error-found@1440x960-classic", manifest)).toEqual({ role: "main", children: [{ role: "heading", name: "Error" }] });
    expect(() => omitFrameworkExtensionAccessibility({ role: "main" }, "error-found@1440x960-classic", manifest)).toThrow(/omitted 0/i);

    const sibling = { ...definition(), id: "occurrence", skylineSelector: "[data-extension='occurrence']", accessibleRole: "button", accessibleName: "Occurrence activity" };
    const multiple = { regions: [definition(), sibling] };
    expect(omitFrameworkExtensionAccessibility({ role: "main", children: [{ role: "region", name: "Exception" }, { role: "button", name: "Occurrence activity" }] }, "error-found@1440x960-classic", multiple)).toEqual({ role: "main" });
    expect(() => omitFrameworkExtensionAccessibility({ role: "main", children: [{ role: "region", name: "Exception" }] }, "error-found@1440x960-classic", multiple)).toThrow(/omitted 1/i);
    expect(() => omitFrameworkExtensionAccessibility({ role: "main", children: [{ role: "region", name: "Exception" }, { role: "button", name: "Occurrence activity" }, { role: "button", name: "Occurrence activity" }] }, "error-found@1440x960-classic", multiple)).toThrow(/omitted 3/i);
  });

  test("locks both presenter sides while preserving their distinct evidence", () => {
    const expected = presenterDefinition();
    const observed = {
      triggerSelector: expected.triggerSelector,
      skylineSelector: expected.skylineSelector,
      triggerAnchorSelector: expected.triggerAnchorSelector,
      skylineAnchorSelector: expected.skylineAnchorSelector,
      skylineAccessibleRole: expected.skylineAccessibleRole,
      skylineAccessibleName: expected.skylineAccessibleName,
      triggerRect: { x: 10, y: 20, width: 30, height: 40 },
      skylineRect: { x: 10, y: 20, width: 30, height: 40 },
      ...expected.measurements[expected.captures[0]],
    };

    expect(validatePresenterExtensionObservation(expected, observed, expected.captures[0])).toBe(observed);
    const retry = { ...expected, measurements: { [expected.captures[0]]: { ...expected.measurements[expected.captures[0]], anchorAccessibleName: "LogicException" } } };
    expect(validatePresenterExtensionObservation(retry, { ...observed, anchorAccessibleName: "LogicException" }, expected.captures[0])).toMatchObject({ anchorAccessibleName: "LogicException" });
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, triggerComputedStyleSha256: "0".repeat(64) }, expected.captures[0])).toThrow(/triggerComputedStyleSha256/i);
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, skylineAccessibilitySha256: "0".repeat(64) }, expected.captures[0])).toThrow(/skylineAccessibilitySha256/i);
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, skylineRelativeRect: { ...observed.skylineRelativeRect, y: 99 } }, expected.captures[0])).toThrow(/Skyline anchor-relative geometry/i);
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, skylineRect: { ...observed.skylineRect, height: 41 } }, expected.captures[0])).toThrow(/geometry/i);
  });

  test("allows one presenter extension and identifies both AX omission selectors", () => {
    const region = presenterDefinition();
    const expanded = {
      ...presenterDefinition(),
      id: "attempt-exception-dialog",
      captures: ["runs-exception-expanded@1440x960-classic"],
      triggerSelector: "[role='dialog']",
      skylineSelector: "[role='dialog']",
      triggerAnchorSelector: "[role='dialog'] > button:last-child",
      skylineAnchorSelector: "[role='dialog'] > button:last-child",
      measurements: { "runs-exception-expanded@1440x960-classic": presenterDefinition().measurements[region.captures[0]] },
    };
    expect(applicablePresenterExtensions(region.captures[0], { regions: [region] })).toEqual([region]);
    expect(applicablePresenterExtensions(expanded.captures[0], { regions: [region, expanded] })).toEqual([expanded]);
    const observed = { kind: "presenter-extension", id: region.id, presenter: {} as never, expected: { triggerSelector: region.triggerSelector, skylineSelector: region.skylineSelector } as never } as const;
    expect(accessibilityOmissionSelectors([observed], "trigger")).toEqual([region.triggerSelector]);
    expect(accessibilityOmissionSelectors([observed], "skyline")).toEqual([region.skylineSelector]);
    expect(() => applicablePresenterExtensions(region.captures[0], { regions: [region, { ...region, id: "duplicate" }] })).toThrow(/overlap|multiple/i);
  });

  test("waits for every presenter selector before capture settling", async () => {
    const region = presenterDefinition();
    const trigger = waitingPage();
    const skyline = waitingPage();

    await waitForDifferenceRegions(trigger.page, skyline.page, region.captures[0], { regions: [region] });

    expect(trigger.locator.mock.calls.map(([selector]) => selector)).toEqual([region.triggerAnchorSelector, region.triggerSelector]);
    expect(skyline.locator.mock.calls.map(([selector]) => selector)).toEqual([region.skylineAnchorSelector, region.skylineSelector]);
    expect([...trigger.wait.mock.calls, ...skyline.wait.mock.calls]).toEqual(Array(4).fill([{ state: "attached" }]));
  });

  test("locks every capability-omission selector pair and omits both AX subtrees", () => {
    const region = capabilityDefinition();
    const measurement = region.measurements[region.captures[0]];
    const observed = {
      selectorPairs: region.selectorPairs.map((pair) => ({ ...pair, ...measurement[pair.id] })),
    };

    expect(validateCapabilityOmissionObservation(region, observed, region.captures[0])).toBe(observed);
    expect(applicableCapabilityOmissions(region.captures[0], { regions: [region] })).toEqual([region]);
    expect(applicableCapabilityOmissions(region.captures[0], { regions: [region, { ...definition(), captures: region.captures }] })).toEqual([region]);
    expect(accessibilityOmissionSelectors([{ kind: "capability-omission", id: region.id, omissions: observed.selectorPairs, expected: measurement }], "trigger")).toEqual(region.selectorPairs.map((pair) => pair.triggerSelector));
    expect(accessibilityOmissionSelectors([{ kind: "capability-omission", id: region.id, omissions: observed.selectorPairs, expected: measurement }], "skyline")).toEqual(region.selectorPairs.map((pair) => pair.skylineSelector));
    expect(() => validateCapabilityOmissionObservation(region, { selectorPairs: observed.selectorPairs.map((pair, index) => index ? pair : { ...pair, skylineAccessibilitySha256: "0".repeat(64) }) }, region.captures[0])).toThrow(/skylineAccessibilitySha256/i);
    expect(() => applicableCapabilityOmissions(region.captures[0], { regions: [region, { ...region, id: "duplicate" }] })).toThrow(/overlap|owner/i);
    expect(() => applicableCapabilityOmissions(region.captures[0], { regions: [region, { ...region, id: "disjoint-reuse", captures: ["queues-busy@1440x960-dark"], measurements: { "queues-busy@1440x960-dark": measurement } }] })).not.toThrow();
    expect(() => applicableCapabilityOmissions(region.captures[0], { regions: [{ ...region, selectorPairs: [...region.selectorPairs, { ...region.selectorPairs[0], id: "duplicate" }] }] })).toThrow(/selector ownership/i);
  });

  test("measures Skyline reflow boundaries without omitting their AX subtrees", () => {
    const region = capabilityDefinition();
    region.selectorPairs[0] = { ...region.selectorPairs[0], skylineBoundary: true };
    const measurement = region.measurements[region.captures[0]];
    const observed = { selectorPairs: region.selectorPairs.map((pair) => ({ ...pair, ...measurement[pair.id] })) };

    expect(() => applicableCapabilityOmissions(region.captures[0], { regions: [region] })).toThrow(/protected reflow evidence/i);
    expect(accessibilityOmissionSelectors([{ kind: "capability-omission", id: region.id, omissions: observed.selectorPairs, expected: measurement }], "trigger")).toEqual(region.selectorPairs.map((pair) => pair.triggerSelector));
    expect(accessibilityOmissionSelectors([{ kind: "capability-omission", id: region.id, omissions: observed.selectorPairs, expected: measurement }], "skyline")).toEqual([region.selectorPairs[1].skylineSelector]);
    expect(() => applicableCapabilityOmissions(region.captures[0], { regions: [{ ...region, selectorPairs: [{ ...region.selectorPairs[0], skylineBoundary: false as true }, region.selectorPairs[1]] }] })).toThrow(/selector ownership/i);
  });

  test("locks protected reflow evidence including element screenshots", () => {
    const region = capabilityDefinition();
    region.selectorPairs[0] = { ...region.selectorPairs[0], skylineBoundary: true };
    region.protectedSelectors = [{ id: "search", application: "skyline", selector: "[data-protected='search']" }];
    region.protectedMeasurements = {
      [region.captures[0]]: {
        search: {
          rect: { x: 4, y: 5, width: 20, height: 24 },
          computedStyleSha256: "e".repeat(64),
          accessibilitySha256: "f".repeat(64),
          crop: { status: "visible", rect: { x: 4, y: 5, width: 20, height: 24 }, screenshotSha256: "1".repeat(64) },
        },
      },
    };
    const measurement = region.measurements[region.captures[0]];
    const protectedMeasurement = region.protectedMeasurements[region.captures[0]];
    const observed = {
      selectorPairs: region.selectorPairs.map((pair) => ({ ...pair, ...measurement[pair.id] })),
      protectedSelectors: region.protectedSelectors.map((selector) => ({ ...selector, ...protectedMeasurement[selector.id] })),
    };

    expect(validateCapabilityOmissionObservation(region, observed, region.captures[0])).toBe(observed);
    expect(() => validateCapabilityOmissionObservation(region, { ...observed, protectedSelectors: [{ ...observed.protectedSelectors[0], crop: { status: "visible", rect: { x: 4, y: 5, width: 20, height: 24 }, screenshotSha256: "2".repeat(64) } }] }, region.captures[0])).toThrow(/crop/i);
    expect(() => validateCapabilityOmissionObservation(region, { ...observed, protectedSelectors: [{ ...observed.protectedSelectors[0], accessibilitySha256: "2".repeat(64) }] }, region.captures[0])).toThrow(/accessibilitySha256/i);
    expect(() => applicableCapabilityOmissions(region.captures[0], { regions: [{ ...region, protectedSelectors: [{ ...region.protectedSelectors![0], selector: region.selectorPairs[0].skylineSelector }] }] })).toThrow(/selector ownership/i);
  });

  test("protected screenshot fingerprints catch painted color and icon drift", () => {
    const screenshot = (changed: boolean) => {
      const png = new PNG({ width: 2, height: 2 });
      png.data.fill(255);
      if (changed) png.data.set([0, 0, 0, 255], 0);
      return PNG.sync.write(png);
    };
    const rect = { x: 0, y: 0, width: 1, height: 1 };

    expect(captureProtectedElementCrop(screenshot(false), { width: 2, height: 2 }, rect))
      .not.toEqual(captureProtectedElementCrop(screenshot(true), { width: 2, height: 2 }, rect));
    expect(() => captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 0, y: 3, width: 1, height: 1 })).toThrow(/below the viewport/i);
    expect(captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 0, y: 3, width: 1, height: 1 }, true)).toEqual({ status: "below-viewport" });
    expect(() => captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 3, y: 0, width: 1, height: 1 }, true)).toThrow(/outside the viewport/i);
    expect(captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 3, y: 0, width: 1, height: 1 }, undefined, true)).toEqual({ status: "right-of-viewport" });
    expect(() => captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 3, y: 3, width: 1, height: 1 }, undefined, true)).toThrow(/below the viewport/i);
    expect(captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 3, y: 3, width: 1, height: 1 }, true, true)).toEqual({ status: "right-of-viewport" });
    expect(() => captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: -3, y: 0, width: 1, height: 1 }, true, true)).toThrow(/outside the viewport/i);
  });

  test("rejects protected elements without positive visible presentation", () => {
    const visible = [["display", "block", ""], ["visibility", "visible", ""], ["content-visibility", "visible", ""], ["opacity", "1", ""]] as [string, string, string][];
    expect(() => validateProtectedElementPresentation("region", "selector", { rect: { x: 0, y: 0, width: 10, height: 10 }, computedStyle: visible })).not.toThrow();
    expect(() => validateProtectedElementPresentation("region", "selector", { rect: { x: 0, y: 0, width: 0, height: 10 }, computedStyle: visible })).toThrow(/positive box/i);
    for (const [property, value] of [["display", "none"], ["visibility", "hidden"], ["content-visibility", "hidden"], ["opacity", "0"]]) {
      expect(() => validateProtectedElementPresentation("region", "selector", { rect: { x: 0, y: 0, width: 10, height: 10 }, computedStyle: [[property, value, ""]] })).toThrow(/visibly painted/i);
    }
  });
});

function definition(): FrameworkExtensionDefinition {
  return {
    id: "php-exception-evidence",
    category: "framework-extension",
    decision: "NW-224",
    acceptance: "Detail adds representative application/vendor frames, occurrence activity, and cursor-paginated failed Attempts.",
    captures: ["error-found@1440x960-classic"],
    skylineSelector: "[data-skyline-extension='error-exception-evidence']",
    triggerAnchorSelector: ".error-details-heading",
    skylineAnchorSelector: ".error-details-heading",
    accessibleRole: "region",
    accessibleName: "Exception",
    anchorAccessibleRole: "heading",
    anchorAccessibleName: "Details",
    measurements: {
      "error-found@1440x960-classic": {
        relativeRect: { x: 0, y: 8, width: 300, height: 120 },
        computedStyleSha256: "a".repeat(64),
        accessibilitySha256: "c".repeat(64),
        anchorRect: { x: 10, y: 10, width: 300, height: 24 },
        anchorComputedStyleSha256: "b".repeat(64),
      },
    },
  };
}

function presenterDefinition(): PresenterExtensionDefinition {
  return {
    id: "attempt-exception-evidence",
    category: "presenter-extension",
    decision: "NW-222",
    acceptance: ["Failed-Attempt detail exposes captured exception evidence."],
    citations: ["https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L1446-L1513"],
    captures: ["runs-exception@1440x960-classic"],
    triggerSelector: "[translate='no']",
    skylineSelector: "[data-skyline-extension='attempt-exception-evidence']",
    triggerAnchorSelector: ".attempt-error",
    skylineAnchorSelector: ".attempt-error",
    skylineAccessibleRole: "region",
    skylineAccessibleName: "Exception",
    anchorAccessibleRole: "heading",
    anchorAccessibleName: "Illuminate\\Database\\DeadlockException",
    measurements: {
      "runs-exception@1440x960-classic": {
        triggerRelativeRect: { x: 1, y: 10, width: 30, height: 40 },
        skylineRelativeRect: { x: 1, y: 10, width: 30, height: 40 },
        triggerComputedStyleSha256: "a".repeat(64),
        skylineComputedStyleSha256: "b".repeat(64),
        triggerAccessibilitySha256: "c".repeat(64),
        skylineAccessibilitySha256: "d".repeat(64),
        anchorRect: { x: 9, y: 10, width: 32, height: 80 },
        anchorComputedStyleSha256: "e".repeat(64),
        anchorAccessibilitySha256: "f".repeat(64),
        anchorAccessibleName: "Illuminate\\Database\\DeadlockException",
      },
    },
  };
}

function capabilityDefinition(): CapabilityOmissionDefinition {
  const selectors = ["allocated", "environment-limit"];
  return {
    id: "queue-unavailable-capabilities",
    category: "capability-omission",
    decision: "NW-223",
    acceptance: ["Unavailable broker metrics remain visibly absent without masking adjacent source UI."],
    citations: ["https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues/route.tsx#L211-L268"],
    captures: ["queues-busy@1440x960-classic"],
    selectorPairs: selectors.map((id) => ({ id, triggerSelector: `[data-trigger-capability='${id}']`, skylineSelector: `[data-skyline-capability='${id}']` })),
    protectedSelectors: [],
    protectedMeasurements: {},
    measurements: {
      "queues-busy@1440x960-classic": Object.fromEntries(selectors.map((id, index) => [id, {
        triggerRect: { x: index, y: 0, width: 1, height: 1 },
        skylineRect: { x: index, y: 0, width: 1, height: 1 },
        triggerComputedStyleSha256: "a".repeat(64),
        skylineComputedStyleSha256: "b".repeat(64),
        triggerAccessibilitySha256: "c".repeat(64),
        skylineAccessibilitySha256: "d".repeat(64),
      }])) as CapabilityOmissionDefinition["measurements"][string],
    },
  };
}

function waitingPage() {
  const wait = vi.fn((_options: { state: string }) => Promise.resolve());
  const locator = vi.fn((_selector: string) => ({ first: () => ({ waitFor: wait }) }));
  return { page: { locator } as unknown as Page, locator, wait };
}

function evaluatingPage() {
  const evaluate = vi.fn(async (operation: (selector: string) => unknown, selector: string) => operation(selector));
  return { page: { evaluate } as unknown as Page, evaluate };
}

function countingPage(matches: number) {
  const count = vi.fn(async () => matches);
  const locator = vi.fn(() => ({ count }));
  return { page: { locator } as unknown as Page, locator };
}

function accessibilityPage() {
  const selectors: string[] = [];
  const ariaSnapshot = vi.fn(async () => '- combobox "Connection"');
  const locator = vi.fn(() => ({ ariaSnapshot }));
  const send = vi.fn(async (method: string, params?: { selector?: string }) => {
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelector") {
      selectors.push(params?.selector ?? "");
      return { nodeId: 2 };
    }
    if (method === "DOM.describeNode") return { node: { backendNodeId: 3 } };
    if (method === "Accessibility.getPartialAXTree") return { nodes: [{ role: { value: "combobox" }, name: { value: "Connection" } }] };
    return {};
  });
  const session = { send, detach: vi.fn(async () => undefined) };
  const page = { locator, context: () => ({ newCDPSession: async () => session }) } as unknown as Page;
  return { page, locator, querySelectorCalls: () => selectors };
}

function styleSample(signature: string) {
  return { count: 1, attached: true, visible: true, signature };
}

function styleStabilityPage(samples: ReturnType<typeof styleSample>[]) {
  const wait = vi.fn(async () => undefined);
  const locator = vi.fn(() => ({ waitFor: wait }));
  let sampleIndex = 0;
  const evaluate = vi.fn(async (_operation: unknown, selector?: string) => selector === undefined ? undefined : samples[sampleIndex++]);
  return { page: { locator, evaluate } as unknown as Page, wait, sampleCount: () => sampleIndex };
}
