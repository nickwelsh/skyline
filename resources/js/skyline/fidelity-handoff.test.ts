import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { assembleFidelityHandoff, validateFidelityHandoffEnvelope, verifyFidelityHandoff } from "../../../scripts/fidelity-handoff.mjs";

describe("source-fidelity handoff", () => {
  const bundle = {
    schemaVersion: 1,
    environment: {
      triggerCommit: "ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0",
      fixtureVersion: "nw-227-v1",
      chromiumRevision: "1208",
    },
    inputs: { differencesSha256: "a".repeat(64) },
    captures: ["jobs-populated@1440x960-classic"],
    artifacts: [
      { path: "trigger.png", type: "screenshot", sha256: "b".repeat(64) },
      { path: "comparison.json", type: "comparison", sha256: "c".repeat(64) },
    ],
    regeneration: { basis: "accepted-difference", decision: "NW-216" },
  };
  const differences = {
    decision: "NW-216",
    regions: [
      { id: "brand", category: "branding-terminology", decision: "NW-216" },
      { id: "queue-filter", category: "framework-extension", decision: "NW-223" },
    ],
  };
  const bundleBytes = `${JSON.stringify(bundle, null, 2)}\n`;
  const assemblerBytes = "reviewed assembler";

  test("assembles deterministic review evidence from the verified bundle", () => {
    expect(assembleFidelityHandoff(bundle, differences, bundleBytes, assemblerBytes, "NW-228")).toEqual({
      schemaVersion: 1,
      spec: "NW-216",
      decision: "NW-228",
      assemblerSha256: createHash("sha256").update(assemblerBytes).digest("hex"),
      oracle: {
        bundleSha256: createHash("sha256").update(bundleBytes).digest("hex"),
        triggerCommit: bundle.environment.triggerCommit,
        fixtureVersion: "nw-227-v1",
        chromiumRevision: "1208",
        regeneration: bundle.regeneration,
        captures: 1,
        artifacts: 2,
        artifactTypes: { comparison: 1, screenshot: 1 },
      },
      allowedDifferences: {
        sha256: "a".repeat(64),
        decision: "NW-216",
        regions: [
          { id: "brand", category: "branding-terminology", decision: "NW-216" },
          { id: "queue-filter", category: "framework-extension", decision: "NW-223" },
        ],
      },
    });
  });

  test("rejects stale or unreviewed handoffs", () => {
    const handoff = assembleFidelityHandoff(bundle, differences, bundleBytes, assemblerBytes, "NW-228");

    expect(() => validateFidelityHandoffEnvelope(bundle, differences, `${bundleBytes} `, assemblerBytes, handoff)).toThrow(/drifted/i);
    expect(() => validateFidelityHandoffEnvelope(bundle, differences, bundleBytes, `${assemblerBytes}.`, handoff)).toThrow(/drifted/i);
    expect(() => assembleFidelityHandoff(bundle, differences, bundleBytes, assemblerBytes, "NW-999")).toThrow(/NW-228/i);
    expect(() => validateFidelityHandoffEnvelope(bundle, { ...differences, regions: [] }, bundleBytes, assemblerBytes, handoff)).toThrow(/drifted/i);
    expect(() => verifyFidelityHandoff("/missing-fidelity-handoff-root")).toThrow(/missing verified oracle bundle/i);
  });
});
