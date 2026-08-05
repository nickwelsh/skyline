import type { RunsRouteData } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";
import type { RunSummary, RunsPageDto, RunsQuery } from "./dto";
import { compactQuery, queryStatuses, queryValue } from "./QueryParams";

export function runsQuery(request: Request): RunsQuery {
  const params = new URL(request.url).searchParams;
  const rootOnly = params.get("rootOnly");

  return compactQuery({
    cursor: queryValue(params, "cursor"),
    search: queryValue(params, "search"),
    status: queryStatuses(params),
    job: queryValue(params, "job"),
    connection: queryValue(params, "connection"),
    queue: queryValue(params, "queue"),
    trace: queryValue(params, "trace"),
    rootOnly: rootOnly === null ? undefined : rootOnly === "true",
    triggeredFrom: queryValue(params, "triggeredFrom"),
    triggeredTo: queryValue(params, "triggeredTo"),
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
    hasAnyRuns: page.hasAnyRuns,
    hasFilters: Object.values(page.filters).some((value) => value === true || (Array.isArray(value) ? value.length > 0 : value !== null && value !== "" && value !== false)),
    polling: page.polling,
  };
}

export function presentRun(run: RunSummary, tableState: string) {
  const params = new URLSearchParams({ tableState });
  return {
    id: run.id,
    path: `/runs/${encodeURIComponent(run.id)}?${params}`,
    jobType: run.name,
    status: run.status,
    queueTarget: run.connection && run.queue ? `${run.connection} / ${run.queue}` : "—",
    traceIdentity: run.traceId,
    attemptCount: run.attemptCount,
    triggeredAt: run.triggeredAt,
    queueDuration: duration(run.queueDurationUs),
    duration: duration(run.durationUs ?? run.activeDurationUs),
  };
}

function duration(microseconds: number | null | undefined) {
  if (microseconds === null || microseconds === undefined) return "—";
  if (microseconds < 1_000) return `${microseconds}µs`;
  const milliseconds = microseconds / 1_000;
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)}s`;
}
