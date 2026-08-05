import type { RunsRouteData } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";
import type { RunSummary, RunsPageDto, RunsQuery } from "./dto";

export function runsQuery(request: Request): RunsQuery {
  const params = new URL(request.url).searchParams;
  const status = params.getAll("status").filter(isStatus);
  const rootOnly = params.get("rootOnly");

  return compact({
    cursor: value(params, "cursor"),
    search: value(params, "search"),
    status: status.length > 0 ? status : undefined,
    job: value(params, "job"),
    connection: value(params, "connection"),
    queue: value(params, "queue"),
    trace: value(params, "trace"),
    rootOnly: rootOnly === null ? undefined : rootOnly === "true",
    triggeredFrom: value(params, "triggeredFrom"),
    triggeredTo: value(params, "triggeredTo"),
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

function presentRun(run: RunSummary, tableState: string) {
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

function value(params: URLSearchParams, key: string) {
  return params.get(key) || undefined;
}

function isStatus(value: string): value is NonNullable<RunsQuery["status"]>[number] {
  return ["queued", "running", "retrying", "completed", "failed"].includes(value);
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
