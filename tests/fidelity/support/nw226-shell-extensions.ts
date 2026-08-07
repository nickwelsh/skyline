import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import type { BrandingIdentityDefinition, FrameworkExtensionDefinition } from "./difference-regions";

const shellAnchor = "[role='separator'][aria-label='Resize side menu']";

export function nw226ShellExtensionDefinitions(matrix: FidelityMatrix): FrameworkExtensionDefinition[] {
  const captures = expectedCaptureIds(matrix).sort();
  return [{
    id: "shell-appearance",
    category: "framework-extension",
    decision: "NW-226",
    acceptance: "Skyline Appearance remains exact, bounded, and source-anchored.",
    captures,
    skylineSelector: "[data-skyline-extension='shell-appearance']",
    triggerAnchorSelector: shellAnchor,
    skylineAnchorSelector: shellAnchor,
    accessibleRole: "button",
    accessibleName: "Appearance",
    anchorAccessibleRole: "separator",
    anchorAccessibleName: "Resize side menu",
    measurements: {},
  }];
}

export function nw226BrandingIdentityDefinition(matrix: FidelityMatrix): BrandingIdentityDefinition {
  const captures = expectedCaptureIds(matrix).sort();
  return {
    id: "shell-branding-identity",
    category: "branding-identity",
    decision: "NW-226",
    acceptance: [
      "Skyline retains one Application identity while upstream organization/project switching remains unavailable.",
      "Supported Tasks, Runs, Observability, Logs, Errors, and Queues remain pixel-identical after the exact identity-height reflow, with exact per-side style and accessibility evidence.",
    ],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-226/complete-shell-capabilities-and-preferences",
      "https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/navigation/SideMenu.tsx#L1078-L1126",
    ],
    captures,
    identityPairs: [
      { id: "brand", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)", skylineSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)" },
      { id: "application", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(2)", skylineSelector: "[data-testid='side-menu-application']" },
    ],
    triggerNavigationSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) > :first-child",
    skylineNavigationSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) > :first-child",
    protectedPairs: [
      ...["tasks", "runs", "logs", "errors", "queues"].map((id) => ({
        id,
        triggerSelector: `[data-action='${id}']`,
        skylineSelector: `[data-action='${id}']`,
        ...(id === "logs" ? { captures: captures.filter((capture) => !capture.startsWith("shell-customized@")) } : {}),
      })),
      {
        id: "observability",
        triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) button[aria-expanded='true']",
        skylineSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) button[aria-expanded='true']",
      },
    ],
    measurements: {},
  };
}
