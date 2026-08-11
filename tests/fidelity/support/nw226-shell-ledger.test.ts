import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import manifest from "../allowed-differences.json" with { type: "json" };
import matrix from "../matrix.json" with { type: "json" };
import { validateFrameworkExtensionDefinitions, type AllowedDifferences, type FrameworkExtensionDefinition } from "./difference-regions";
import { nw226ShellExtensionDefinitions } from "./nw226-shell-extensions";

const hash = /^[a-f0-9]{64}$/;

describe("NW-226 exact shell ledger", () => {
  const expected = nw226ShellExtensionDefinitions(matrix as unknown as FidelityMatrix);
  const captures = expected[0].captures;
  const regions = manifest.regions.filter(({ id }) => id.startsWith("shell-")) as unknown as FrameworkExtensionDefinition[];

  test("owns exactly five controls across 38 Queue captures", () => {
    expect(() => validateFrameworkExtensionDefinitions(manifest as unknown as AllowedDifferences)).not.toThrow();
    expect(captures).toHaveLength(38);
    expect(regions.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    for (const definition of expected) {
      const region = regions.find(({ id }) => id === definition.id)!;
      expect({ ...region, measurements: {} }).toEqual(definition);
      expect(Object.keys(region.measurements).sort()).toEqual(captures);
    }
    expect(JSON.stringify(regions)).not.toMatch(/\*|sentinel|null/i);
  });

  test("locks all 190 geometry, style, and full accessibility observations", () => {
    expect(regions.reduce((total, region) => total + Object.keys(region.measurements).length, 0)).toBe(190);
    for (const region of regions) for (const measurement of Object.values(region.measurements)) {
      expect(Object.keys(measurement).sort()).toEqual([
        "accessibilitySha256",
        "anchorComputedStyleSha256",
        "anchorRect",
        "computedStyleSha256",
        "relativeRect",
      ]);
      for (const key of ["computedStyleSha256", "accessibilitySha256", "anchorComputedStyleSha256"] as const) expect(measurement[key]).toMatch(hash);
      for (const rect of [measurement.relativeRect, measurement.anchorRect]) {
        expect(Object.keys(rect).sort()).toEqual(["height", "width", "x", "y"]);
        expect(Object.values(rect).every(Number.isFinite)).toBe(true);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
      }
    }
  });

  test("pins the reviewed shell ledger", () => {
    expect(createHash("sha256").update(JSON.stringify(regions)).digest("hex"))
      .toBe("6a8c16208ce882da468e42c75c25666b0453d2e74afb401bd0a3692de5eaa700");
  });
});
