import { describe, expect, test } from "vitest";
import {
  applicableFrameworkExtensions,
  applicablePresenterExtensions,
  accessibilityOmissionSelectors,
  fingerprintComputedStyle,
  omitFrameworkExtensionAccessibility,
  requireSingleMatch,
  validateFrameworkExtensionObservation,
  validatePairedAnchor,
  validatePresenterExtensionObservation,
  type FrameworkExtensionDefinition,
  type PresenterExtensionDefinition,
} from "./difference-regions";

describe("framework-extension fidelity regions", () => {
  test("requires the exact selector, anchor-relative geometry, style, and accessible identity", () => {
    const expected = definition();
    const observed = {
      skylineSelector: expected.skylineSelector,
      triggerAnchorSelector: expected.triggerAnchorSelector,
      skylineAnchorSelector: expected.skylineAnchorSelector,
      accessibleRole: expected.accessibleRole,
      accessibleName: expected.accessibleName,
      rect: { x: 10, y: 20, width: 30, height: 40 },
      ...expected.measurements[expected.captures[0]],
    };

    expect(validateFrameworkExtensionObservation(expected, observed, expected.captures[0])).toBe(observed);
    expect(() => validateFrameworkExtensionObservation(expected, { ...observed, relativeRect: { ...observed.relativeRect, y: 9 } }, expected.captures[0])).toThrow(/anchor-relative geometry/i);
    expect(() => validateFrameworkExtensionObservation(expected, { ...observed, computedStyleSha256: "b".repeat(64) }, expected.captures[0])).toThrow(/computedStyleSha256/i);
    expect(() => validateFrameworkExtensionObservation(expected, { ...observed, accessibleName: "Changed" }, expected.captures[0])).toThrow(/accessibleName/i);
    expect(() => validateFrameworkExtensionObservation(expected, observed, "error-found@1440x960-dark")).toThrow(/lacks measurement/i);
  });

  test("fails on duplicate selectors or paired anchor drift", () => {
    const expected = definition();
    const measurement = expected.measurements[expected.captures[0]];
    const anchor = { rect: measurement.anchorRect, accessibleRole: "heading", accessibleName: "Details", computedStyleSha256: measurement.anchorComputedStyleSha256, accessibilitySha256: "c".repeat(64) };

    expect(() => requireSingleMatch(2, expected.id, "Skyline extension")).toThrow(/exactly one/i);
    expect(() => validatePairedAnchor(expected, anchor, { ...anchor, rect: { ...anchor.rect, x: 11 } }, expected.captures[0])).toThrow(/geometry/i);
    expect(() => validatePairedAnchor(expected, anchor, { ...anchor, computedStyleSha256: "c".repeat(64) }, expected.captures[0])).toThrow(/computed style/i);
    expect(() => validatePairedAnchor(expected, anchor, { ...anchor, accessibleName: "Changed" }, expected.captures[0])).toThrow(/accessible identity/i);
  });

  test("ignores only non-rendered custom-property inventory", () => {
    const trigger = [["--unused-trigger", "1", ""], ["color", "rgb(1, 2, 3)", ""]] as [string, string, string][];
    const skyline = [["--unused-skyline", "2", ""], ["color", "rgb(1, 2, 3)", ""]] as [string, string, string][];

    expect(fingerprintComputedStyle(trigger)).toBe(fingerprintComputedStyle(skyline));
    expect(fingerprintComputedStyle(trigger)).not.toBe(fingerprintComputedStyle([["color", "rgb(3, 2, 1)", ""]]));
  });

  test("allows multiple disjoint regions but at most one per capture", () => {
    const region = definition();
    const queue = { ...definition(), id: "queue-recorded-runs", captures: ["queue-found@1440x960-classic"], skylineSelector: "[data-skyline-extension='queue-recorded-runs']", triggerAnchorSelector: ".queue-heading", skylineAnchorSelector: ".queue-heading" };
    expect(applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [region] })).toEqual([region]);
    expect(applicableFrameworkExtensions("queue-found@1440x960-classic", { regions: [region, queue] })).toEqual([queue]);
    expect(applicableFrameworkExtensions("errors-populated@1440x960-classic", { regions: [region] })).toEqual([]);
    expect(() => applicableFrameworkExtensions("error-found@1440x960-classic", { regions: [region, { ...region, id: "duplicate" }] })).toThrow(/overlap|multiple/i);
    expect(() => applicableFrameworkExtensions("queue-found@1440x960-classic", { regions: [region, { ...queue, captures: region.captures }] })).toThrow(/overlap|multiple/i);
    expect(() => applicableFrameworkExtensions("queue-found@1440x960-classic", { regions: [region, { ...queue, skylineSelector: region.skylineSelector }] })).toThrow(/selector/i);
    expect(() => applicableFrameworkExtensions("queue-found@1440x960-classic", { regions: [region, { ...queue, triggerAnchorSelector: region.skylineSelector }] })).toThrow(/selector/i);
  });

  test("omits exactly the named extension AX subtree", () => {
    const tree = { role: "main", children: [{ role: "heading", name: "Error" }, { role: "region", name: "Exception", children: [{ role: "button", name: "Show 2 frames" }] }] };
    const manifest = { regions: [definition()] };

    expect(omitFrameworkExtensionAccessibility(tree, "error-found@1440x960-classic", manifest)).toEqual({ role: "main", children: [{ role: "heading", name: "Error" }] });
    expect(() => omitFrameworkExtensionAccessibility({ role: "main" }, "error-found@1440x960-classic", manifest)).toThrow(/omitted 0/i);
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
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, triggerComputedStyleSha256: "0".repeat(64) }, expected.captures[0])).toThrow(/triggerComputedStyleSha256/i);
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, skylineAccessibilitySha256: "0".repeat(64) }, expected.captures[0])).toThrow(/skylineAccessibilitySha256/i);
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, skylineRelativeRect: { ...observed.skylineRelativeRect, y: 99 } }, expected.captures[0])).toThrow(/Skyline anchor-relative geometry/i);
    expect(() => validatePresenterExtensionObservation(expected, { ...observed, skylineRect: { ...observed.skylineRect, height: 41 } }, expected.captures[0])).toThrow(/outer geometry/i);
  });

  test("allows one presenter extension and identifies both AX omission selectors", () => {
    const region = presenterDefinition();
    expect(applicablePresenterExtensions(region.captures[0], { regions: [region] })).toEqual([region]);
    const observed = { kind: "presenter-extension", id: region.id, presenter: {} as never, expected: { triggerSelector: region.triggerSelector, skylineSelector: region.skylineSelector } as never } as const;
    expect(accessibilityOmissionSelectors([observed], "trigger")).toEqual([region.triggerSelector]);
    expect(accessibilityOmissionSelectors([observed], "skyline")).toEqual([region.skylineSelector]);
    expect(() => applicablePresenterExtensions(region.captures[0], { regions: [region, { ...region, id: "duplicate" }] })).toThrow(/overlap|multiple/i);
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
      },
    },
  };
}
