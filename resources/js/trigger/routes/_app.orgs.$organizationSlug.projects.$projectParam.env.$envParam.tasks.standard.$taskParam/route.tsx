/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, test, source definition, versions, retries, schedules, deployment, machine, payload, and queue administration are removed.
 */
import { Link, useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import * as Property from "~/components/primitives/PropertyTable";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "~/components/primitives/Resizable";
import { Spinner } from "~/components/primitives/Spinner";
import { TaskRunsTable } from "~/components/runs/v3/TaskRunsTable";
import { allTaskRunStatuses, getRunStatusChartColor } from "~/components/runs/v3/TaskRunStatus";
import { TaskIcon } from "~/assets/icons/TaskIcon";
import { JobFavoriteButton } from "~/components/navigation/JobFavorites";

type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
type JobDetailRouteData = {
  job: {
    id: string;
    name: string;
    firstObservedAt: string;
    lastObservedAt: string;
    runCount: number;
  };
  queueTargets: Array<{ id: string; connection: string; queue: string; path: string }>;
  activity: Array<{ timestamp: string; total: number; statusCounts: Record<RunStatus, number> }>;
  runs: React.ComponentProps<typeof TaskRunsTable>["runs"];
  pagination: { next?: string; previous?: string };
  filterOptions: {
    statuses: RunStatus[];
    timeRanges: Array<{ value: string; label: string }>;
  };
  hasAnyRuns: boolean;
};

export default function JobDetailRoute() {
  const data = useLoaderData() as JobDetailRouteData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value && value !== "all" ? next.set(key, value) : next.delete(key);
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };

  return (
    <PageContainer>
      <NavBar>
        <PageTitle backButton={{ to: "/jobs", text: "Jobs" }} title={<><TaskIcon className="size-4 text-tasks" /><span className="max-w-[50vw] truncate">{shortName(data.job.name)}</span></>} />
        <JobFavoriteButton id={data.job.id} label={shortName(data.job.name)} path={`/jobs/${data.job.id}`} />
      </NavBar>
      <PageBody scrollable={false} className="p-0">
        <ResizablePanelGroup orientation="horizontal" className="max-h-full">
          <ResizablePanel id="job-main" min="300px">
            <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
              <div aria-label="Job Run filters" className="flex h-10 items-center gap-2 border-b border-grid-dimmed bg-background-bright px-2">
                <select aria-label="Run status" className="h-7 rounded border border-grid-bright bg-background-bright px-2 text-xs text-text-bright" value={searchParams.get("status") ?? ""} onChange={(event) => update("status", event.currentTarget.value)}>
                  <option value="">All statuses</option>
                  {data.filterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select aria-label="Time range" className="h-7 rounded border border-grid-bright bg-background-bright px-2 text-xs text-text-bright" value={searchParams.get("period") ?? "all"} onChange={(event) => update("period", event.currentTarget.value)}>
                  {data.filterOptions.timeRanges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <ResizablePanelGroup orientation="vertical" className="max-h-full">
                <ResizablePanel id="job-activity" min="220px" default="320px">
                  <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background p-2" aria-labelledby="job-activity-heading">
                    <h2 id="job-activity-heading" className="mb-2 font-medium text-text-bright">Run activity</h2>
                    <ActivityChart activity={data.activity} />
                  </section>
                </ResizablePanel>
                <ResizableHandle id="job-activity-handle" />
                <ResizablePanel id="job-runs" min="160px">
                  <section className="grid h-full grid-rows-[auto_1fr] overflow-hidden" aria-labelledby="job-runs-heading">
                    <div className="flex h-10 items-center justify-between border-b border-grid-dimmed bg-background-bright px-3"><h2 id="job-runs-heading" className="font-medium text-text-bright">Runs</h2><ListPagination list={data} /></div>
                    <div className="relative min-h-0 overflow-hidden">
                      {data.runs.length > 0 ? <TaskRunsTable runs={data.runs} isLoading={navigation.state !== "idle"} /> : <RunsEmpty filtered={data.hasAnyRuns} />}
                      {navigation.state !== "idle" && data.runs.length === 0 ? <div aria-label="Loading Job" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div> : null}
                    </div>
                  </section>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
          <ResizableHandle id="job-detail-handle" />
          <ResizablePanel id="job-detail" min="280px" default="380px" max="500px" isStaticAtRest>
            <JobSidebar data={data} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </PageBody>
    </PageContainer>
  );
}

function ActivityChart({ activity }: { activity: JobDetailRouteData["activity"] }) {
  const peak = Math.max(1, ...activity.map((point) => point.total));
  if (activity.length === 0) return <div className="grid flex-1 place-items-center text-sm text-text-dimmed">No activity in this time range.</div>;
  return (
    <div role="img" aria-label="Recorded Runs by status over time" className="flex min-h-0 flex-1 items-end gap-1 border-b border-l border-grid-bright px-2 pt-4">
      {activity.map((point) => (
        <div key={point.timestamp} title={`${point.timestamp}: ${point.total} Runs`} className="flex h-full min-w-2 flex-1 flex-col-reverse justify-start">
          {allTaskRunStatuses.map((status) => point.statusCounts[status] > 0 ? (
            <span
              key={status}
              data-status={status}
              className="w-full"
              style={{ backgroundColor: getRunStatusChartColor(status), height: `${Math.max(3, point.statusCounts[status] / peak * 100)}%` }}
            />
          ) : null)}
        </div>
      ))}
    </div>
  );
}

function JobSidebar({ data }: { data: JobDetailRouteData }) {
  return (
    <aside className="grid h-full grid-rows-[auto_1fr] overflow-hidden bg-background-bright" aria-label="Job details">
      <div className="flex min-w-0 items-center gap-2 border-b border-grid-dimmed px-3 py-2"><TaskIcon className="size-4 shrink-0 text-tasks" /><h2 className="truncate font-medium text-text-bright">{data.job.name}</h2></div>
      <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <Property.Table>
          <Property.Item><Property.Label>Observed Job type</Property.Label><Property.Value><span className="break-all font-mono text-xs">{data.job.name}</span></Property.Value></Property.Item>
          <Property.Item><Property.Label>First observed</Property.Label><Property.Value><DateTimeShort date={data.job.firstObservedAt} /></Property.Value></Property.Item>
          <Property.Item><Property.Label>Last observed</Property.Label><Property.Value><DateTimeShort date={data.job.lastObservedAt} /></Property.Value></Property.Item>
          <Property.Item><Property.Label>Recorded Runs</Property.Label><Property.Value>{data.job.runCount.toLocaleString()}</Property.Value></Property.Item>
          <Property.Item><Property.Label>Queue targets</Property.Label><Property.Value>{data.queueTargets.length > 0 ? <div className="flex flex-col gap-1">{data.queueTargets.map((target) => <Link key={target.id} to={target.path} className="rounded text-text-bright hover:underline focus-custom">{target.connection} / {target.queue}</Link>)}</div> : "—"}</Property.Value></Property.Item>
        </Property.Table>
      </div>
    </aside>
  );
}

function RunsEmpty({ filtered }: { filtered: boolean }) {
  return <div className="grid h-full min-h-32 place-items-center text-center"><div><h3 className="font-medium text-text-bright">{filtered ? "No matching Runs" : "No Runs yet"}</h3><p className="mt-1 text-sm text-text-dimmed">{filtered ? "Change or clear filters to see more Runs." : "Confirmed Runs will appear here."}</p></div></div>;
}

export function JobDetailErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "The Job type could not be loaded.";
  return <PageContainer><NavBar><PageTitle backButton={{ to: "/jobs", text: "Jobs" }} title="Job" /></NavBar><PageBody className="grid place-items-center"><div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center"><h1 className="font-medium text-text-bright">Unable to load Job</h1><p className="mt-1 text-sm text-text-dimmed">{message}</p></div></PageBody></PageContainer>;
}

function shortName(name: string) {
  return name.split("\\").at(-1) ?? name;
}
