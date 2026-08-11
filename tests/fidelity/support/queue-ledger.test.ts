import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import manifest from "../allowed-differences.json" with { type: "json" };
import matrix from "../matrix.json" with { type: "json" };
import { queueCapabilityDefinitions } from "./queue-capabilities";
import { queueConnectionExtensionDefinition } from "./queue-connection-extension";
import { queueRecordedRunsExtensionDefinition } from "./queue-recorded-runs-extension";
import type { CapabilityOmissionDefinition, CapabilityOmissionMeasurement, FrameworkExtensionDefinition } from "./difference-regions";

const hash = /^[a-f0-9]{64}$/;

describe("NW-221 exact Queue ledger", () => {
  type QueueLedgerRegion = CapabilityOmissionDefinition | FrameworkExtensionDefinition;
  const expected = [...queueCapabilityDefinitions(matrix as unknown as FidelityMatrix), queueConnectionExtensionDefinition(matrix as unknown as FidelityMatrix), queueRecordedRunsExtensionDefinition(matrix as unknown as FidelityMatrix)];
  const regions = manifest.regions.filter((region) => region.id.startsWith("queue-")) as unknown as QueueLedgerRegion[];

  test("owns exactly the measured definitions, captures, and selectors", () => {
    expect(regions.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    for (const definition of expected) {
      const region = regions.find(({ id }) => id === definition.id)!;
      expect({ ...region, measurements: {}, ...(region.category === "capability-omission" ? { protectedMeasurements: {} } : {}) }).toEqual(definition);
      expect(Object.keys(region.measurements).sort()).toEqual([...definition.captures].sort());
      expect(JSON.stringify(region)).not.toMatch(/\*|information|shell/i);
    }
  });

  test("locks exact rect, style, and per-application accessibility evidence", () => {
    for (const region of regions) for (const measurement of Object.values(region.measurements)) {
      if (region.category === "framework-extension") {
        expect(measurement.computedStyleSha256).toMatch(hash);
        expect(measurement.accessibilitySha256).toMatch(hash);
        expect(measurement.anchorComputedStyleSha256).toMatch(hash);
        continue;
      }
      expect(Object.keys(measurement).sort()).toEqual(region.selectorPairs.map(({ id }) => id).sort());
      for (const pair of Object.values(measurement) as CapabilityOmissionMeasurement[]) for (const key of ["triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256"] as const) expect(pair[key]).toMatch(hash);
    }
    for (const region of regions) if (region.category === "capability-omission") {
      expect(Object.keys(region.protectedMeasurements ?? {}).sort()).toEqual([...region.captures].sort());
      for (const measurement of Object.values(region.protectedMeasurements ?? {})) {
        expect(Object.keys(measurement)).toEqual(region.protectedSelectors?.map(({ id }) => id));
        for (const evidence of Object.values(measurement)) {
          expect(Object.keys(evidence).sort()).toEqual(["accessibilitySha256", "computedStyleSha256", "crop", "rect"]);
          expect(evidence.computedStyleSha256).toMatch(hash);
          expect(evidence.accessibilitySha256).toMatch(hash);
          expect(evidence.rect.width).toBeGreaterThan(0);
          expect(evidence.rect.height).toBeGreaterThan(0);
          if (evidence.crop.status === "visible") {
            expect(Object.keys(evidence.crop).sort()).toEqual(["rect", "screenshotSha256", "status"]);
            expect(evidence.crop.screenshotSha256).toMatch(hash);
          } else expect(Object.keys(evidence.crop)).toEqual(["status"]);
        }
      }
    }
    const connection = regions.find(({ id }) => id === "queue-connection-filter") as FrameworkExtensionDefinition;
    expect(connection.measurements["queues-filtering@1440x960-classic"]!.accessibilitySha256)
      .not.toBe(connection.measurements["queues-populated@1440x960-classic"]!.accessibilitySha256);
  });

  test("pins 76 capture records, 456 omissions, and 304 protected observations", () => {
    expect(regions.reduce((total, region) => total + Object.keys(region.measurements).length, 0)).toBe(76);
    expect(regions.reduce((total, region) => total + (region.category === "capability-omission" ? Object.values(region.measurements).reduce((count, measurement) => count + Object.keys(measurement).length, 0) : 0), 0)).toBe(456);
    expect(regions.reduce((total, region) => total + (region.category === "capability-omission" ? Object.values(region.protectedMeasurements ?? {}).reduce((count, measurement) => count + Object.keys(measurement).length, 0) : 0), 0)).toBe(304);
    expect(createHash("sha256").update(JSON.stringify(regions)).digest("hex"))
      .toBe("80026331c1b1560d9cb530eebc331a3bb70c2af1f725870ec18de24fd9b00cf8");
  });
});
