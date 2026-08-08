import type { RunsRouteData } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";
import type { RunSummary, RunsPageDto, RunsQuery } from "./dto";
import { compactQuery, queryStatuses, queryValue } from "./QueryParams";

export function runsQuery(request: Request, now = new Date()): RunsQuery {
  const params = new URL(request.url).searchParams;
  const rootOnly = params.get("rootOnly");
  const hasTimeBounds = params.has("triggeredFrom") || params.has("triggeredTo");
  const triggeredTo = hasTimeBounds ? queryValue(params, "triggeredTo") : now.toISOString();
  const triggeredFrom = hasTimeBounds
    ? queryValue(params, "triggeredFrom")
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000).toISOString();

  return compactQuery({
    cursor: queryValue(params, "cursor"),
    search: queryValue(params, "search"),
    status: queryStatuses(params),
    job: queryValue(params, "job"),
    connection: queryValue(params, "connection"),
    queue: queryValue(params, "queue"),
    trace: queryValue(params, "trace"),
    rootOnly: rootOnly === null ? undefined : rootOnly === "true",
    triggeredFrom,
    triggeredTo,
  });
}

export function presentRuns(page: RunsPageDto): RunsRouteData {
  return {
    generatedAt: page.generatedAt,
    runs: page.runs.map((run) => presentRun(run, page.tableState)),
    pagination: {
      previous: page.pagination.previous ?? undefined,
      next: page.pagination.next ?? undefined,
    },
    filterOptions: {
      statuses: page.options.statuses,
      jobTypes: page.options.jobNames,
      queueTargets: page.options.queueTargets,
      traceIdentities: page.options.traceIdentities,
    },
    hasFilters: Object.values(page.filters).some((value) => value === true || (Array.isArray(value) ? value.length > 0 : value !== null && value !== "" && value !== false)),
    polling: page.polling,
  };
}

export function presentRun(run: RunSummary, tableState: string) {
  const params = new URLSearchParams({ tableState });
  return {
    id: run.id,
    friendlyId: run.id,
    path: `/runs/${encodeURIComponent(run.id)}?${params}`,
    isRoot: run.isRoot,
    jobType: run.name,
    taskIdentifier: run.name,
    rootTaskRunId: run.isRoot ? null : (run.parentRunId ?? "observed-parent"),
    status: run.status,
    queueTarget: run.connection && run.queue ? `${run.connection} / ${run.queue}` : "—",
    createdAt: run.triggeredAt,
    updatedAt: run.finishedAt ?? run.startedAt ?? run.triggeredAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    isPending: run.status === "queued",
    isCancellable: false,
    usageDurationMs: Math.round((run.activeDurationUs ?? 0) / 1_000),
    queueDuration: formatRunDuration(run.queueDurationUs),
    duration: formatRunDuration(run.durationUs),
    activeDuration: formatRunDuration(run.activeDurationUs),
  };
}

export function formatRunDuration(microseconds: number | null | undefined): string {
  if (microseconds === null || microseconds === undefined) return "—";
  if (microseconds < 1_000) return `${microseconds}µs`;
  const milliseconds = microseconds / 1_000;
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)}s`;
}
