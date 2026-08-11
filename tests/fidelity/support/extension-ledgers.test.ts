import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import manifest from "../allowed-differences.json" with { type: "json" };
import { validateFrameworkExtensionDefinitions, type AllowedDifferences } from "./difference-regions";

const hash = /^[a-f0-9]{64}$/;

describe("exact NW-222 and NW-224 ledgers", () => {
  test("pins 12 presenter captures by exact region membership", () => {
    const regions = manifest.regions.filter(({ decision }) => decision === "NW-222");
    expect(regions.map(({ id }) => id)).toEqual(["attempt-exception-evidence", "attempt-exception-dialog"]);
    expect(regions.map(({ captures }) => captures.length)).toEqual([9, 3]);
    expect(new Set(regions.flatMap(({ captures }) => captures)).size).toBe(12);
    for (const region of regions) {
      expect(Object.keys(region.measurements)).toEqual(region.captures);
      for (const measurement of Object.values(region.measurements)) assertPresenterMeasurement(measurement);
    }
    expect(createHash("sha256").update(JSON.stringify(regions)).digest("hex"))
      .toBe("ecd0247b6752013065d81fea2a69617d438e21831acd51af41d69a51f630b163");
  });

  test("pins all 28 PHP exception captures", () => {
    expect(() => validateFrameworkExtensionDefinitions(manifest as unknown as AllowedDifferences)).not.toThrow();
    const regions = manifest.regions.filter(({ decision }) => decision === "NW-224");
    expect(regions).toHaveLength(1);
    const [region] = regions;
    expect(region.id).toBe("php-exception-evidence");
    expect(region.captures).toHaveLength(28);
    expect(Object.keys(region.measurements)).toEqual(region.captures);
    for (const measurement of Object.values(region.measurements)) {
      expect(Object.keys(measurement).sort()).toEqual(["anchorComputedStyleSha256", "anchorRect", "computedStyleSha256", "relativeRect"]);
      expect(measurement.computedStyleSha256).toMatch(hash);
      expect(measurement.anchorComputedStyleSha256).toMatch(hash);
    }
    expect(createHash("sha256").update(JSON.stringify(regions)).digest("hex"))
      .toBe("930248412678ea5334145c9adf0205382dda72603132272179ecb23b44f2d768");
  });
});

function assertPresenterMeasurement(measurement: Record<string, unknown>) {
  expect(Object.keys(measurement).sort()).toEqual([
    "anchorAccessibilitySha256", "anchorAccessibleName", "anchorComputedStyleSha256", "anchorRect",
    "skylineAccessibilitySha256", "skylineComputedStyleSha256", "skylineRelativeRect",
    "triggerAccessibilitySha256", "triggerComputedStyleSha256", "triggerRelativeRect",
  ]);
  for (const key of [
    "anchorAccessibilitySha256", "anchorComputedStyleSha256", "skylineAccessibilitySha256",
    "skylineComputedStyleSha256", "triggerAccessibilitySha256", "triggerComputedStyleSha256",
  ]) expect(measurement[key]).toMatch(hash);
}
