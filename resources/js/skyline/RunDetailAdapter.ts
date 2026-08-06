import type { InspectorDto, TracePageDto } from "./dto";
import { ExternalOperationInspector, type ExternalInspector } from "./ExternalOperationInspector";

export type RunDetailInspector = ExternalInspector;

export type RunDetailRouteData = {
  generatedAt: string;
  run: {
    id: string;
    traceId: string;
    rootRunId: string | null;
    parentRunId: string | null;
    jobType: string;
    queueTarget: string;
    driverId: string | null;
    status: TracePageDto["run"]["status"];
    triggeredAt: string;
    queuedAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    queueDurationUs: number | null;
    queueTimeSource: string | null;
    durationUs: number | null;
    attemptCount: number;
  };
  attempts: Array<TracePageDto["attempts"][number] & { path: string }>;
  relationships: {
    parent: (TracePageDto["relationships"]["parent"] & { path: string }) | null;
    children: Array<TracePageDto["relationships"]["children"][number] & { path: string }>;
  };
  trace: TracePageDto["trace"];
  navigation: {
    previousPath: string | null;
    nextPath: string | null;
    runsPath: string;
  };
  loadInspector: (nodeId: string, signal?: AbortSignal) => Promise<RunDetailInspector>;
  renderInspectorDetails: typeof ExternalOperationInspector;
};

export function presentRunDetail(
  page: TracePageDto,
  loadInspector: (nodeId: string, signal?: AbortSignal) => Promise<InspectorDto>,
): RunDetailRouteData {
  const tableState = page.navigation.tableState;
  const detailPath = (runId: string) => {
    const params = new URLSearchParams();
    if (tableState) params.set("tableState", tableState);
    return `/runs/${encodeURIComponent(runId)}${params.size ? `?${params}` : ""}`;
  };
  const listState = new URLSearchParams(tableState);

  return {
    generatedAt: page.generatedAt,
    run: {
      id: page.run.id,
      traceId: page.run.traceId,
      rootRunId: page.run.rootRunId,
      parentRunId: page.run.parentRunId,
      jobType: page.run.name,
      queueTarget: page.run.queueTarget.connection && page.run.queueTarget.queue
        ? `${page.run.queueTarget.connection} / ${page.run.queueTarget.queue}`
        : "—",
      driverId: page.run.driverId,
      status: page.run.status,
      triggeredAt: page.run.triggeredAt,
      queuedAt: page.run.queuedAt,
      startedAt: page.run.startedAt,
      finishedAt: page.run.finishedAt,
      queueDurationUs: page.run.queueDurationUs,
      queueTimeSource: page.run.queueTimeSource,
      durationUs: page.run.durationUs,
      attemptCount: page.run.attemptCount,
    },
    attempts: page.attempts.map((attempt) => ({ ...attempt, path: detailPath(page.run.id) })),
    relationships: {
      parent: page.relationships.parent
        ? { ...page.relationships.parent, path: detailPath(page.relationships.parent.id) }
        : null,
      children: page.relationships.children.map((child) => ({ ...child, path: detailPath(child.id) })),
    },
    trace: page.trace,
    navigation: {
      previousPath: page.navigation.previousRunId ? detailPath(page.navigation.previousRunId) : null,
      nextPath: page.navigation.nextRunId ? detailPath(page.navigation.nextRunId) : null,
      runsPath: `/runs${listState.size ? `?${listState}` : ""}`,
    },
    loadInspector: async (nodeId, signal) => presentInspector(await loadInspector(nodeId, signal)),
    renderInspectorDetails: ExternalOperationInspector,
  };
}

function presentInspector(inspector: InspectorDto): RunDetailInspector {
  const candidates: Array<[string, unknown]> = [
    ["SQL", inspector.sql],
    ["Bindings", inspector.bindings],
    ["Result", inspector.result],
    ["HTTP", inspector.http],
    ["Cache", inspector.cache],
    ["Redis", inspector.redis],
    ["Storage", inspector.storage],
    ["Delivery", inspector.delivery],
    ["Process", inspector.process],
    ["Transaction", inspector.transaction],
    ["Custom span", inspector.custom],
    ["Resource summary", inspector.summary],
    ["Breadcrumb", inspector.breadcrumb],
  ];

  return {
    ...inspector,
    context: inspectorContext(inspector),
    detailSections: candidates
      .filter((entry) => entry[1] !== undefined && entry[1] !== null)
      .map(([label, value]) => ({ label, value })),
  };
}

function inspectorContext(inspector: InspectorDto): RunDetailInspector["context"] {
  const presentation = inspector.presentation;
  if (!presentation) return undefined;

  if (presentation.type === "http") {
    return Object.keys(inspector.overview).length
      ? { value: inspector.overview, isTruncated: false }
      : undefined;
  }

  if (presentation.type === "breadcrumb") {
    return { value: presentation.breadcrumb.context, isTruncated: false };
  }

  if (presentation.type !== "delivery") return undefined;
  const delivery = presentation.delivery;
  const captures = [delivery.recipientIdentity, delivery.messageData, delivery.operationData];
  const value = Object.fromEntries(
    [
      ["recipients", delivery.recipients],
      ["recipientIdentity", delivery.recipientIdentity?.value],
      ["messageData", delivery.messageData?.value],
      ["operationData", delivery.operationData?.value],
    ].filter((entry): entry is [string, unknown] => entry[1] !== null && entry[1] !== undefined),
  );
  return Object.keys(value).length
    ? { value, isTruncated: captures.some((capture) => capture?.truncated === true) }
    : undefined;
}
