import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import type { FrameworkExtensionDefinition } from "./difference-regions";

const detailStates = ["queues-idle", "queues-busy", "queues-activity-wait-history", "queues-paginated-runs"];

export function queueRecordedRunsExtensionDefinition(matrix: FidelityMatrix): FrameworkExtensionDefinition {
  const captures = expectedCaptureIds(matrix).filter((capture) =>
    capture.startsWith("queue-found@") || detailStates.some((state) => capture.startsWith(`${state}@`)),
  ).sort();
  return {
    id: "queue-recorded-runs",
    category: "framework-extension",
    decision: "NW-221",
    acceptance: "Detail adds queue-time/activity series and cursor-paginated filtered Runs.",
    captures,
    skylineSelector: '[data-skyline-extension="queue-recorded-runs"]',
    triggerAnchorSelector: '[data-trigger-anchor="queue-period-filter"]',
    skylineAnchorSelector: '[data-skyline-anchor="queue-period-filter"]',
    accessibleRole: "region",
    accessibleName: "Recorded runs",
    anchorAccessibleRole: "combobox",
    anchorAccessibleName: "Period: 1 hr",
    measurements: {},
  };
}
