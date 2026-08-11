import type {
  JobDetailDto,
  JobRunsQuery,
  JobsPageDto,
  JobsQuery,
  JobStatusCounts,
  RunStatus,
  TimeRangeOption,
} from "./dto";
import { presentRun } from "./RunListAdapter";
import { compactQuery, queryStatuses, queryValue } from "./QueryParams";
import { canonicalRoutePath } from "./RoutePath";

export type PresentedJob = {
  id: string;
  path: string;
  name: string;
  displayName: string;
  identifier: string;
  firstObservedAt: string;
  lastObservedAt: string;
  runCount: number;
  statusCounts: JobStatusCounts;
  activity: JobDetailDto["activity"];
  latestRun: { id: string; status: RunStatus; triggeredAt: string; path: string };
};

export type JobsRouteData = {
  generatedAt: string;
  jobs: PresentedJob[];
  pagination: { next?: string; previous?: string };
  filters: JobsPageDto["filters"];
  timeRanges: TimeRangeOption[];
  hasAnyJobs: boolean;
  hasFilters: boolean;
  jobGuidance: boolean;
  testJob: boolean;
};

export type JobDetailRouteData = {
  generatedAt: string;
  job: PresentedJob;
  queueTargets: Array<{ id: string; connection: string; queue: string; runCount: number; path: string }>;
  activity: JobActivity;
  definition: JobDetailDto["definition"];
  runs: ReturnType<typeof presentRun>[];
  pagination: { next?: string; previous?: string };
  filters: JobDetailDto["filters"];
  filterOptions: JobDetailDto["options"];
  hasAnyRuns: boolean;
};

export const jobActivityStatuses = ["COMPLETED", "FAILED", "CANCELED", "RUNNING"] as const;

export type JobActivity = {
  data: Array<{
    bucket: number;
    COMPLETED: number;
    FAILED: number;
    CANCELED: number;
    RUNNING: number;
  }>;
  statuses: [...typeof jobActivityStatuses];
  range: { from: number; to: number };
};

export function jobsQuery(request: Request): JobsQuery {
  const params = new URL(request.url).searchParams;
  return compactQuery({ search: queryValue(params, "search"), cursor: queryValue(params, "cursor") });
}

export function jobRunsQuery(request: Request): JobRunsQuery {
  const params = new URL(request.url).searchParams;
  const from = queryValue(params, "from");
  const to = queryValue(params, "to");
  return compactQuery({
    cursor: queryValue(params, "cursor"),
    status: queryStatuses(params),
    period: from || to ? undefined : period(params.get("period")) ?? "7d",
    from,
    to,
  });
}

export function presentJobs(page: JobsPageDto): JobsRouteData {
  return {
    generatedAt: page.generatedAt,
    jobs: page.jobs.map((job) => presentJob(job, page.generatedAt)),
    pagination: {
      previous: page.pagination.previous ?? undefined,
      next: page.pagination.next ?? undefined,
    },
    filters: page.filters,
    timeRanges: page.options.timeRanges,
    hasAnyJobs: page.hasAnyJobs,
    hasFilters: page.filters.search !== null || page.filters.period !== "all",
    jobGuidance: page.capabilities.shell.jobGuidance,
    testJob: page.capabilities.jobs.testJob,
  };
}

export function presentJobDetail(page: JobDetailDto): JobDetailRouteData {
  return {
    generatedAt: page.generatedAt,
    job: presentJob(page.job),
    queueTargets: page.queueTargets.map((target) => ({ ...target, path: canonicalRoutePath(target.href, "queues") })),
    activity: presentJobActivity(page.activity, page.activityRange),
    definition: page.definition,
    runs: page.runs.map((run) => ({ ...presentRun(run, page.tableState), taskIdentifier: shortName(run.name) })),
    pagination: {
      previous: page.pagination.previous ?? undefined,
      next: page.pagination.next ?? undefined,
    },
    filters: page.filters,
    filterOptions: page.options,
    hasAnyRuns: page.hasAnyRuns,
  };
}

function presentJobActivity(activity: JobDetailDto["activity"], range: JobDetailDto["activityRange"]): JobActivity {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  if (activity.length === 0) {
    return { data: [], statuses: [...jobActivityStatuses], range: { from, to } };
  }
  const slots = 48;
  const data = Array.from({ length: slots + 1 }, (_, index) => ({
    bucket: from + ((to - from) * index) / slots,
    COMPLETED: 0,
    FAILED: 0,
    CANCELED: 0,
    RUNNING: 0,
  }));
  for (const { timestamp, statusCounts } of activity) {
    const ratio = (Date.parse(timestamp) - from) / (to - from);
    const index = Math.max(0, Math.min(slots, Math.floor(ratio * slots)));
    data[index].COMPLETED += statusCounts.completed;
    data[index].FAILED += statusCounts.failed;
    data[index].RUNNING += statusCounts.queued + statusCounts.running + statusCounts.retrying;
  }

  return {
    data,
    statuses: [...jobActivityStatuses],
    range: { from, to },
  };
}

function presentJob(job: JobsPageDto["jobs"][number], activityEnd?: string): PresentedJob {
  return {
    ...job,
    displayName: job.name.split("\\").at(-1) ?? job.name,
    identifier: job.name,
    activity: activityEnd ? hourlyActivity(job.activity, activityEnd) : job.activity,
    path: canonicalRoutePath(job.href, "jobs"),
    latestRun: { ...job.latestRun, path: canonicalRoutePath(job.latestRun.href, "runs") },
  };
}

function hourlyActivity(activity: PresentedJob["activity"], end: string): PresentedJob["activity"] {
  const hour = 3_600_000;
  const endAt = Math.floor(Date.parse(end) / hour) * hour;
  const observed = new Map(activity.map((point) => [Date.parse(point.timestamp), point]));

  return Array.from({ length: 24 }, (_, index) => {
    const timestamp = endAt - (23 - index) * hour;
    return observed.get(timestamp) ?? {
      timestamp: new Date(timestamp).toISOString(),
      total: 0,
      statusCounts: { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0 },
    };
  });
}

function period(value: string | null): string | undefined {
  return value && /^(?:[1-9][0-9]{0,5}[mhd]|all)$/.test(value) ? value : undefined;
}

function shortName(name: string) { return name.split("\\").at(-1) ?? name; }
