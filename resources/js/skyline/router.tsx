import { Navigate, createBrowserRouter, type LoaderFunctionArgs } from "react-router-dom";
import { HttpAdapter } from "./HttpAdapter";
import { presentRuns, runsQuery } from "./RunListAdapter";
import type { SkylineBootstrap, SkylineDtoAdapter } from "./dto";
import { TriggerShell } from "../trigger/root";
import RunsRoute, { RunsErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route";

export function createSkylineRouter(bootstrap: SkylineBootstrap, adapter: SkylineDtoAdapter = new HttpAdapter(bootstrap.basePath)) {
  const runsLoader = async ({ request }: LoaderFunctionArgs) => presentRuns(await adapter.runs(runsQuery(request)));

  return createBrowserRouter([
    {
      path: "/",
      element: <TriggerShell applicationName={bootstrap.applicationName} environmentLabel={bootstrap.environmentLabel} />,
      children: [
        { index: true, element: <Navigate to="runs" replace /> },
        { path: "runs", loader: runsLoader, element: <RunsRoute />, errorElement: <RunsErrorBoundary /> },
        { path: "runs/:runId", element: <div className="grid h-full place-items-center text-text-dimmed">Loading Run…</div> },
      ],
    },
  ], { basename: bootstrap.basePath });
}
