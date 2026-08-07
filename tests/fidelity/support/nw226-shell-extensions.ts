import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import type { FrameworkExtensionDefinition } from "./difference-regions";

const queueStates = ["activity-wait-history", "busy", "filtering", "hidden-controls", "idle", "long-labels", "multiple-targets", "paginated-runs"];
const controls = [
  ["shell-observability-header", "[data-skyline-extension='shell-observability-header']", "button", "Observability"],
  ["shell-logs-navigation", "[data-skyline-extension='shell-logs-navigation']", "link", "Logs"],
  ["shell-errors-navigation", "[data-skyline-extension='shell-errors-navigation']", "link", "Errors"],
  ["shell-queues-navigation", "[data-skyline-extension='shell-queues-navigation']", "link", "Queues"],
  ["shell-appearance", "[data-skyline-extension='shell-appearance']", "button", "Appearance"],
] as const;
const shellAnchor = "[role='separator'][aria-label='Resize side menu']";

export function nw226ShellExtensionDefinitions(matrix: FidelityMatrix): FrameworkExtensionDefinition[] {
  const captures = expectedCaptureIds(matrix).filter((capture) =>
    capture.startsWith("queue-found@")
      || capture.startsWith("queues-populated@")
      || queueStates.some((state) => capture.startsWith(`queues-${state}@1440x960-`)),
  ).sort();

  return controls.map(([id, skylineSelector, accessibleRole, accessibleName]) => ({
    id,
    category: "framework-extension",
    decision: "NW-226",
    acceptance: "Skyline-only supported shell controls remain exact, bounded, and source-anchored.",
    captures,
    skylineSelector,
    triggerAnchorSelector: shellAnchor,
    skylineAnchorSelector: shellAnchor,
    accessibleRole,
    accessibleName,
    anchorAccessibleRole: "separator",
    anchorAccessibleName: "Resize side menu",
    measurements: {},
  }));
}
