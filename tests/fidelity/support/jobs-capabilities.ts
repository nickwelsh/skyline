import { expectedCaptureIds, type FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import type { CapabilityOmissionDefinition } from "./difference-regions";

const pin = "ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0";
const listCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam._index/route.tsx#L282-L456`;
const detailCitation = `https://github.com/triggerdotdev/trigger.dev/blob/${pin}/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.tasks.standard.%24taskParam/route.tsx#L329-L451`;
const listStates = ["jobs-populated", "jobs-contrasting-activity", "jobs-filtering", "jobs-long-labels"];
const detailStates = ["job-found", "job-stale-refresh", "jobs-favorite", "jobs-recent-runs", "jobs-absent-optional-data"];
const visibleRows = 25;
const protectedRows = 25;

export function jobsCapabilityDefinitions(matrix: FidelityMatrix): CapabilityOmissionDefinition[] {
  const captures = expectedCaptureIds(matrix);
  return [
    definition(
      "jobs-list-source-definition",
      captures.filter((capture) => listStates.some((state) => capture.startsWith(`${state}@`))),
      [
        pair("task-type-filter", "[data-trigger-capability='jobs-list-task-type-filter']", "[data-skyline-capability-boundary='jobs-list-task-type-filter']"),
        pair("type-header", "#reference table thead tr > th:nth-child(2)", "[data-skyline-capability-boundary='jobs-list-type-header']"),
        pair("file-header", "#reference table thead tr > th:nth-child(3)", "[data-skyline-capability-boundary='jobs-list-file-header']"),
        ...Array.from({ length: visibleRows }, (_, index) => index + 1).flatMap((row) => [
          pair(`type-row-${row}`, `#reference table tbody tr:nth-child(${row}) > td:nth-child(2)`, `[data-skyline-capability-boundary='jobs-list-type-row-${row}']`),
          pair(`file-row-${row}`, `#reference table tbody tr:nth-child(${row}) > td:nth-child(3)`, `[data-skyline-capability-boundary='jobs-list-file-row-${row}']`),
        ]),
      ],
      [listCitation],
      [
        protect("search", "[data-skyline-protected='jobs-list-search']"),
        protect("pagination", "[data-skyline-protected='jobs-list-pagination']", false, true),
        ...[1, 2, 3, 4].map((column) => protect(`header-${column}`, `#skyline table thead tr > th:nth-child(${column})`, false, column >= 2)),
        ...Array.from({ length: protectedRows }, (_, index) => index + 1).flatMap((row) => [1, 2, 3, 4].map((column) => protect(`row-${row}-column-${column}`, `#skyline table tbody tr:nth-child(${row}) > td:nth-child(${column})`, row >= 18, column >= 2))),
      ],
    ),
    definition(
      "job-detail-unavailable-definition",
      captures.filter((capture) => detailStates.some((state) => capture.startsWith(`${state}@`))),
      [
        pair("source-definition", "[data-trigger-capability='job-detail-source-definition']", "[data-skyline-capability-boundary='job-detail-source-definition']"),
        pair("queue-administration", "[data-trigger-capability='job-detail-queue-administration']", "[data-skyline-capability-boundary='job-detail-queue-administration']"),
        pair("runtime-policy", "[data-trigger-capability='job-detail-runtime-policy']", "[data-skyline-capability-boundary='job-detail-runtime-policy']"),
      ],
      [detailCitation],
      [
        protect("identifier", "[data-skyline-protected='job-detail-identifier']", false, true),
        protect("queue-links", "[data-skyline-protected='job-detail-queue-links']", false, true),
        protect("created", "[data-skyline-protected='job-detail-created']", false, true),
      ],
    ),
  ];
}

function pair(id: string, triggerSelector: string, skylineSelector: string) {
  return { id, triggerSelector, skylineSelector, skylineBoundary: true as const };
}

function protect(id: string, selector: string, allowBelowViewport = false, allowRightOfViewport = false) {
  return { id, application: "skyline" as const, selector, ...(allowBelowViewport ? { allowBelowViewport: true as const } : {}), ...(allowRightOfViewport ? { allowRightOfViewport: true as const } : {}) };
}

function definition(id: string, captures: string[], selectorPairs: CapabilityOmissionDefinition["selectorPairs"], citations: string[], protectedSelectors: NonNullable<CapabilityOmissionDefinition["protectedSelectors"]>): CapabilityOmissionDefinition {
  return {
    id,
    category: "capability-omission",
    decision: "NW-219",
    acceptance: [
      "Scope only source-definition, version, machine, retry, payload, and Queue-administration data unavailable from observed Skyline Runs.",
      "Measure each omitted Trigger subtree against a unique surviving Skyline insertion boundary without removing that boundary from full accessibility comparison.",
      "Keep activity, search, pagination, observed Queue links, Runs, and surrounding source chrome outside omission ownership.",
    ],
    citations,
    captures,
    selectorPairs,
    measurements: {},
    protectedSelectors,
    protectedMeasurements: {},
  };
}
