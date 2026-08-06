import type {
  ErrorGroupDetailDto,
  ErrorGroupsPageDto,
  ErrorGroupsQuery,
  ErrorOccurrencesQuery,
} from "./dto";
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
    pagination: pagination(page.pagination),
    filters: page.filters,
    filterOptions: page.options,
    hasAnyOccurrences: page.hasAnyOccurrences,
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
