import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import type { CapabilityOmissionDefinition } from "./difference-regions";

const pin = "ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0";
const listCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues/route.tsx#L517-L1010`;
const detailStatsCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues_.%24queueParam/route.tsx#L1053-L1220`;
const detailChartsCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues_.%24queueParam/route.tsx#L396-L519`;

const stableRootStates = ["queues-multiple-targets", "queues-long-labels", "queues-hidden-controls"];
const stableDetailStates = ["queues-idle", "queues-busy", "queues-activity-wait-history"];

const queueTargets = [
  { slug: "database-reports", id: "queue_3ac9ae5d", filtered: true, backlogged: false },
  { slug: "redis-billing", id: "queue_c3203647", filtered: false, backlogged: false },
  { slug: "redis-default", id: "queue_3b6b7027", filtered: false, backlogged: true },
  { slug: "redis-mail", id: "queue_04e3fa05", filtered: false, backlogged: false },
  { slug: "sqs-imports", id: "queue_6f8f521a", filtered: false, backlogged: false },
] as const;

export function queueCapabilityDefinitions(matrix: FidelityMatrix): CapabilityOmissionDefinition[] {
  const captureIds = expectedCaptureIds(matrix);
  const genericRootCaptures = captureIds.filter((capture) => capture.startsWith("queues-populated@"));
  const genericDetailCaptures = captureIds.filter((capture) => capture.startsWith("queue-found@"));
  const stableRootCaptures = [...genericRootCaptures, ...captureIds.filter((capture) => stableRootStates.some((state) => capture.startsWith(`${state}@`)))].sort();
  const stableDetailCaptures = [...genericDetailCaptures, ...captureIds.filter((capture) => stableDetailStates.some((state) => capture.startsWith(`${state}@`)))].sort();

  return [
    definition("queue-root-capabilities", stableRootCaptures, [
      "queue-root-running",
      "queue-root-environment-limit",
      ...queueTargets.flatMap((target) => [
        `queue-target-${target.id}-limit`,
        `queue-target-${target.id}-limited-by`,
        `queue-target-${target.id}-backlog`,
        `queue-target-${target.id}-pause-resume`,
        ...(target.backlogged ? [`queue-target-${target.id}-warning`, `queue-target-${target.id}-health`] : []),
      ]),
    ], [listCitation]),
    definition("queue-detail-capabilities", stableDetailCaptures, ["queue-detail-concurrency", "queue-detail-concurrency-limit", "queue-detail-throttled"], [detailStatsCitation, detailChartsCitation]),
  ];
}

function definition(id: string, captures: string[], markers: string[], citations: string[]): CapabilityOmissionDefinition {
  return {
    id,
    category: "capability-omission",
    decision: "NW-221",
    acceptance: [
      "Scope only source-visible Queue capability data unavailable from Skyline evidence.",
      "Keep each Trigger and Skyline node uniquely paired by semantic marker and exact geometry/style.",
      "Lock exact subtree accessibility text/state, including explicit null and empty sentinels; accessible Queue surface ownership remains outside the omission.",
    ],
    citations,
    captures,
    selectorPairs: markers.map((marker) => ({
      id: marker,
      triggerSelector: `[data-trigger-capability=${JSON.stringify(marker)}]`,
      skylineSelector: `[data-skyline-capability=${JSON.stringify(marker)}]`,
    })),
    measurements: {},
  };
}
