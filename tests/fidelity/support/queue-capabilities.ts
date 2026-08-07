import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import type { CapabilityOmissionDefinition } from "./difference-regions";

const pin = "ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0";
const listCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues/route.tsx#L517-L1010`;
const detailStatsCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues_.%24queueParam/route.tsx#L1053-L1220`;
const detailChartsCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues_.%24queueParam/route.tsx#L396-L519`;

const stableRootStates = ["queues-multiple-targets", "queues-long-labels", "queues-hidden-controls"];
const stableDetailStates = ["queues-idle", "queues-busy", "queues-activity-wait-history"];

const queueTargets: ReadonlyArray<{ slug: string; id: string; filtered: boolean; backlogged: boolean }> = [
  { slug: "database-reports", id: "queue_3ac9ae5d", filtered: true, backlogged: false },
  { slug: "redis-billing", id: "queue_c3203647", filtered: false, backlogged: false },
  { slug: "redis-default", id: "queue_3b6b7027", filtered: false, backlogged: true },
  { slug: "redis-mail", id: "queue_04e3fa05", filtered: false, backlogged: false },
  { slug: "sqs-imports", id: "queue_6f8f521a", filtered: false, backlogged: false },
];

export function queueCapabilityDefinitions(matrix: FidelityMatrix): CapabilityOmissionDefinition[] {
  const captureIds = expectedCaptureIds(matrix);
  const genericRootCaptures = captureIds.filter((capture) => capture.startsWith("queues-populated@"));
  const genericDetailCaptures = captureIds.filter((capture) => capture.startsWith("queue-found@"));
  const stableRootCaptures = [...genericRootCaptures, ...captureIds.filter((capture) => stableRootStates.some((state) => capture.startsWith(`${state}@`)))].sort();
  const filteringCaptures = captureIds.filter((capture) => capture.startsWith("queues-filtering@"));
  const stableDetailCaptures = [...genericDetailCaptures, ...captureIds.filter((capture) => stableDetailStates.some((state) => capture.startsWith(`${state}@`)))].sort();
  const paginatedCaptures = captureIds.filter((capture) => capture.startsWith("queues-paginated-runs@"));
  const markersFor = (targets: typeof queueTargets) => targets.flatMap((target) => [
    `queue-target-${target.id}-limit`,
    `queue-target-${target.id}-limited-by`,
    `queue-target-${target.id}-backlog`,
    `queue-target-${target.id}-pause-resume`,
    ...(target.backlogged ? [`queue-target-${target.id}-warning`, `queue-target-${target.id}-health`] : []),
  ]);
  const rootStats = ["queue-root-running", "queue-root-environment-limit"];
  const rootProtected = [
    protect("search", "[data-skyline-protected='queue-list-search']"),
    protect("connection", "[data-skyline-protected='queue-list-connection']"),
    protect("period", "[data-skyline-protected='queue-period']"),
    protect("root-recorded-queued", "[data-skyline-protected='queue-root-recorded-queued']"),
    protect("root-recorded-running", "[data-skyline-protected='queue-root-recorded-running']"),
    protect("queue-identities", "[data-skyline-protected='queue-list-target-evidence']"),
  ];
  const detailProtected = [
    protect("detail-identity", "[data-skyline-protected='queue-detail-identity']"),
    protect("period", "[data-skyline-protected='queue-period']"),
    protect("detail-recorded-runs-stat", "[data-skyline-protected='queue-detail-recorded-runs-stat']", true),
    protect("detail-queue-time-samples", "[data-skyline-protected='queue-detail-queue-time-samples']", true),
    protect("detail-median", "[data-skyline-protected='queue-detail-median']", true),
    protect("detail-p95", "[data-skyline-protected='queue-detail-p95']", true),
    protect("detail-maximum", "[data-skyline-protected='queue-detail-maximum']", true),
    protect("detail-status-counts", "[data-skyline-protected='queue-detail-status-counts']", true),
    protect("detail-activity", "[data-skyline-protected='queue-detail-activity']", true),
    protect("detail-recorded-runs", "[data-skyline-protected='queue-detail-recorded-runs']"),
  ];

  return [
    definition("queue-root-capabilities", stableRootCaptures, [
      ...rootStats,
      ...markersFor(queueTargets),
    ], [listCitation], rootProtected),
    definition("queue-root-filtering-capabilities", filteringCaptures, [...rootStats, ...markersFor(queueTargets.filter(({ filtered }) => filtered))], [listCitation], rootProtected),
    definition("queue-detail-capabilities", stableDetailCaptures, ["queue-detail-concurrency", "queue-detail-concurrency-limit", "queue-detail-throttled"], [detailStatsCitation, detailChartsCitation], detailProtected),
    definition("queue-detail-paginated-capabilities", paginatedCaptures, ["queue-detail-concurrency", "queue-detail-concurrency-limit"], [detailStatsCitation, detailChartsCitation], detailProtected),
  ];
}

function pair(marker: string): CapabilityOmissionDefinition["selectorPairs"][number] {
  return {
    id: marker,
    triggerSelector: `[data-trigger-capability=${JSON.stringify(marker)}]`,
    skylineSelector: `[data-skyline-capability-boundary=${JSON.stringify(marker)}]`,
    skylineBoundary: true,
  };
}

function protect(id: string, selector: string, allowBelowViewport = false) {
  return { id, application: "skyline" as const, selector, ...(allowBelowViewport ? { allowBelowViewport: true as const } : {}) };
}

function definition(id: string, captures: string[], markers: string[], citations: string[], protectedSelectors: NonNullable<CapabilityOmissionDefinition["protectedSelectors"]>): CapabilityOmissionDefinition {
  return {
    id,
    category: "capability-omission",
    decision: "NW-221",
    acceptance: [
      "Scope only source-visible Queue capability data unavailable from Skyline evidence.",
      "Measure each omitted Trigger subtree against a unique empty Skyline insertion boundary without removing that boundary from full accessibility comparison.",
      "Protect connection, Queue identity, recorded status/statistic evidence, activity, filters, and Runs against reflow or semantic drift.",
    ],
    citations,
    captures,
    selectorPairs: markers.map(pair),
    measurements: {},
    protectedSelectors,
    protectedMeasurements: {},
  };
}
