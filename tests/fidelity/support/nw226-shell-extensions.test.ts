import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import matrix from "../matrix.json" with { type: "json" };
import { nw226BrandingIdentityDefinition, nw226ShellExtensionDefinitions } from "./nw226-shell-extensions";

const shellAnchor = "[role='separator'][aria-label='Resize side menu']";

describe("NW-226 shell extension discovery", () => {
  const definitions = nw226ShellExtensionDefinitions(matrix as unknown as FidelityMatrix);
  const identity = nw226BrandingIdentityDefinition(matrix as unknown as FidelityMatrix);

  test("allows only Appearance as an extension across every capture", () => {
    expect(definitions).toEqual([{
      id: "shell-appearance",
      category: "framework-extension",
      decision: "NW-226",
      acceptance: "Skyline Appearance remains exact, bounded, and source-anchored.",
      captures: definitions[0].captures,
      skylineSelector: "[data-skyline-extension='shell-appearance']",
      triggerAnchorSelector: shellAnchor,
      skylineAnchorSelector: shellAnchor,
      accessibleRole: "button",
      accessibleName: "Appearance",
      anchorAccessibleRole: "separator",
      anchorAccessibleName: "Resize side menu",
      measurements: {},
    }]);
    expect(definitions[0].captures).toHaveLength(439);
    expect(JSON.stringify(definitions)).not.toMatch(/observability|logs-navigation|errors-navigation|queues-navigation/i);
  });

  test("owns branding and single-Application reflow without masking supported navigation", () => {
    expect(identity).toMatchObject({
      id: "shell-branding-identity",
      category: "branding-identity",
      decision: "NW-226",
      captures: definitions[0].captures,
      identityPairs: [
        { id: "brand", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)", skylineSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)" },
        { id: "application", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(2)", skylineSelector: "[data-testid='side-menu-application']" },
      ],
      triggerNavigationSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) > :first-child",
      skylineNavigationSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) > :first-child",
      protectedPairs: expect.arrayContaining([
        { id: "tasks", triggerSelector: "[data-action='tasks']", skylineSelector: "[data-action='tasks']" },
        { id: "runs", triggerSelector: "[data-action='runs']", skylineSelector: "[data-action='runs']" },
        { id: "logs", triggerSelector: "[data-action='logs']", skylineSelector: "[data-action='logs']", captures: expect.not.arrayContaining(["shell-customized@1024x768-classic"]) },
        { id: "errors", triggerSelector: "[data-action='errors']", skylineSelector: "[data-action='errors']" },
        { id: "queues", triggerSelector: "[data-action='queues']", skylineSelector: "[data-action='queues']" },
      ]),
      measurements: {},
    });
    expect(identity.protectedPairs).toHaveLength(6);
    expect(identity.protectedPairs.find(({ id }) => id === "logs")?.captures).toHaveLength(434);
    expect(identity.acceptance).toHaveLength(2);
    expect(identity.citations).toHaveLength(2);
  });

  test("registers a reusable exact browser discovery with full accessibility", () => {
    const discovery = readFileSync(resolve(import.meta.dirname, "../nw226-shell-extension.discovery.ts"), "utf8");
    const config = readFileSync(resolve(import.meta.dirname, "../../../playwright.discovery.config.ts"), "utf8");

    expect(discovery).toContain("expect(frameworkDefinitions).toHaveLength(1)");
    expect(discovery).toContain("expect(captures).toHaveLength(439)");
    expect(discovery).toContain("for (const capture of captures)");
    expect(discovery).toContain("discoverBrandingIdentityObservation");
    expect(discovery).toContain("discoverFrameworkExtensionObservation");
    expect(discovery).toContain("accessibilitySha256: observation.accessibilitySha256");
    expect(discovery).toContain("FRAMEWORK_EXTENSION_MEASUREMENT=");
    expect(discovery).toContain("NW226_CLASSIFICATION=");
    expect(discovery).toContain('decision !== "NW-226"');
    expect(config).toContain('"**/nw226-shell-extension.discovery.ts"');
  });
});
