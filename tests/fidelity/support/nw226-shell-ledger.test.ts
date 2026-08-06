import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import manifest from "../allowed-differences.json" with { type: "json" };
import matrix from "../matrix.json" with { type: "json" };
import { validateFrameworkExtensionDefinitions, type AllowedDifferences, type FrameworkExtensionDefinition } from "./difference-regions";

const hash = /^[a-f0-9]{64}$/;
const generic = ["1024x768-classic", "1440x960-classic", "1440x960-dark", "1440x960-light", "1440x960-system-dark", "1440x960-system-light", "390x844-classic"];
const primary = ["1440x960-classic", "1440x960-dark", "1440x960-light"];
const expected = [
  ["shell-observability-header", "[data-skyline-extension='shell-observability-header']", "button", "Observability"],
  ["shell-logs-navigation", "[data-skyline-extension='shell-logs-navigation']", "link", "Logs"],
  ["shell-errors-navigation", "[data-skyline-extension='shell-errors-navigation']", "link", "Errors"],
  ["shell-queues-navigation", "[data-skyline-extension='shell-queues-navigation']", "link", "Queues"],
  ["shell-appearance", "[data-skyline-extension='shell-appearance']", "button", "Appearance"],
] as const;

describe("NW-226 exact shell ledger", () => {
  const captures = [
    ...generic.map((variant) => `queue-found@${variant}`),
    ...generic.map((variant) => `queues-populated@${variant}`),
    ...["activity-wait-history", "busy", "filtering", "hidden-controls", "idle", "long-labels", "multiple-targets", "paginated-runs"]
      .flatMap((state) => primary.map((variant) => `queues-${state}@${variant}`)),
  ].sort();
  const matrixCaptures = expectedCaptureIds(matrix as unknown as FidelityMatrix);
  const regions = manifest.regions.filter(({ id }) => id.startsWith("shell-")) as unknown as FrameworkExtensionDefinition[];

  test("owns exactly five controls across 38 Queue captures", () => {
    expect(() => validateFrameworkExtensionDefinitions(manifest as unknown as AllowedDifferences)).not.toThrow();
    expect(captures).toHaveLength(38);
    expect(captures.every((capture) => matrixCaptures.includes(capture))).toBe(true);
    expect(regions.map(({ id }) => id)).toEqual(expected.map(([id]) => id));
    for (const [id, skylineSelector, accessibleRole, accessibleName] of expected) {
      const region = regions.find((candidate) => candidate.id === id)!;
      expect(region).toMatchObject({
        category: "framework-extension",
        decision: "NW-226",
        captures,
        skylineSelector,
        triggerAnchorSelector: "[data-action='tasks']",
        skylineAnchorSelector: "[data-action='tasks']",
        accessibleRole,
        accessibleName,
        anchorAccessibleRole: "link",
        anchorAccessibleName: "Tasks",
      });
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
      .toBe("fee0c3caa620a441a8b9f50d10520c699ae323f4e94a2c5ddde414bfa2da29f4");
  });
});
