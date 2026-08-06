import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import type { FrameworkExtensionDefinition } from "./difference-regions";

const rootStates = ["queues-multiple-targets", "queues-filtering", "queues-long-labels", "queues-hidden-controls"];

export function queueConnectionExtensionDefinition(matrix: FidelityMatrix): FrameworkExtensionDefinition {
  const captures = expectedCaptureIds(matrix).filter((capture) =>
    capture.startsWith("queues-populated@") || rootStates.some((state) => capture.startsWith(`${state}@`)),
  ).sort();
  return {
    id: "queue-connection-filter",
    category: "framework-extension",
    decision: "NW-221",
    acceptance: "Connection, search, and time-range filters are URL-backed and use valid server-supplied options.",
    captures,
    skylineSelector: '[data-skyline-extension="queue-connection-filter"]',
    triggerAnchorSelector: '[data-trigger-anchor="queue-filter-controls"]',
    skylineAnchorSelector: '[data-skyline-anchor="queue-filter-controls"]',
    accessibleRole: "combobox",
    accessibleName: "Connection",
    anchorAccessibleRole: "search",
    anchorAccessibleName: "Queue search",
    measurements: {},
  };
}
