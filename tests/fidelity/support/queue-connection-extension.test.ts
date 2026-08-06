import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import matrix from "../matrix.json" with { type: "json" };
import { queueConnectionExtensionDefinition } from "./queue-connection-extension";
import { queueCapabilityDefinitions } from "./queue-capabilities";
import { validateFrameworkExtensionDefinitions } from "./difference-regions";

describe("NW-221 Queue Connection framework extension", () => {
  const definition = queueConnectionExtensionDefinition(matrix as unknown as FidelityMatrix);

  test("owns exactly one root-only Connection control against the paired Queue search anchor", () => {
    expect(definition).toMatchObject({
      id: "queue-connection-filter",
      category: "framework-extension",
      decision: "NW-221",
      acceptance: "Connection, search, and time-range filters are URL-backed and use valid server-supplied options.",
      skylineSelector: '[data-skyline-extension="queue-connection-filter"]',
      triggerAnchorSelector: '[data-trigger-anchor="queue-filter-controls"]',
      skylineAnchorSelector: '[data-skyline-anchor="queue-filter-controls"]',
      accessibleRole: "combobox",
      accessibleName: "Connection",
      anchorAccessibleRole: "search",
      anchorAccessibleName: "Queue search",
      measurements: {},
    });
    expect(definition.captures).toHaveLength(19);
    expect(definition.captures.every((capture) => capture.startsWith("queues-"))).toBe(true);
    expect(definition.captures.some((capture) => capture.startsWith("queue-found@"))).toBe(false);
  });

  test("coexists with Queue capability omissions", () => {
    expect(() => validateFrameworkExtensionDefinitions({
      regions: [definition, ...queueCapabilityDefinitions(matrix as unknown as FidelityMatrix)],
    })).not.toThrow();
  });

  test("discovers exact option identity, selected state, and full accessibility subtree", () => {
    const discovery = readFileSync(resolve(import.meta.dirname, "../queue-connection-extension.discovery.ts"), "utf8");
    expect(discovery).toContain('expect(definition.captures).toHaveLength(19)');
    expect(discovery).toContain('expect(await step("connection:count"');
    expect(discovery).toContain('{ value: "", text: "All" }');
    expect(discovery).toContain('connection.selectOption("database")');
    expect(discovery).toContain('expect(await connection.inputValue()).toBe("database")');
    expect(discovery).toContain("accessibilitySha256: observation.accessibilitySha256");
  });
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
