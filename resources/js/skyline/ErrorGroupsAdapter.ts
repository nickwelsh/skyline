import type {
  ErrorGroupDetailDto,
  ErrorGroupsPageDto,
  ErrorGroupsQuery,
  ErrorOccurrencesQuery,
} from "./dto";
import type { PresentedRun } from "../trigger/components/runs/v3/TaskRunsTable";
import { formatDuration } from "../trigger/utils/durations";
import { compactQuery, queryValue } from "./QueryParams";
import { canonicalRoutePath } from "./RoutePath";

export type PresentedErrorGroup = Omit<ErrorGroupsPageDto["errorGroups"][number], "href" | "jobHref" | "latest"> & {
  friendlyId: string;
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
  activity: ErrorActivity;
  failedAttempts: Array<Omit<ErrorGroupDetailDto["failedAttempts"][number], "runHref" | "attemptHref"> & { runPath: string; attemptPath: string }>;
  failedRuns: PresentedRun[];
  pagination: { next?: string; previous?: string };
  filters: ErrorGroupDetailDto["filters"];
  filterOptions: ErrorGroupDetailDto["options"];
  hasAnyOccurrences: boolean;
  canViewVersions: false;
  canViewMachines: false;
  canBulkReplay: false;
  affectedVersions: [];
  viewAllRunsPath: string;
};

export type ErrorActivity = {
  data: Array<{ bucket: number; occurrences: number }>;
  range: { from: number; to: number };
};

export function errorGroupsQuery(request: Request): ErrorGroupsQuery {
  const params = new URL(request.url).searchParams;
  const from = queryValue(params, "from");
  const to = queryValue(params, "to");
  const requestedPeriod = params.get("period");
  return compactQuery({
    search: queryValue(params, "search"),
    jobType: queryValue(params, "tasks") ?? queryValue(params, "jobType"),
    exceptionClass: queryValue(params, "exceptionClass"),
    period: from || to ? undefined : requestedPeriod === null ? "24h" : period(requestedPeriod),
    from,
    to,
    cursor: queryValue(params, "cursor"),
  });
}

export function errorOccurrencesQuery(request: Request): ErrorOccurrencesQuery {
  const params = new URL(request.url).searchParams;
  const from = queryValue(params, "from");
  const to = queryValue(params, "to");
  const requestedPeriod = params.get("period");
  return compactQuery({
    period: from || to ? undefined : requestedPeriod === null ? "7d" : period(requestedPeriod),
    from,
    to,
    cursor: queryValue(params, "cursor"),
  });
}

export function presentErrorGroups(page: ErrorGroupsPageDto, request?: Request): ErrorGroupsRouteData {
  const params = new URL(request?.url ?? "https://skyline.invalid/errors").searchParams;
  return {
    generatedAt: page.generatedAt,
    errorGroups: page.errorGroups.map((group) => presentErrorGroup(group, page.generatedAt)),
    pagination: pagination(page.pagination),
    filters: page.filters,
    filterOptions: page.options,
    hasAnyErrorGroups: page.hasAnyErrorGroups,
    hasFilters: page.filters.search !== null
      || page.filters.jobType !== null
      || page.filters.exceptionClass !== null
      || page.filters.from !== null
      || page.filters.to !== null
      || params.has("period"),
  };
}

export function presentErrorGroupDetail(page: ErrorGroupDetailDto): ErrorGroupDetailRouteData {
  return {
    generatedAt: page.generatedAt,
    errorGroup: presentErrorGroup(page.errorGroup),
    representative: page.representative,
    activity: presentErrorActivity(page.activity, page.activityRange),
    failedAttempts: page.failedAttempts.map(({ runHref, attemptHref, ...attempt }) => ({
      ...attempt,
      runPath: canonicalRoutePath(runHref, "runs"),
      attemptPath: canonicalRoutePath(attemptHref, "runs"),
    })),
    failedRuns: page.failedAttempts.map((attempt) => presentFailedRun(attempt)),
    pagination: pagination(page.pagination),
    filters: page.filters,
    filterOptions: page.options,
    hasAnyOccurrences: page.hasAnyOccurrences,
    canViewVersions: false,
    canViewMachines: false,
    canBulkReplay: false,
    affectedVersions: [],
    viewAllRunsPath: "/runs",
  };
}

function presentErrorActivity(activity: ErrorGroupDetailDto["activity"], range: ErrorGroupDetailDto["activityRange"]): ErrorActivity {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  if (activity.length === 0) return { data: [], range: { from, to } };

  const slots = 48;
  const data = Array.from({ length: slots + 1 }, (_, index) => ({
    bucket: from + ((to - from) * index) / slots,
    occurrences: 0,
  }));
  for (const point of activity) {
    const ratio = (Date.parse(point.timestamp) - from) / (to - from);
    const index = Math.max(0, Math.min(slots, Math.floor(ratio * slots)));
    data[index].occurrences += point.occurrences;
  }

  return { data, range: { from, to } };
}

function presentFailedRun(attempt: ErrorGroupDetailDto["failedAttempts"][number]): PresentedRun {
  return {
    id: attempt.runId,
    friendlyId: attempt.runId,
    path: canonicalRoutePath(attempt.attemptHref, "runs"),
    isRoot: true,
    jobType: attempt.jobType,
    version: null,
    machine: null,
    status: "failed",
    queueTarget: attempt.queue ?? "—",
    queue: attempt.queue ? {
      connection: attempt.connection,
      name: attempt.queue,
      type: attempt.queue.startsWith("task/") ? "task" : "custom",
    } : null,
    startedAt: attempt.startedAt,
    queueDuration: formatDuration(new Date(attempt.triggeredAt), new Date(attempt.startedAt), { style: "short" }),
    duration: formatDuration(new Date(attempt.startedAt), new Date(attempt.finishedAt ?? attempt.observedAt), { style: "short" }),
  };
}

function presentErrorGroup({ href, jobHref, latest, ...group }: ErrorGroupsPageDto["errorGroups"][number], activityEnd?: string): PresentedErrorGroup {
  const { runHref, attemptHref, ...latestData } = latest;
  return {
    ...group,
    activity: activityEnd ? hourlyActivity(group.activity, activityEnd) : group.activity,
    friendlyId: `error_${group.fingerprint}`,
    path: canonicalRoutePath(href, "errors"),
    jobPath: canonicalRoutePath(jobHref, "jobs"),
    latest: {
      ...latestData,
      runPath: canonicalRoutePath(runHref, "runs"),
      attemptPath: canonicalRoutePath(attemptHref, "runs"),
    },
  };
}

function hourlyActivity(activity: PresentedErrorGroup["activity"], end: string): PresentedErrorGroup["activity"] {
  const hour = 3_600_000;
  const endAt = Math.floor(Date.parse(end) / hour) * hour;
  const observed = new Map(activity.map((point) => [Date.parse(point.timestamp), point]));

  return Array.from({ length: 24 }, (_, index) => {
    const timestamp = endAt - (23 - index) * hour;
    return observed.get(timestamp) ?? { timestamp: new Date(timestamp).toISOString(), occurrences: 0 };
  });
}

function pagination(value: { next: string | null; previous: string | null }) {
  return { previous: value.previous ?? undefined, next: value.next ?? undefined };
}

function period(value: string | null): ErrorGroupsQuery["period"] {
  return value && /^(?:[1-9][0-9]{0,5}[mhd]|all)$/.test(value) ? value : undefined;
}
