import type {
  TelemetryEventDetail,
  TelemetryEventDetailDto,
  TelemetryEventsPageDto,
  TelemetryEventsQuery,
  TelemetryEventSummary,
} from "./dto";
import { compactQuery, queryValue } from "./QueryParams";

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

  return compactQuery({
    levels: levels.length > 0 ? levels : undefined,
    jobType: queryValue(params, "jobType"),
    runId: queryValue(params, "runId"),
    period: period(params.get("period")),
    cursor: queryValue(params, "cursor"),
  });
}

export function presentTelemetryEvents(page: TelemetryEventsPageDto): TelemetryEventsRouteData {
  return {
    ...page,
    telemetryEvents: page.telemetryEvents.map(presentSummary),
    pagination: pagination(page.pagination),
    filterOptions: page.options,
    hasFilters: page.filters.levels.length > 0 || page.filters.jobType !== null || page.filters.runId !== null || page.filters.period !== "all",
  };
}

export function presentTelemetryEventDetail(page: TelemetryEventDetailDto): TelemetryEventDetailRouteData {
  const event = page.telemetryEvent;
  const errorPath = event.errorHref ? routePath(event.errorHref, "errors") : null;

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
  return { ...summary, ...presentPaths(event), operationPath: routePath(operationHref, "runs") };
}

function presentLogSummary(event: Extract<TelemetryEventSummary, { variant: "log" }>): PresentedLog {
  const { href: _href, runHref: _runHref, attemptHref: _attemptHref, jobHref: _jobHref, ...summary } = event;
  return { ...summary, ...presentPaths(event) };
}

function presentPaths(event: Pick<TelemetryEventSummary, "href" | "runHref" | "attemptHref" | "jobHref">): Omit<PresentedLinks, "operationPath"> {
  return {
    path: routePath(event.href, "logs"),
    runPath: routePath(event.runHref, "runs"),
    attemptPath: event.attemptHref ? routePath(event.attemptHref, "runs") : null,
    jobPath: routePath(event.jobHref, "jobs"),
  };
}

function pagination(value: { next: string | null; previous: string | null }) {
  return { previous: value.previous ?? undefined, next: value.next ?? undefined };
}

function routePath(href: string, segment: string) {
  const marker = `/${segment}`;
  const index = href.indexOf(marker);
  return index >= 0 ? href.slice(index) : href;
}

function isLevel(value: string): value is NonNullable<TelemetryEventsQuery["levels"]>[number] {
  return ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"].includes(value);
}

function period(value: string | null): TelemetryEventsQuery["period"] {
  return ["1h", "24h", "7d", "30d", "all"].includes(value ?? "") ? value as TelemetryEventsQuery["period"] : undefined;
}
