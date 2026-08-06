import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import manifest from "../allowed-differences.json" with { type: "json" };
import matrix from "../matrix.json" with { type: "json" };
import { queueCapabilityDefinitions } from "./queue-capabilities";
import { queueConnectionExtensionDefinition } from "./queue-connection-extension";
import type { CapabilityOmissionDefinition, CapabilityOmissionMeasurement, FrameworkExtensionDefinition } from "./difference-regions";

const hash = /^[a-f0-9]{64}$/;

describe("NW-221 exact Queue ledger", () => {
  type QueueLedgerRegion = CapabilityOmissionDefinition | FrameworkExtensionDefinition;
  const expected = [...queueCapabilityDefinitions(matrix as unknown as FidelityMatrix), queueConnectionExtensionDefinition(matrix as unknown as FidelityMatrix)];
  const regions = manifest.regions.filter((region) => region.id.startsWith("queue-")) as unknown as QueueLedgerRegion[];

  test("owns exactly the measured definitions, captures, and selectors", () => {
    expect(regions.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    for (const definition of expected) {
      const region = regions.find(({ id }) => id === definition.id)!;
      expect({ ...region, measurements: {} }).toEqual(definition);
      expect(Object.keys(region.measurements).sort()).toEqual([...definition.captures].sort());
      expect(JSON.stringify(region)).not.toMatch(/\*|information|shell|recorded.runs/i);
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
    const connection = regions.find(({ id }) => id === "queue-connection-filter") as FrameworkExtensionDefinition;
    expect(connection.measurements["queues-filtering@1440x960-classic"]!.accessibilitySha256)
      .not.toBe(connection.measurements["queues-populated@1440x960-classic"]!.accessibilitySha256);
  });

  test("pins the reviewed 57-observation ledger", () => {
    expect(createHash("sha256").update(JSON.stringify(regions)).digest("hex"))
      .toBe("95bc288151555ecc7285d030d4343f7e1c0f74e9477c866d5047b4fd2524a3f5");
  });
});
