import type { InspectorDto, TracePageDto } from "./dto";

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
  loadInspector: (nodeId: string, signal?: AbortSignal) => Promise<InspectorDto>;
};

export function presentRunDetail(
  page: TracePageDto,
  loadInspector: RunDetailRouteData["loadInspector"],
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
    loadInspector,
  };
}
