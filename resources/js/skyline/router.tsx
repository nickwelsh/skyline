import { Navigate, createBrowserRouter, type LoaderFunctionArgs } from "react-router-dom";
import { HttpAdapter } from "./HttpAdapter";
import { presentRuns, runsQuery } from "./RunListAdapter";
import { presentRunDetail } from "./RunDetailAdapter";
import type { SkylineBootstrap, SkylineDtoAdapter } from "./dto";
import { BrandMark } from "./BrandMark";
import { TriggerShell } from "../trigger/root";
import RunsRoute, { RunsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";
import RunDetailRoute, { RunDetailErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route";

export function createSkylineRouter(bootstrap: SkylineBootstrap, adapter: SkylineDtoAdapter = new HttpAdapter(bootstrap.basePath)) {
  const runsLoader = async ({ request }: LoaderFunctionArgs) => presentRuns(await adapter.runs(runsQuery(request)));
  const runDetailLoader = async ({ params, request }: LoaderFunctionArgs) => {
    const runId = params.runId;
    if (!runId) throw new Response("The Run was not found.", { status: 404 });
    const tableState = new URL(request.url).searchParams.get("tableState") ?? undefined;
    return presentRunDetail(
      await adapter.trace(runId, tableState),
      (nodeId, signal) => adapter.inspector(nodeId, runId, signal),
    );
  };

  return createBrowserRouter([
    {
      path: "/",
      element: <TriggerShell applicationName={bootstrap.applicationName} brandMark={<BrandMark />} environmentLabel={bootstrap.environmentLabel} />,
      children: [
        { index: true, element: <Navigate to="runs" replace /> },
        { path: "runs", loader: runsLoader, element: <RunsRoute />, errorElement: <RunsErrorBoundary /> },
        { path: "runs/:runId", loader: runDetailLoader, element: <RunDetailRoute />, errorElement: <RunDetailErrorBoundary /> },
      ],
    },
  ], { basename: bootstrap.basePath });
}
