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

export type PresentedJob = {
  id: string;
  path: string;
  name: string;
  firstObservedAt: string;
  lastObservedAt: string;
  runCount: number;
  statusCounts: JobStatusCounts;
  latestRun: { id: string; status: RunStatus; triggeredAt: string; path: string };
};

export type JobsRouteData = {
  generatedAt: string;
  jobs: PresentedJob[];
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
  activity: JobDetailDto["activity"];
  runs: ReturnType<typeof presentRun>[];
  pagination: { next?: string; previous?: string };
  filters: JobDetailDto["filters"];
  filterOptions: JobDetailDto["options"];
  hasAnyRuns: boolean;
};

export function jobsQuery(request: Request): JobsQuery {
  const params = new URL(request.url).searchParams;
  return compactQuery({ search: queryValue(params, "search"), period: period(params.get("period")) });
}

export function jobRunsQuery(request: Request): JobRunsQuery {
  const params = new URL(request.url).searchParams;
  return compactQuery({
    cursor: queryValue(params, "cursor"),
    status: queryStatuses(params),
    period: period(params.get("period")),
  });
}

export function presentJobs(page: JobsPageDto): JobsRouteData {
  return {
    generatedAt: page.generatedAt,
    jobs: page.jobs.map(presentJob),
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
    queueTargets: page.queueTargets.map((target) => ({ ...target, path: routePath(target.href, "queues") })),
    activity: page.activity,
    runs: page.runs.map((run) => presentRun(run, page.tableState)),
    pagination: {
      previous: page.pagination.previous ?? undefined,
      next: page.pagination.next ?? undefined,
    },
    filters: page.filters,
    filterOptions: page.options,
    hasAnyRuns: page.hasAnyRuns,
  };
}

function presentJob(job: JobsPageDto["jobs"][number]): PresentedJob {
  return {
    ...job,
    path: routePath(job.href, "jobs"),
    latestRun: { ...job.latestRun, path: routePath(job.latestRun.href, "runs") },
  };
}

function routePath(href: string, segment: string) {
  const marker = `/${segment}/`;
  const index = href.indexOf(marker);
  return index >= 0 ? href.slice(index) : href;
}

function period(value: string | null): JobsQuery["period"] {
  return ["1h", "24h", "7d", "30d", "all"].includes(value ?? "") ? value as JobsQuery["period"] : undefined;
}
