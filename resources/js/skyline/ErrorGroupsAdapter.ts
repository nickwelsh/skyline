import type {
  ErrorGroupDetailDto,
  ErrorGroupsPageDto,
  ErrorGroupsQuery,
  ErrorOccurrencesQuery,
} from "./dto";
import type { PresentedRun } from "../trigger/components/runs/v3/TaskRunsTable";
import { compactQuery, queryValue } from "./QueryParams";

export type PresentedErrorGroup = Omit<ErrorGroupsPageDto["errorGroups"][number], "href" | "jobHref" | "latest"> & {
  path: string;
  jobPath: string;
  latest: Omit<ErrorGroupsPageDto["errorGroups"][number]["latest"], "runHref" | "attemptHref"> & {
    runPath: string;
    attemptPath: string;
  };
};

export type ErrorGroupsRouteData = {
  generatedAt: string;
  errorGroups: PresentedErrorGroup[];
  pagination: { next?: string; previous?: string };
  filters: ErrorGroupsPageDto["filters"];
  filterOptions: ErrorGroupsPageDto["options"];
  hasAnyErrorGroups: boolean;
  hasFilters: boolean;
};

export type ErrorGroupDetailRouteData = {
  generatedAt: string;
  errorGroup: PresentedErrorGroup;
  representative: ErrorGroupDetailDto["representative"];
  activity: ErrorGroupDetailDto["activity"];
  failedAttempts: Array<Omit<ErrorGroupDetailDto["failedAttempts"][number], "runHref" | "attemptHref"> & { runPath: string; attemptPath: string }>;
  failedRuns: PresentedRun[];
  pagination: { next?: string; previous?: string };
  filters: ErrorGroupDetailDto["filters"];
  filterOptions: ErrorGroupDetailDto["options"];
  hasAnyOccurrences: boolean;
};

export function errorGroupsQuery(request: Request): ErrorGroupsQuery {
  const params = new URL(request.url).searchParams;
  return compactQuery({
    jobType: queryValue(params, "jobType"),
    exceptionClass: queryValue(params, "exceptionClass"),
    period: period(params.get("period")),
    cursor: queryValue(params, "cursor"),
  });
}

export function errorOccurrencesQuery(request: Request): ErrorOccurrencesQuery {
  const params = new URL(request.url).searchParams;
  return compactQuery({ period: period(params.get("period")), cursor: queryValue(params, "cursor") });
}

export function presentErrorGroups(page: ErrorGroupsPageDto): ErrorGroupsRouteData {
  return {
    generatedAt: page.generatedAt,
    errorGroups: page.errorGroups.map(presentErrorGroup),
    pagination: pagination(page.pagination),
    filters: page.filters,
    filterOptions: page.options,
    hasAnyErrorGroups: page.hasAnyErrorGroups,
    hasFilters: page.filters.jobType !== null || page.filters.exceptionClass !== null || page.filters.period !== "all",
  };
}

export function presentErrorGroupDetail(page: ErrorGroupDetailDto): ErrorGroupDetailRouteData {
  return {
    generatedAt: page.generatedAt,
    errorGroup: presentErrorGroup(page.errorGroup),
    representative: page.representative,
    activity: page.activity,
    failedAttempts: page.failedAttempts.map(({ runHref, attemptHref, ...attempt }) => ({
      ...attempt,
      runPath: routePath(runHref, "runs"),
      attemptPath: routePath(attemptHref, "runs"),
    })),
    failedRuns: page.failedAttempts.map((attempt) => presentFailedRun(attempt)),
    pagination: pagination(page.pagination),
    filters: page.filters,
    filterOptions: page.options,
    hasAnyOccurrences: page.hasAnyOccurrences,
  };
}

function presentFailedRun(attempt: ErrorGroupDetailDto["failedAttempts"][number]): PresentedRun {
  const durationUs = Math.max(
    0,
    new Date(attempt.finishedAt ?? attempt.observedAt).getTime() - new Date(attempt.startedAt).getTime()
  ) * 1_000;

  return {
    id: attempt.runId,
    path: routePath(attempt.attemptHref, "runs"),
    isRoot: true,
    jobType: attempt.jobType,
    status: "failed",
    queueTarget: "default",
    traceIdentity: `span_${attempt.runId}`,
    attemptCount: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    queueDuration: "—",
    duration: formatDuration(durationUs),
    activeDuration: formatDuration(durationUs),
  };
}

function presentErrorGroup({ href, jobHref, latest, ...group }: ErrorGroupsPageDto["errorGroups"][number]): PresentedErrorGroup {
  const { runHref, attemptHref, ...latestData } = latest;
  return {
    ...group,
    path: routePath(href, "errors"),
    jobPath: routePath(jobHref, "jobs"),
    latest: {
      ...latestData,
      runPath: routePath(runHref, "runs"),
      attemptPath: routePath(attemptHref, "runs"),
    },
  };
}

function pagination(value: { next: string | null; previous: string | null }) {
  return { previous: value.previous ?? undefined, next: value.next ?? undefined };
}

function routePath(href: string, segment: string) {
  const marker = `/${segment}/`;
  const index = href.indexOf(marker);
  return index >= 0 ? href.slice(index) : href;
}

function period(value: string | null): ErrorGroupsQuery["period"] {
  return ["1h", "24h", "7d", "30d", "all"].includes(value ?? "") ? value as ErrorGroupsQuery["period"] : undefined;
}

function formatDuration(microseconds: number): string {
  if (microseconds < 1_000) return `${microseconds}µs`;
  const milliseconds = microseconds / 1_000;
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)}s`;
}
