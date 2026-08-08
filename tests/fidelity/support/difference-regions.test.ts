import type { Page } from "@playwright/test";
import { PNG } from "pngjs";
import { describe, expect, test, vi } from "vitest";
import {
  applicableCapabilityOmissions,
  applicableFrameworkExtensions,
  applicablePresenterExtensions,
  accessibilityOmissionSelectors,
  captureProtectedElementCrop,
  discoverCapabilityOmissionObservation,
  fingerprintAccessibility,
  fingerprintCapabilityAccessibility,
  fingerprintComputedStyle,
  omitFrameworkExtensionAccessibility,
  observeElementAccessibility,
  observeElementDom,
  requireSingleMatch,
  rendererRasterizationAlternativesForCapture,
  resolveFrameworkExtensionAccessibilitySelector,
  skylineProtectedSelector,
  settleStableElementPair,
  validateFrameworkExtensionObservation,
  validateFrameworkExtensionDefinitions,
  validateBrandingIdentityObservation,
  validateCapabilityOmissionObservation,
  validateProtectedElementPresentation,
  validatePairedAnchor,
  validatePresenterExtensionObservation,
  validateRendererRasterizationObservation,
  waitForDifferenceRegions,
  waitForStableElementStyle,
  type CapabilityOmissionDefinition,
  type BrandingIdentityDefinition,
  type BrandingIdentityObservation,
  type FrameworkExtensionDefinition,
  type PresenterExtensionDefinition,
  type RendererRasterizationDefinition,
  type RendererRasterizationObservation,
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

  test("locks renderer runtime, presentation, DOM, CSS, geometry, AX, and crops", () => {
    const definition = rendererDefinition();
    const observation: RendererRasterizationObservation = {
      runtime: definition.measurements[definition.captures[0]].runtime,
      presentation: definition.presentation,
      trigger: definition.measurements[definition.captures[0]].trigger,
      skyline: definition.measurements[definition.captures[0]].skyline,
    };

    expect(validateRendererRasterizationObservation(definition, observation, definition.captures[0])).toBe(observation);
    expect(() => validateRendererRasterizationObservation(definition, { ...observation, runtime: { ...observation.runtime, browserVersion: "150.0.0.0" } }, definition.captures[0])).toThrow(/runtime/i);
    expect(() => validateRendererRasterizationObservation(definition, { ...observation, presentation: { ...observation.presentation, borderRadius: "7px" } }, definition.captures[0])).toThrow(/presentation/i);
    expect(() => validateRendererRasterizationObservation(definition, { ...observation, skyline: { ...observation.skyline, domSha256: "f".repeat(64) } }, definition.captures[0])).toThrow(/DOM/i);
    expect(() => validateRendererRasterizationObservation(definition, { ...observation, skyline: { ...observation.skyline, cropSha256: "f".repeat(64) } }, definition.captures[0])).toThrow(/crop/i);
    expect(() => validateRendererRasterizationObservation(definition, observation, "error-found@1440x960-classic")).toThrow(/does not permit capture/i);
    expect(() => validateFrameworkExtensionDefinitions({ regions: [{ ...definition, pixels: definition.pixels.map((pixel, index) => index ? pixel : { ...pixel, x: 4 }) }] })).toThrow(/exact pixel/i);
    expect(accessibilityOmissionSelectors([{ kind: "renderer-rasterization", id: definition.id, observation, expected: observation, pixels: definition.pixels }], "trigger")).toEqual([]);
  });

  test("locks the exact approved Classic5 and Light3 renderer extensions", () => {
    const original = rendererDefinition();
    const classic = rendererExtensionDefinition("classic");
    const light = rendererExtensionDefinition("light");
    const manifest = (regions = [original, classic, light]) => ({ regions });

    expect(() => validateFrameworkExtensionDefinitions(manifest())).not.toThrow();
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, { ...classic, captures: classic.captures.slice(1) }, light]))).toThrow(/metadata|capture/i);
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, { ...classic, captures: [...classic.captures].reverse() }, light]))).toThrow(/metadata|capture/i);
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, { ...classic, pixels: classic.pixels.slice(1) }, light]))).toThrow(/pixel/i);
    expect(classic.alternatives).toHaveLength(1);
    expect(classic.alternatives![0].captures).toEqual(classic.captures);
    expect(rendererRasterizationAlternativesForCapture(classic, classic.captures[0])).toHaveLength(1);
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, { ...classic, alternatives: [{ ...classic.alternatives![0], captures: classic.captures.slice(1) }] }, light]))).toThrow(/alternative|metadata/i);
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, classic, { ...light, pixels: [...light.pixels].reverse() }]))).toThrow(/pixel/i);
    expect(light.alternatives).toHaveLength(2);
    expect(light.alternatives![1].captures).toEqual(light.captures);
    expect(rendererRasterizationAlternativesForCapture(light, light.captures[0])).toHaveLength(2);
    expect(rendererRasterizationAlternativesForCapture(light, light.captures[1])).toHaveLength(2);
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, classic, { ...light, alternatives: [{ ...light.alternatives![0], pixels: light.alternatives![0].pixels.slice(1) }] }]))).toThrow(/pixel|metadata|alternative/i);
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, classic, { ...light, alternatives: [{ ...light.alternatives![0], triggerCropSha256: "f".repeat(64) }] }]))).toThrow(/alternative|metadata/i);
    expect(() => validateFrameworkExtensionDefinitions(manifest([original, classic, { ...light, measurements: { ...light.measurements, "errors-stack-expansion@1440x960-light": light.measurements[light.captures[0]] } },]))).toThrow(/measurement/i);

    const capture = light.captures[0];
    const fullObservation = { presentation: light.presentation, ...light.measurements[capture] };
    const rightObservation = { ...fullObservation, trigger: { ...fullObservation.trigger, cropSha256: light.alternatives![0].triggerCropSha256 } };
    const zeroObservation = { ...fullObservation, trigger: { ...fullObservation.trigger, cropSha256: fullObservation.skyline.cropSha256 } };
    expect(validateRendererRasterizationObservation(light, fullObservation, capture)).toBe(fullObservation);
    expect(validateRendererRasterizationObservation(light, rightObservation, capture)).toBe(rightObservation);
    const leftObservation = { ...fullObservation, trigger: { ...fullObservation.trigger, cropSha256: light.alternatives![1].triggerCropSha256 } };
    expect(validateRendererRasterizationObservation(light, leftObservation, capture)).toBe(leftObservation);
    expect(validateRendererRasterizationObservation(light, leftObservation, light.captures[1])).toBe(leftObservation);
    expect(validateRendererRasterizationObservation(light, zeroObservation, capture)).toBe(zeroObservation);
    expect(() => validateRendererRasterizationObservation(light, { ...rightObservation, trigger: { ...rightObservation.trigger, cropSha256: "0".repeat(64) } }, capture)).toThrow(/crop/i);

    const classicAlternativeCapture = classic.alternatives![0].captures[0];
    const classicFull = { presentation: classic.presentation, ...classic.measurements[classicAlternativeCapture] };
    const classicLeft = { ...classicFull, trigger: { ...classicFull.trigger, cropSha256: classic.alternatives![0].triggerCropSha256 } };
    expect(validateRendererRasterizationObservation(classic, classicLeft, classicAlternativeCapture)).toBe(classicLeft);
    const otherClassicCapture = classic.captures[0];
    const otherClassicLeft = { presentation: classic.presentation, ...classic.measurements[otherClassicCapture], trigger: { ...classic.measurements[otherClassicCapture].trigger, cropSha256: classic.alternatives![0].triggerCropSha256 } };
    expect(validateRendererRasterizationObservation(classic, otherClassicLeft, otherClassicCapture)).toBe(otherClassicLeft);
    expect(() => validateRendererRasterizationObservation(classic, { ...otherClassicLeft, trigger: { ...otherClassicLeft.trigger, cropSha256: "0".repeat(64) } }, otherClassicCapture)).toThrow(/crop/i);
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

  test("rejects capability discovery outside its configured captures", async () => {
    await expect(discoverCapabilityOmissionObservation({} as Page, {} as Page, capabilityDefinition(), "unknown@390x844-classic")).rejects.toThrow(/does not permit capture/i);
  });

  test("locks protected reflow evidence including element screenshots", () => {
    const region = capabilityDefinition();
    region.selectorPairs[0] = { ...region.selectorPairs[0], skylineBoundary: true };
    region.protectedSelectors = [skylineProtectedSelector("search", "[data-protected='search']", { allowRightOfViewport: { width: 390, height: 844 } })];
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
    expect(() => validateCapabilityOmissionObservation(region, { ...observed, protectedSelectors: [{ ...observed.protectedSelectors[0], allowRightOfViewport: undefined }] }, region.captures[0])).toThrow(/allowRightOfViewport/i);
    expect(() => validateCapabilityOmissionObservation(region, { ...observed, protectedSelectors: [{ ...observed.protectedSelectors[0], crop: { status: "visible", rect: { x: 4, y: 5, width: 20, height: 24 }, screenshotSha256: "2".repeat(64) } }] }, region.captures[0])).toThrow(/crop/i);
    expect(() => validateCapabilityOmissionObservation(region, { ...observed, protectedSelectors: [{ ...observed.protectedSelectors[0], accessibilitySha256: "2".repeat(64) }] }, region.captures[0])).toThrow(/accessibilitySha256/i);
    expect(() => applicableCapabilityOmissions(region.captures[0], { regions: [{ ...region, protectedSelectors: [{ ...region.protectedSelectors![0], selector: region.selectorPairs[0].skylineSelector }] }] })).toThrow(/selector ownership/i);
  });

  test("locks branding identity reflow while protecting supported navigation pixels", () => {
    const element = (rect: { x: number; y: number; width: number; height: number }, screenshotSha256: string) => ({
      rect,
      computedStyleSha256: "a".repeat(64),
      accessibilitySha256: "b".repeat(64),
      crop: { status: "visible" as const, rect, screenshotSha256 },
    });
    const pair = { id: "application", triggerSelector: "[data-trigger-identity]", skylineSelector: "[data-skyline-identity]" };
    const protectedPair = { id: "tasks", triggerSelector: "[data-trigger-task]", skylineSelector: "[data-skyline-task]" };
    const observation: BrandingIdentityObservation = {
      identityPairs: [{ ...pair, trigger: element({ x: 0, y: 0, width: 2, height: 2 }, "c".repeat(64)), skyline: element({ x: 0, y: 0, width: 2, height: 1 }, "d".repeat(64)) }],
      navigation: { triggerSelector: "[data-trigger-nav]", skylineSelector: "[data-skyline-nav]", trigger: element({ x: 0, y: 3, width: 2, height: 2 }, "e".repeat(64)), skyline: element({ x: 0, y: 2, width: 2, height: 2 }, "f".repeat(64)) },
      protectedPairs: [{ ...protectedPair, trigger: element({ x: 0, y: 3, width: 1, height: 1 }, "1".repeat(64)), skyline: element({ x: 0, y: 2, width: 1, height: 1 }, "1".repeat(64)) }],
    };
    const measurement = {
      identityPairs: { application: { trigger: observation.identityPairs[0].trigger, skyline: observation.identityPairs[0].skyline } },
      navigation: { trigger: observation.navigation.trigger, skyline: observation.navigation.skyline },
      protectedPairs: { tasks: { trigger: observation.protectedPairs[0].trigger, skyline: observation.protectedPairs[0].skyline } },
    };
    const definition: BrandingIdentityDefinition = {
      id: "shell-branding-identity",
      category: "branding-identity",
      decision: "NW-226",
      acceptance: ["one Application"],
      citations: ["source"],
      captures: ["error-found@1024x768-classic"],
      identityPairs: [pair],
      triggerNavigationSelector: observation.navigation.triggerSelector,
      skylineNavigationSelector: observation.navigation.skylineSelector,
      protectedPairs: [protectedPair],
      measurements: { "error-found@1024x768-classic": measurement },
    };

    expect(validateBrandingIdentityObservation(definition, observation, definition.captures[0])).toBe(observation);
    const validateRecorded = (changed: BrandingIdentityObservation) => validateBrandingIdentityObservation({
      ...definition,
      measurements: { [definition.captures[0]]: { ...measurement, protectedPairs: { tasks: { trigger: changed.protectedPairs[0].trigger, skyline: changed.protectedPairs[0].skyline } } } },
    }, changed, definition.captures[0]);
    const changedProtected = (skyline: BrandingIdentityObservation["protectedPairs"][number]["skyline"]): BrandingIdentityObservation => ({
      ...observation,
      protectedPairs: [{ ...observation.protectedPairs[0], skyline }],
    });
    expect(() => validateRecorded(changedProtected({ ...observation.protectedPairs[0].skyline, computedStyleSha256: "c".repeat(64) }))).toThrow(/protected.*style/i);
    expect(() => validateRecorded(changedProtected({ ...observation.protectedPairs[0].skyline, accessibilitySha256: "c".repeat(64) }))).toThrow(/protected.*accessibility/i);
    expect(() => validateRecorded(changedProtected({ ...observation.protectedPairs[0].skyline, rect: { x: 0, y: 1, width: 1, height: 1 }, crop: { ...observation.protectedPairs[0].skyline.crop, rect: { x: 0, y: 1, width: 1, height: 1 } } }))).toThrow(/protected.*reflow/i);
    expect(() => validateBrandingIdentityObservation(definition, { ...observation, navigation: { ...observation.navigation, trigger: { ...observation.navigation.trigger, rect: { ...observation.navigation.trigger.rect, y: 4 } } } }, definition.captures[0])).toThrow(/navigation evidence|reflow/i);
    expect(accessibilityOmissionSelectors([{ kind: "branding-identity", id: definition.id, ...observation, expected: measurement }], "trigger")).toEqual([pair.triggerSelector]);
    expect(accessibilityOmissionSelectors([{ kind: "branding-identity", id: definition.id, ...observation, expected: measurement }], "skyline")).toEqual([pair.skylineSelector]);
  });

  test("protected screenshot fingerprints catch painted color and icon drift", () => {
    const screenshot = (changed: boolean) => {
      const png = new PNG({ width: 2, height: 2 });
      png.data.fill(255);
      if (changed) png.data.set([0, 0, 0, 255], 0);
      return PNG.sync.write(png);
    };
    const rect = { x: 0, y: 0, width: 1, height: 1 };
    const mobileViewport = { width: 390, height: 844 } as const;
    const mobileRightPolicy = { allowRightOfViewport: mobileViewport } as const;
    const classicCapture = "job-found@390x844-classic";
    const contextFor = (capture: string) => ({ capture, permittedCaptures: [capture] });

    expect(captureProtectedElementCrop(screenshot(false), { width: 2, height: 2 }, rect))
      .not.toEqual(captureProtectedElementCrop(screenshot(true), { width: 2, height: 2 }, rect));
    expect(() => captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 0, y: 3, width: 1, height: 1 })).toThrow(/below the viewport/i);
    expect(captureProtectedElementCrop(undefined, { width: 2, height: 2 }, { x: 0, y: 3, width: 1, height: 1 }, { allowBelowViewport: true })).toEqual({ status: "below-viewport" });
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 0, width: 1, height: 1 }, { allowBelowViewport: true })).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 0, width: 1, height: 1 }, mobileRightPolicy)).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 0, width: 1, height: 1 }, mobileRightPolicy, contextFor("job-found"))).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 0, width: 1, height: 1 }, mobileRightPolicy, contextFor("job-found@390x844-dark"))).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 0, width: 1, height: 1 }, mobileRightPolicy, contextFor("job-found@390x844-system"))).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 0, width: 1, height: 1 }, mobileRightPolicy, { capture: "unknown@390x844-classic", permittedCaptures: [classicCapture] })).toThrow(/outside the viewport/i);
    expect(captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 0, width: 1, height: 1 }, mobileRightPolicy, contextFor(classicCapture))).toEqual({ status: "right-of-viewport" });
    expect(() => captureProtectedElementCrop(undefined, { width: 390, height: 960 }, { x: 391, y: 0, width: 1, height: 1 }, mobileRightPolicy, contextFor("job-found@390x960-classic"))).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, { width: 1024, height: 844 }, { x: 1025, y: 0, width: 1, height: 1 }, mobileRightPolicy, contextFor("job-found@1024x844-classic"))).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, { width: 1440, height: 960 }, { x: 1441, y: 0, width: 1, height: 1 }, mobileRightPolicy, contextFor("job-found@1440x960-classic"))).toThrow(/outside the viewport/i);
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 845, width: 1, height: 1 }, mobileRightPolicy, contextFor(classicCapture))).toThrow(/below the viewport/i);
    expect(captureProtectedElementCrop(undefined, mobileViewport, { x: 391, y: 845, width: 1, height: 1 }, { allowBelowViewport: true, ...mobileRightPolicy }, contextFor(classicCapture))).toEqual({ status: "right-of-viewport" });
    expect(() => captureProtectedElementCrop(undefined, mobileViewport, { x: -3, y: 0, width: 1, height: 1 }, { allowBelowViewport: true, ...mobileRightPolicy })).toThrow(/outside the viewport/i);
  });

  test("builds Skyline protected selectors with named viewport policy", () => {
    expect(skylineProtectedSelector("activity", "[data-skyline-protected='activity']", { allowBelowViewport: true, allowRightOfViewport: { width: 390, height: 844 } })).toEqual({
      id: "activity",
      application: "skyline",
      selector: "[data-skyline-protected='activity']",
      allowBelowViewport: true,
      allowRightOfViewport: { width: 390, height: 844 },
    });
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

function rendererDefinition(): RendererRasterizationDefinition {
  const capture = "error-found@1024x768-classic";
  const rect = { x: 656, y: 117, width: 356, height: 58 };
  const shared = {
    selector: ".text-text-dimmed > [translate='no']",
    rect,
    computedStyleSha256: "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b",
    accessibilitySha256: "b6167fd697fd410afc0259efd4e09027849b730af8f4af8af77591758aac8d6b",
    semanticDomSha256: "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2",
    effectiveCssRulesSha256: "eeedce158bc50c514818266694318ab8eae3d60904294b427103c5bbff3eb901",
    boxModelSha256: "206a05c0a410e6f813bf12948198abbb381269566b3f0e98b3d822e5cc599f83",
    quadsSha256: "260e3e345b11618f2b4d6214d5941be3b01ae92dd3596e1efe87db8d707fafd7",
    backdropSha256: "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9",
  };
  return {
    id: "error-codeblock-corner-rasterization",
    category: "renderer-rasterization",
    decision: "NW-216",
    acceptance: ["Only the six exact pinned Chromium antialias samples may differ; every other pixel and semantic must remain exact."],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-af981c01",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-5f779354",
    ],
    captures: [capture],
    triggerSelector: shared.selector,
    skylineSelector: shared.selector,
    environment: { chromiumRevision: "1208", chromiumVersion: "145.0.7632.6", architecture: "x64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" },
    presentation: { borderColor: "rgb(39, 42, 46)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(26, 27, 31)", borderRadius: "6px" },
    pixels: [
      { x: 3, y: 0, trigger: [29, 30, 35, 255], skyline: [29, 31, 35, 255] },
      { x: 5, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
      { x: 3, y: 1, trigger: [33, 34, 38, 255], skyline: [33, 35, 39, 255] },
      { x: 4, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
      { x: 5, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
      { x: 2, y: 2, trigger: [31, 33, 37, 255], skyline: [31, 34, 38, 255] },
    ],
    measurements: {
      [capture]: {
        runtime: { browserVersion: "145.0.7632.6", platform: "Linux x86_64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" },
        trigger: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "8d795f3af25b11056ed60507ccd2c8614e8cc4d469515688018b5b0f9dab47ba", cropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50" },
        skyline: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "751946618b4985c6a59b86417e539771259f74e794c7e5ad67377c495f9202a4", cropSha256: "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a" },
      },
    },
  };
}

function rendererExtensionDefinition(theme: "classic" | "light"): RendererRasterizationDefinition {
  const base = rendererDefinition();
  const classic = theme === "classic";
  const captures = classic
    ? ["error-found@1440x960-classic", "errors-affected-job-types@1440x960-classic", "errors-application-vendor-frames@1440x960-classic", "errors-long-exception@1440x960-classic", "errors-stack-expansion@1440x960-classic"]
    : ["error-found@1440x960-light", "error-found@1440x960-system-light", "errors-affected-job-types@1440x960-light"];
  const triggerBase = base.measurements[base.captures[0]].trigger;
  const shared = {
    ...triggerBase,
    rect: { x: 1072, y: 117, width: 356, height: 58 },
    computedStyleSha256: classic ? triggerBase.computedStyleSha256 : "6a8b83d2e8057045b6e96b0dac9fb7e569da5335379ed5a76f0f0ab01c569939",
    semanticDomSha256: classic ? triggerBase.semanticDomSha256 : "ddeafe10e6831ec6dc1e62eab62f16fe3dfe68937cddcbb42c2fa96562d13096",
    boxModelSha256: "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486",
    quadsSha256: "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f",
    backdropSha256: classic ? triggerBase.backdropSha256 : "ca33753c04b4519449c72aa01b71b3f6b8b2050a5c57ead95a3f5920d45460de",
  };
  const measurement = {
    runtime: base.measurements[base.captures[0]].runtime,
    trigger: { ...shared, cropSha256: classic ? "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6" : "93768ec0233ea8b02028b19b7743d1d263219666ef23354eb3407f4c68759fa3" },
    skyline: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "751946618b4985c6a59b86417e539771259f74e794c7e5ad67377c495f9202a4", cropSha256: classic ? "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a" : "a73802a7d3ac38e35d1bcd5119025c1818cae3d5dc9fdeafa69253aaa43332a8" },
  };
  const pixels = (classic ? [
    { x: 3, y: 0, trigger: [29, 30, 35, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 350, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 352, y: 0, trigger: [29, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 3, y: 1, trigger: [33, 34, 38, 255], skyline: [33, 35, 39, 255] },
    { x: 4, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 350, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 351, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 353, y: 1, trigger: [33, 34, 39, 255], skyline: [33, 35, 39, 255] },
    { x: 2, y: 2, trigger: [31, 33, 37, 255], skyline: [31, 34, 38, 255] },
    { x: 353, y: 2, trigger: [32, 33, 38, 255], skyline: [32, 34, 38, 255] },
  ] : [
    { x: 3, y: 0, trigger: [227, 227, 229, 255], skyline: [226, 227, 228, 255] },
    { x: 4, y: 0, trigger: [197, 198, 201, 255], skyline: [196, 198, 201, 255] },
    { x: 352, y: 0, trigger: [228, 229, 230, 255], skyline: [227, 228, 229, 255] },
    { x: 2, y: 1, trigger: [208, 209, 211, 255], skyline: [207, 208, 211, 255] },
    { x: 3, y: 1, trigger: [207, 208, 211, 255], skyline: [207, 208, 210, 255] },
    { x: 4, y: 1, trigger: [233, 234, 235, 255], skyline: [233, 233, 234, 255] },
    { x: 5, y: 1, trigger: [248, 248, 248, 255], skyline: [247, 247, 248, 255] },
    { x: 350, y: 1, trigger: [248, 248, 248, 255], skyline: [247, 247, 248, 255] },
    { x: 351, y: 1, trigger: [233, 233, 234, 255], skyline: [232, 233, 234, 255] },
    { x: 352, y: 1, trigger: [206, 207, 210, 255], skyline: [206, 207, 209, 255] },
    { x: 353, y: 1, trigger: [209, 210, 213, 255], skyline: [209, 210, 212, 255] },
    { x: 2, y: 2, trigger: [214, 215, 217, 255], skyline: [214, 214, 217, 255] },
    { x: 353, y: 2, trigger: [213, 214, 216, 255], skyline: [212, 214, 216, 255] },
  ]) as RendererRasterizationDefinition["pixels"];
  const rightPixels = classic ? [] : [pixels[2], pixels[7], pixels[8], pixels[9], pixels[10], pixels[12]];
  const classicAlternativeCaptures = captures;
  return {
    ...base,
    id: `error-codeblock-${theme}-rasterization`,
    acceptance: [classic
      ? "Only the exact pinned Chromium Classic full twelve-pixel or left-edge six-pixel antialias state may differ across the five approved captures; zero activates no exception and every other pixel and semantic must remain exact."
      : "Only the exact pinned Chromium Light full thirteen-pixel, right-edge six-pixel, or left-edge seven-pixel antialias state may differ across the three approved captures; zero activates no exception and every other pixel and semantic must remain exact."],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6938d6dc",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-9cebc0a5",
      ...classic ? [
        "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-4d0553c1",
        "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-299d4a96",
        "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
        "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
      ] : [
        "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6b20c68e",
        "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-86de4313",
        "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
        "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
        "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-27e039b2",
        "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-721d1ae5",
      ],
    ],
    captures,
    presentation: classic ? base.presentation : { borderColor: "color(srgb 0.687749 0.693835 0.709051)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(255, 255, 255)", borderRadius: "6px" },
    pixels,
    measurements: Object.fromEntries(captures.map((capture) => [capture, structuredClone(measurement)])),
    alternatives: classic
      ? [{ captures: classicAlternativeCaptures, pixels: pixels.slice(0, 2).concat(pixels.slice(4, 7), pixels.slice(10, 11)), triggerCropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50" }]
      : [
        { captures, pixels: rightPixels, triggerCropSha256: "be64f3b53c93b4cc7145fb081f717e2b75becf66632a727985b68a57f3537864" },
        { captures, pixels: [pixels[0], pixels[1], pixels[3], pixels[4], pixels[5], pixels[6], pixels[11]], triggerCropSha256: "f5bba6c913b6a01d71f7926ac77447c974b40961a3ac51fb9f27bc979d95f1b5" },
      ],
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
