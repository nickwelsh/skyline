import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { expectedCaptureIds, recordFidelityBundle, validateAllowedDifferences } from "../../../scripts/fidelity-oracle.mjs";

const root = resolve(import.meta.dirname, "../../..");
describe("source-fidelity oracle", () => {
  test("the acceptance matrix expands every required capture", () => {
    const matrix = JSON.parse(readFileSync(join(root, "tests/fidelity/matrix.json"), "utf8"));
    const captures = expectedCaptureIds(matrix);

    expect(captures).toHaveLength(385);
    expect(captures).toContain("runs-loading@1440x960-classic");
    expect(captures).toContain("run-stale-refresh@1440x960-dark");
    expect(captures).toContain("shell-customized@390x844-classic");
    expect(captures).toContain("log-found@1440x960-system-light");
    expect(captures).toContain("shell-live-change@1440x960-system-dark");
    expect(captures).toContain("runs-exception-unavailable@1440x960-dark");
  });

  test("allowed differences require a narrow accepted category and selectors", () => {
    expect(() => validateAllowedDifferences({
      decision: "NW-216",
      categories: ["visual-tolerance"],
      regions: [],
    })).toThrow(/unclassified/i);
  });

  test("framework extensions require an exact fail-closed ledger entry", () => {
    const region = {
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
    const queueRegion = {
      ...region,
      id: "queue-recorded-runs",
      decision: "NW-221",
      acceptance: "Detail adds queue-time/activity series and cursor-paginated filtered Runs.",
      captures: ["queue-found@1440x960-classic"],
      skylineSelector: "[data-skyline-extension='queue-recorded-runs']",
      triggerAnchorSelector: ".queue-heading",
      skylineAnchorSelector: ".queue-heading",
      accessibleName: "Recorded runs",
      anchorAccessibleName: "default",
      measurements: {
        "queue-found@1440x960-classic": region.measurements["error-found@1440x960-classic"],
      },
    };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region, queueRegion] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region, { ...queueRegion, captures: region.captures, measurements: region.measurements }] })).toThrow(/overlap/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region, { ...queueRegion, triggerAnchorSelector: region.skylineSelector }] })).toThrow(/selector/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [{ ...region, captures: ["error-found@1440x960-dark"] }] })).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [{ ...region, acceptance: "" }] })).toThrow(/incomplete/i);
  });

  test("the runner applies allowed pixels and AX omissions instead of raw empty masks", () => {
    const runner = readFileSync(join(root, "tests/fidelity/fidelity.spec.ts"), "utf8");
    expect(runner).toContain("observeDifferenceRegions(reference, page, capture");
    expect(runner).toContain("omitFrameworkExtensionAccessibility(rawSkylineTree, capture");
    expect(runner).toContain("measurePixels(triggerPng, skylinePng, regions)");
    expect(runner).not.toContain("measurePixels(triggerPng, skylinePng, [])");
  });

  test("measurement discovery is read-only and uses the strict paired observer", () => {
    const discovery = readFileSync(join(root, "tests/fidelity/framework-extension.discovery.ts"), "utf8");
    expect(discovery).toContain("discoverFrameworkExtensionObservation(trigger, skyline, definition)");
    expect(discovery).toContain("expect(captures).toHaveLength(28)");
    expect(discovery).not.toContain("writeFile");
  });

  test("regeneration requires an accepted decision reference", () => {
    expect(() => recordFidelityBundle(root, "refresh screenshots")).toThrow(/requires --decision NW-/i);
  });
});
