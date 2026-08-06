import { Navigate, createBrowserRouter, type LoaderFunctionArgs } from "react-router-dom";
import { HttpAdapter } from "./HttpAdapter";
import { presentRuns, runsQuery } from "./RunListAdapter";
import { presentRunDetail } from "./RunDetailAdapter";
import { jobRunsQuery, jobsQuery, presentJobDetail, presentJobs } from "./JobsAdapter";
import { presentQueueTarget, presentQueueTargets, queueTargetQuery, queueTargetsQuery } from "./QueueTargetAdapter";
import { errorGroupsQuery, errorOccurrencesQuery, presentErrorGroupDetail, presentErrorGroups } from "./ErrorGroupsAdapter";
import { presentTelemetryEventDetail, presentTelemetryEvents, telemetryEventsQuery } from "./TelemetryEventsAdapter";
import { SkylineApiError } from "./HttpAdapter";
import type { SkylineBootstrap, SkylineDtoAdapter } from "./dto";
import { BrandMark } from "./BrandMark";
import { TriggerShell } from "../trigger/root";
import RunsRoute, { RunsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";
import RunDetailRoute, { RunDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route";
import JobsRoute, { JobsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route";
import JobDetailRoute, { JobDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route";
import QueuesRoute, { QueuesErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route";
import QueueDetailRoute, { QueueDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route";
import ErrorsRoute, { ErrorsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route";
import ErrorDetailRoute, { ErrorDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route";
import LogsRoute, { LogsErrorBoundary, type LogsRouteData } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.logs/route";

export function createSkylineRouter(bootstrap: SkylineBootstrap, adapter: SkylineDtoAdapter = new HttpAdapter(bootstrap.basePath)) {
  const runsLoader = async ({ request }: LoaderFunctionArgs) => presentRuns(await adapter.runs(runsQuery(request)));
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
    if (!eventId) return { ...list, selected: null };

    try {
      return { ...list, selected: { state: "found", data: presentTelemetryEventDetail(await adapter.telemetryEvent(eventId)) } };
    } catch (error) {
      const notFound = error instanceof SkylineApiError && error.status === 404;
      return { ...list, selected: { state: notFound ? "not-found" : "error", message: error instanceof Error ? error.message : "Telemetry-event detail could not be loaded." } };
    }
  };

  return createBrowserRouter([
    {
      path: "/",
      element: <TriggerShell applicationName={bootstrap.applicationName} brandMark={<BrandMark />} environmentLabel={bootstrap.environmentLabel} capabilities={bootstrap.capabilities.navigation} />,
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
