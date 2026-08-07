import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import matrix from "../matrix.json" with { type: "json" };
import { nw226ShellExtensionDefinitions } from "./nw226-shell-extensions";

const expected = [
  ["shell-observability-header", "[data-skyline-extension='shell-observability-header']", "button", "Observability"],
  ["shell-logs-navigation", "[data-skyline-extension='shell-logs-navigation']", "link", "Logs"],
  ["shell-errors-navigation", "[data-skyline-extension='shell-errors-navigation']", "link", "Errors"],
  ["shell-queues-navigation", "[data-skyline-extension='shell-queues-navigation']", "link", "Queues"],
  ["shell-appearance", "[data-skyline-extension='shell-appearance']", "button", "Appearance"],
] as const;
const shellAnchor = "[role='separator'][aria-label='Resize side menu']";

describe("NW-226 shell extension discovery", () => {
  const definitions = nw226ShellExtensionDefinitions(matrix as unknown as FidelityMatrix);

  test("defines five exact controls across the 38 Queue captures", () => {
    expect(definitions).toHaveLength(5);
    for (const [index, [id, skylineSelector, accessibleRole, accessibleName]] of expected.entries()) {
      expect(definitions[index]).toEqual({
        id,
        category: "framework-extension",
        decision: "NW-226",
        acceptance: "Skyline-only supported shell controls remain exact, bounded, and source-anchored.",
        captures: definitions[0].captures,
        skylineSelector,
        triggerAnchorSelector: shellAnchor,
        skylineAnchorSelector: shellAnchor,
        accessibleRole,
        accessibleName,
        anchorAccessibleRole: "separator",
        anchorAccessibleName: "Resize side menu",
        measurements: {},
      });
    }
    expect(definitions[0].captures).toHaveLength(38);
    expect(definitions.every(({ captures }) => captures === definitions[0].captures)).toBe(true);
  });

  test("anchors above the intentional Application identity reflow", () => {
    for (const definition of definitions) {
      expect(definition.triggerAnchorSelector).toBe(shellAnchor);
      expect(definition.skylineAnchorSelector).toBe(shellAnchor);
      expect(definition.triggerAnchorSelector).not.toBe("[data-action='tasks']");
    }
  });

  test("registers a reusable exact browser discovery with full accessibility", () => {
    const discovery = readFileSync(resolve(import.meta.dirname, "../nw226-shell-extension.discovery.ts"), "utf8");
    const config = readFileSync(resolve(import.meta.dirname, "../../../playwright.discovery.config.ts"), "utf8");

    expect(discovery).toContain("expect(definitions).toHaveLength(5)");
    expect(discovery).toContain("expect(captures).toHaveLength(38)");
    expect(discovery).toContain("for (const capture of captures)");
    expect(discovery).toContain("for (const definition of definitions)");
    expect(discovery).toContain("discoverFrameworkExtensionObservation");
    expect(discovery).toContain("accessibilitySha256: observation.accessibilitySha256");
    expect(discovery).toContain("FRAMEWORK_EXTENSION_MEASUREMENT=");
    expect(config).toContain('"**/nw226-shell-extension.discovery.ts"');
  });
});
