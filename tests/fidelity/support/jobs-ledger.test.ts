import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import manifest from "../allowed-differences.json" with { type: "json" };
import matrix from "../matrix.json" with { type: "json" };
import { validateFrameworkExtensionDefinitions, type AllowedDifferences, type CapabilityOmissionDefinition } from "./difference-regions";
import { jobsCapabilityDefinitions } from "./jobs-capabilities";

describe("NW-219 exact Jobs ledger", () => {
  const expected = jobsCapabilityDefinitions(matrix as unknown as FidelityMatrix);
  const regions = manifest.regions.filter(({ decision }) => decision === "NW-219") as unknown as CapabilityOmissionDefinition[];

  test("owns exactly the measured definitions, captures, and boundaries", () => {
    expect(() => validateFrameworkExtensionDefinitions(manifest as unknown as AllowedDifferences)).not.toThrow();
    expect(regions.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    for (const definition of expected) {
      const region = regions.find(({ id }) => id === definition.id)!;
      expect({ ...region, measurements: {}, protectedMeasurements: {} }).toEqual(definition);
      expect(Object.keys(region.measurements).sort()).toEqual([...definition.captures].sort());
      expect(Object.keys(region.protectedMeasurements ?? {}).sort()).toEqual([...definition.captures].sort());
      for (const measurement of Object.values(region.measurements)) {
        expect(Object.keys(measurement).sort()).toEqual(definition.selectorPairs.map(({ id }) => id).sort());
      }
      for (const measurement of Object.values(region.protectedMeasurements ?? {})) {
        expect(Object.keys(measurement)).toEqual(definition.protectedSelectors?.map(({ id }) => id));
        for (const evidence of Object.values(measurement)) {
          expect(Object.keys(evidence).sort()).toEqual(["accessibilitySha256", "computedStyleSha256", "crop", "rect"]);
          expect(evidence.computedStyleSha256).toMatch(/^[a-f0-9]{64}$/);
          expect(evidence.accessibilitySha256).toMatch(/^[a-f0-9]{64}$/);
          expect(evidence.rect.width).toBeGreaterThan(0);
          expect(evidence.rect.height).toBeGreaterThan(0);
          if (evidence.crop.status === "visible") {
            expect(Object.keys(evidence.crop).sort()).toEqual(["rect", "screenshotSha256", "status"]);
            expect(evidence.crop.screenshotSha256).toMatch(/^[a-f0-9]{64}$/);
          } else expect(Object.keys(evidence.crop)).toEqual(["status"]);
        }
      }
    }
  });

  test("pins all 905 omissions and 1,753 protected observations", () => {
    expect(regions.reduce((total, region) => total + Object.values(region.measurements).reduce((count, measurement) => count + Object.keys(measurement).length, 0), 0)).toBe(905);
    expect(regions.reduce((total, region) => total + Object.values(region.protectedMeasurements ?? {}).reduce((count, measurement) => count + Object.keys(measurement).length, 0), 0)).toBe(1_753);
    expect(createHash("sha256").update(JSON.stringify(regions)).digest("hex"))
      .toBe("081c9cbfb518baef84a8aad8003def10ff94db800abeaa47536d2bda2bb40c9d");
  });
});
