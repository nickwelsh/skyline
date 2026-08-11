import type {
  TelemetryEventDetail,
  TelemetryEventDetailDto,
  TelemetryEventsPageDto,
  TelemetryEventsQuery,
  TelemetryEventSummary,
} from "./dto";
import { compactQuery, queryValue } from "./QueryParams";
import { canonicalRoutePath } from "./RoutePath";

type PresentedLinks = {
  path: string;
  runPath: string;
  attemptPath: string | null;
  jobPath: string;
  operationPath?: string;
};
type PresentedOperation = Omit<Extract<TelemetryEventSummary, { variant: "operation" }>, "href" | "runHref" | "attemptHref" | "jobHref" | "operationHref"> & PresentedLinks & { operationPath: string };
type PresentedLog = Omit<Extract<TelemetryEventSummary, { variant: "log" }>, "href" | "runHref" | "attemptHref" | "jobHref"> & Omit<PresentedLinks, "operationPath">;
export type PresentedTelemetryEvent = PresentedOperation | PresentedLog;
type PresentedOperationDetail = Omit<Extract<TelemetryEventDetail, { variant: "operation" }>, "href" | "runHref" | "attemptHref" | "jobHref" | "operationHref" | "errorHref"> & PresentedLinks & { operationPath: string; errorPath: string | null };
type PresentedLogDetail = Omit<Extract<TelemetryEventDetail, { variant: "log" }>, "href" | "runHref" | "attemptHref" | "jobHref" | "errorHref"> & Omit<PresentedLinks, "operationPath"> & { errorPath: string | null };
export type PresentedTelemetryEventDetail = PresentedOperationDetail | PresentedLogDetail;

export type TelemetryEventsRouteData = Omit<TelemetryEventsPageDto, "telemetryEvents" | "pagination" | "options"> & {
  telemetryEvents: PresentedTelemetryEvent[];
  pagination: { next?: string; previous?: string };
  filterOptions: TelemetryEventsPageDto["options"];
  hasFilters: boolean;
};

export type TelemetryEventDetailRouteData = {
  generatedAt: string;
  telemetryEvent: PresentedTelemetryEventDetail;
  capture: TelemetryEventDetailDto["capture"];
};

export function telemetryEventsQuery(request: Request): TelemetryEventsQuery {
  const params = new URL(request.url).searchParams;
  const levels = params.getAll("levels").filter(isLevel);
  const from = instant(params.get("from"));
  const to = instant(params.get("to"));
  const hasTimeBounds = from !== undefined || to !== undefined;

  return compactQuery({
    search: queryValue(params, "search"),
    levels: levels.length > 0 ? levels : undefined,
    jobType: queryValue(params, "tasks") ?? queryValue(params, "jobType"),
    runId: queryValue(params, "runId"),
    period: hasTimeBounds ? undefined : period(params.get("period")),
    from,
    to,
    cursor: queryValue(params, "cursor"),
  });
}

export function presentTelemetryEvents(page: TelemetryEventsPageDto): TelemetryEventsRouteData {
  return {
    ...page,
    telemetryEvents: page.telemetryEvents.map(presentSummary),
    pagination: pagination(page.pagination),
    filterOptions: page.options,
    hasFilters: page.filters.search !== null || page.filters.levels.length > 0 || page.filters.jobType !== null || page.filters.runId !== null || page.filters.period !== "1h" || page.filters.from !== null || page.filters.to !== null,
  };
}

export function presentTelemetryEventDetail(page: TelemetryEventDetailDto): TelemetryEventDetailRouteData {
  const event = page.telemetryEvent;
  const errorPath = event.errorHref ? canonicalRoutePath(event.errorHref, "errors") : null;

  return {
    generatedAt: page.generatedAt,
    telemetryEvent: event.variant === "operation"
      ? { ...stripOperationLinks(event), ...presentOperationSummary(event), errorPath }
      : { ...stripLogLinks(event), ...presentLogSummary(event), errorPath },
    capture: page.capture,
  };
}

function stripOperationLinks(event: Extract<TelemetryEventDetail, { variant: "operation" }>) {
  const { href: _href, runHref: _runHref, attemptHref: _attemptHref, jobHref: _jobHref, operationHref: _operationHref, errorHref: _errorHref, ...detail } = event;
  return detail;
}

function stripLogLinks(event: Extract<TelemetryEventDetail, { variant: "log" }>) {
  const { href: _href, runHref: _runHref, attemptHref: _attemptHref, jobHref: _jobHref, errorHref: _errorHref, ...detail } = event;
  return detail;
}

function presentSummary(event: TelemetryEventSummary): PresentedTelemetryEvent {
  return event.variant === "operation"
    ? presentOperationSummary(event)
    : presentLogSummary(event);
}

function presentOperationSummary(event: Extract<TelemetryEventSummary, { variant: "operation" }>): PresentedOperation {
  const { href: _href, runHref: _runHref, attemptHref: _attemptHref, jobHref: _jobHref, operationHref, ...summary } = event;
  return { ...summary, ...presentPaths(event), operationPath: canonicalRoutePath(operationHref, "runs") };
}

function presentLogSummary(event: Extract<TelemetryEventSummary, { variant: "log" }>): PresentedLog {
  const { href: _href, runHref: _runHref, attemptHref: _attemptHref, jobHref: _jobHref, ...summary } = event;
  return { ...summary, ...presentPaths(event) };
}

function presentPaths(event: Pick<TelemetryEventSummary, "href" | "runHref" | "attemptHref" | "jobHref">): Omit<PresentedLinks, "operationPath"> {
  return {
    path: canonicalRoutePath(event.href, "logs"),
    runPath: canonicalRoutePath(event.runHref, "runs"),
    attemptPath: event.attemptHref ? canonicalRoutePath(event.attemptHref, "runs") : null,
    jobPath: canonicalRoutePath(event.jobHref, "jobs"),
  };
}

function pagination(value: { next: string | null; previous: string | null }) {
  return { previous: value.previous ?? undefined, next: value.next ?? undefined };
}

function isLevel(value: string): value is NonNullable<TelemetryEventsQuery["levels"]>[number] {
  return ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"].includes(value);
}

function period(value: string | null): TelemetryEventsQuery["period"] {
  return value === "all" || /^[1-9][0-9]{0,5}[mhd]$/.test(value ?? "") ? value ?? undefined : undefined;
}

function instant(value: string | null): string | undefined {
  return value && /^[1-9][0-9]{0,15}$/.test(value) ? value : undefined;
}
