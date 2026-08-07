import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import matrix from "../matrix.json" with { type: "json" };
import { queueCapabilityDefinitions } from "./queue-capabilities";
import { queueConnectionExtensionDefinition } from "./queue-connection-extension";
import { queueRecordedRunsExtensionDefinition } from "./queue-recorded-runs-extension";
import { validateFrameworkExtensionDefinitions } from "./difference-regions";

describe("NW-221 Queue Recorded Runs framework extension", () => {
  const fidelityMatrix = matrix as unknown as FidelityMatrix;
  const definition = queueRecordedRunsExtensionDefinition(fidelityMatrix);

  test("owns exactly one detail-only region against the paired Period anchor", () => {
    expect(definition).toMatchObject({
      id: "queue-recorded-runs",
      category: "framework-extension",
      decision: "NW-221",
      acceptance: "Detail adds queue-time/activity series and cursor-paginated filtered Runs.",
      skylineSelector: '[data-skyline-extension="queue-recorded-runs"]',
      triggerAnchorSelector: '[data-trigger-anchor="queue-period-filter"]',
      skylineAnchorSelector: '[data-skyline-anchor="queue-period-filter"]',
      accessibleRole: "region",
      accessibleName: "Recorded runs",
      anchorAccessibleRole: "combobox",
      anchorAccessibleName: "Period: 1 hr",
      measurements: {},
    });
    expect(definition.captures).toEqual([
      "queue-found@1024x768-classic",
      "queue-found@1440x960-classic",
      "queue-found@1440x960-dark",
      "queue-found@1440x960-light",
      "queue-found@1440x960-system-dark",
      "queue-found@1440x960-system-light",
      "queue-found@390x844-classic",
      "queues-activity-wait-history@1440x960-classic",
      "queues-activity-wait-history@1440x960-dark",
      "queues-activity-wait-history@1440x960-light",
      "queues-busy@1440x960-classic",
      "queues-busy@1440x960-dark",
      "queues-busy@1440x960-light",
      "queues-idle@1440x960-classic",
      "queues-idle@1440x960-dark",
      "queues-idle@1440x960-light",
      "queues-paginated-runs@1440x960-classic",
      "queues-paginated-runs@1440x960-dark",
      "queues-paginated-runs@1440x960-light",
    ]);
  });

  test("coexists with root Connection and Queue capability omissions", () => {
    expect(() => validateFrameworkExtensionDefinitions({
      regions: [
        queueConnectionExtensionDefinition(fidelityMatrix),
        definition,
        ...withProtectedEvidence(queueCapabilityDefinitions(fidelityMatrix)),
      ],
    })).not.toThrow();
  });

  test("discovers collapsed and paginated states with full accessibility", () => {
    const discovery = readFileSync(resolve(import.meta.dirname, "../queue-recorded-runs-extension.discovery.ts"), "utf8");
    const config = readFileSync(resolve(import.meta.dirname, "../../../playwright.discovery.config.ts"), "utf8");
    expect(discovery).toContain("expect(definition.captures).toHaveLength(19)");
    expect(discovery).toContain('step("recorded-runs:collapsed"');
    expect(discovery).toContain('step("recorded-runs:open-table"');
    expect(discovery).toContain('step("recorded-runs:escape"');
    expect(discovery).toContain('step("recorded-runs:focus-restored"');
    expect(discovery).toContain('scenario.id === "queues-paginated-runs"');
    expect(discovery).toContain("FRAMEWORK_EXTENSION_ANCHOR=");
    expect(discovery).toContain("accessibilitySha256: observation.accessibilitySha256");
    expect(config).toContain('"**/queue-recorded-runs-extension.discovery.ts"');
  });
});

function withProtectedEvidence(definitions: ReturnType<typeof queueCapabilityDefinitions>) {
  const evidence = { rect: { x: 0, y: 0, width: 1, height: 1 }, computedStyleSha256: "a".repeat(64), accessibilitySha256: "b".repeat(64), crop: { status: "visible" as const, rect: { x: 0, y: 0, width: 1, height: 1 }, screenshotSha256: "c".repeat(64) } };
  return definitions.map((definition) => ({
    ...definition,
    protectedMeasurements: Object.fromEntries(definition.captures.map((capture) => [capture, Object.fromEntries((definition.protectedSelectors ?? []).map(({ id }) => [id, evidence]))])),
  }));
}
