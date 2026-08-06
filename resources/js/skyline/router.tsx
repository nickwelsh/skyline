import { Navigate, createBrowserRouter, redirect, type LoaderFunctionArgs } from "react-router-dom";
import { HttpAdapter } from "./HttpAdapter";
import { presentRuns, runsQuery } from "./RunListAdapter";
import { presentRunDetail } from "./RunDetailAdapter";
import { jobRunsQuery, jobsQuery, presentJobDetail, presentJobs } from "./JobsAdapter";
import { presentQueueTarget, presentQueueTargets, queueTargetQuery, queueTargetsQuery } from "./QueueTargetAdapter";
import { errorGroupsQuery, errorOccurrencesQuery, presentErrorGroupDetail, presentErrorGroups } from "./ErrorGroupsAdapter";
import { presentTelemetryEventDetail, presentTelemetryEvents, telemetryEventsQuery } from "./TelemetryEventsAdapter";
import { TelemetryEventDetailView, TelemetryEventsTable } from "./TelemetryEventsView";
import { SkylineApiError } from "./HttpAdapter";
import type { SkylineBootstrap, SkylineDtoAdapter } from "./dto";
import { SkylineShell } from "./SkylineShell";
import type { UiPreferencesAdapter } from "./UiPreferencesAdapter";
import RunsRoute, { RunsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";
import RunDetailRoute, { RunDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route";
import JobsRoute, { JobsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route";
import JobDetailRoute, { JobDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route";
import QueuesRoute, { QueuesErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route";
import QueueDetailRoute, { QueueDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route";
import ErrorsRoute, { ErrorsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route";
import ErrorDetailRoute, { ErrorDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route";
import LogsRoute, { LogsErrorBoundary, type LogsRouteData } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.logs/route";

export function createSkylineRouter(bootstrap: SkylineBootstrap, adapter: SkylineDtoAdapter = new HttpAdapter(bootstrap.basePath), preferences?: UiPreferencesAdapter) {
  const runsLoader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const rootOnly = url.searchParams.get("rootOnly");
    const jobFiltered = url.searchParams.has("job");
    if (!jobFiltered && rootOnly === null && preferences?.read().runs.rootOnly) {
      url.searchParams.set("rootOnly", "true");
      const routePath = url.pathname.startsWith(bootstrap.basePath)
        ? url.pathname.slice(bootstrap.basePath.length) || "/"
        : url.pathname;
      throw redirect(`${routePath}${url.search}`);
    }
    if (!jobFiltered && rootOnly !== null && preferences) {
      preferences.update((current) => ({ ...current, runs: { rootOnly: rootOnly === "true" } }));
    }
    return presentRuns(await adapter.runs(runsQuery(request)));
  };
  const jobsLoader = async ({ request }: LoaderFunctionArgs) => presentJobs(await adapter.jobs(jobsQuery(request)));
  const jobLoader = async ({ params, request }: LoaderFunctionArgs) => {
    if (!params.jobId) throw new Response("The Job type was not found.", { status: 404 });
    return presentJobDetail(await adapter.job(params.jobId, jobRunsQuery(request)));
  };
  const queuesLoader = async ({ request }: LoaderFunctionArgs) => presentQueueTargets(await adapter.queueTargets(queueTargetsQuery(request)));
  const queueLoader = async ({ params, request }: LoaderFunctionArgs) => {
    if (!params.queueId) throw new Response("The Queue target was not found.", { status: 404 });
    return presentQueueTarget(await adapter.queueTarget(params.queueId, queueTargetQuery(request)));
  };
  const runDetailLoader = async ({ params, request }: LoaderFunctionArgs) => {
    const runId = params.runId;
    if (!runId) throw new Response("The Run was not found.", { status: 404 });
    const tableState = new URL(request.url).searchParams.get("tableState") ?? undefined;
    return presentRunDetail(
      await adapter.trace(runId, tableState),
      (nodeId, signal) => adapter.inspector(nodeId, runId, signal),
    );
  };
  const errorsLoader = async ({ request }: LoaderFunctionArgs) => presentErrorGroups(await adapter.errorGroups(errorGroupsQuery(request)));
  const errorLoader = async ({ params, request }: LoaderFunctionArgs) => {
    if (!params.errorId) throw new Response("The Error group was not found.", { status: 404 });
    return presentErrorGroupDetail(await adapter.errorGroup(params.errorId, errorOccurrencesQuery(request)));
  };
  const logsLoader = async ({ request }: LoaderFunctionArgs): Promise<LogsRouteData> => {
    const list = presentTelemetryEvents(await adapter.telemetryEvents(telemetryEventsQuery(request)));
    const eventId = new URL(request.url).searchParams.get("event");
    return {
      ...list,
      selectedSummary: eventId ? list.telemetryEvents.find((event) => event.id === eventId) ?? null : null,
      renderTable: (props) => <TelemetryEventsTable events={list.telemetryEvents} {...props} hasAnyEvents={list.hasAnyTelemetryEvents} hasFilters={list.hasFilters} hasMore={Boolean(list.pagination.next || list.pagination.previous)} />,
      loadDetail: async (id, signal) => {
        try {
          const detail = presentTelemetryEventDetail(await adapter.telemetryEvent(id, signal));
          return { state: "found" as const, data: { render: (onClose: () => void) => <TelemetryEventDetailView event={detail.telemetryEvent} onClose={onClose} /> } };
        } catch (error) {
          if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
          const notFound = error instanceof SkylineApiError && error.status === 404;
          return { state: (notFound ? "not-found" : "error") as "not-found" | "error", message: error instanceof Error ? error.message : "Telemetry-event detail could not be loaded." };
        }
      },
    };
  };

  return createBrowserRouter([
    {
      path: "/",
      element: <SkylineShell bootstrap={bootstrap} />,
      children: [
        { index: true, element: <Navigate to="runs" replace /> },
        { path: "jobs", loader: jobsLoader, element: <JobsRoute />, errorElement: <JobsErrorBoundary /> },
        { path: "jobs/:jobId", loader: jobLoader, element: <JobDetailRoute />, errorElement: <JobDetailErrorBoundary /> },
        { path: "runs", loader: runsLoader, element: <RunsRoute />, errorElement: <RunsErrorBoundary /> },
        { path: "runs/:runId", loader: runDetailLoader, element: <RunDetailRoute />, errorElement: <RunDetailErrorBoundary /> },
        { path: "queues", loader: queuesLoader, element: <QueuesRoute />, errorElement: <QueuesErrorBoundary /> },
        { path: "queues/:queueId", loader: queueLoader, element: <QueueDetailRoute />, errorElement: <QueueDetailErrorBoundary /> },
        { path: "errors", loader: errorsLoader, element: <ErrorsRoute />, errorElement: <ErrorsErrorBoundary /> },
        { path: "errors/:errorId", loader: errorLoader, element: <ErrorDetailRoute />, errorElement: <ErrorDetailErrorBoundary /> },
        { path: "logs", loader: logsLoader, element: <LogsRoute />, errorElement: <LogsErrorBoundary /> },
      ],
    },
  ], { basename: bootstrap.basePath });
}
