/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, test, source definition, versions, retries, schedules, deployment, payload, and queue administration are removed.
 */
import { Link, useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TaskIcon } from "~/assets/icons/TaskIcon";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { JobFavoriteButton } from "~/components/navigation/JobFavorites";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTime } from "~/components/primitives/DateTime";
import { Header2 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Paragraph } from "~/components/primitives/Paragraph";
import * as Property from "~/components/primitives/PropertyTable";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "~/components/primitives/Resizable";
import { Spinner } from "~/components/primitives/Spinner";
import { ChartCard } from "~/components/primitives/charts/ChartCard";
import { TaskRunsTable } from "~/components/runs/v3/TaskRunsTable";
import { allTaskRunStatuses, getRunStatusChartColor } from "~/components/runs/v3/TaskRunStatus";

type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
type JobDetailRouteData = {
  job: { id: string; name: string; firstObservedAt: string; lastObservedAt: string; runCount: number };
  queueTargets: Array<{ id: string; connection: string; queue: string; path: string }>;
  activity: Array<{ timestamp: string; total: number; statusCounts: Record<RunStatus, number> }>;
  runs: React.ComponentProps<typeof TaskRunsTable>["runs"];
  pagination: { next?: string; previous?: string };
  filterOptions: { statuses: RunStatus[]; timeRanges: Array<{ value: string; label: string }> };
  hasAnyRuns: boolean;
};

export default function JobDetailRoute() {
  const data = useLoaderData() as JobDetailRouteData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const updatePeriod = (period: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("period", period);
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };

  return (
    <PageContainer>
      <NavBar>
        <div className="flex items-center gap-1">
          <PageTitle
            backButton={{ to: "/jobs", text: "Tasks" }}
            title={<span className="flex min-w-0 items-center gap-1"><TaskIcon className="size-4.5 shrink-0 text-tasks" /><span className="max-w-[50vw] truncate">{data.job.name}</span></span>}
          />
          <JobFavoriteButton id={data.job.id} label={shortName(data.job.name)} path={`/jobs/${data.job.id}`} />
        </div>
      </NavBar>
      <PageBody scrollable={false}>
        <ResizablePanelGroup orientation="horizontal" className="max-h-full">
          <ResizablePanel id="task-main" min="300px">
            <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
              <div className="flex h-10 items-center border-b border-grid-dimmed bg-background-bright px-2">
                <select
                  aria-label="Time range"
                  className="h-6 rounded border border-grid-bright bg-background-bright px-2 text-xs text-text-bright focus-custom"
                  value={searchParams.get("period") ?? "7d"}
                  onChange={(event) => updatePeriod(event.currentTarget.value)}
                >
                  {data.filterOptions.timeRanges.filter((option) => option.value !== "all").map((option) => <option key={option.value} value={option.value}>{`Runs: ${option.label.replace(/^Last /, "")}`}</option>)}
                </select>
              </div>

              <ResizablePanelGroup orientation="vertical" className="max-h-full">
                <ResizablePanel id="task-activity" min="220px" default="320px">
                  <section aria-label="Runs by status" className="flex h-full min-h-0 flex-col overflow-hidden bg-background p-2">
                    <ChartCard title="Runs by status"><ActivityChart activity={data.activity} /></ChartCard>
                  </section>
                </ResizablePanel>
                <ResizableHandle id="task-activity-handle" />
                <ResizablePanel id="task-content" min="160px">
                  <section className="grid h-full grid-rows-[auto_1fr] overflow-hidden" aria-labelledby="task-runs-heading">
                    <div className="-mt-px flex h-10 items-center justify-between border-b border-grid-dimmed bg-background-bright px-3">
                      <h2 id="task-runs-heading" className="font-medium text-text-bright">Runs</h2>
                      <ListPagination list={data} />
                    </div>
                    <div className="relative min-h-0 overflow-hidden">
                      {data.runs.length > 0 ? <TaskRunsTable runs={data.runs} isLoading={navigation.state !== "idle"} /> : <RunsEmpty filtered={data.hasAnyRuns} />}
                      {navigation.state !== "idle" && data.runs.length === 0 ? <div aria-label="Loading Job" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div> : null}
                    </div>
                  </section>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
          <ResizableHandle id="task-detail-handle" />
          <ResizablePanel id="task-detail" min="280px" default="380px" max="500px" isStaticAtRest>
            <TaskDetailSidebar data={data} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </PageBody>
    </PageContainer>
  );
}

function ActivityChart({ activity }: { activity: JobDetailRouteData["activity"] }) {
  if (activity.length === 0) return <div className="grid h-full place-items-center text-sm text-text-dimmed">No activity in this time range.</div>;
  const rows = activity.map((point) => ({ bucket: point.timestamp, ...point.statusCounts }));
  return (
    <div role="img" aria-label="Recorded Runs by status over time" className="h-full min-h-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-grid-dimmed)" />
          <XAxis dataKey="bucket" tickFormatter={timeTick} tick={{ fill: "var(--color-text-dimmed)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals width={36} tick={{ fill: "var(--color-text-dimmed)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip animationDuration={0} cursor={{ fill: "rgba(255,255,255,0.04)" }} labelFormatter={(value) => new Date(String(value)).toLocaleString()} />
          {allTaskRunStatuses.map((status) => <Bar key={status} data-status={status} dataKey={status} stackId="status" fill={getRunStatusChartColor(status)} radius={0} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TaskDetailSidebar({ data }: { data: JobDetailRouteData }) {
  return (
    <aside className="grid h-full grid-rows-[auto_1fr] overflow-hidden bg-background-bright" aria-label="Job details">
      <div className="flex min-w-0 items-center gap-2 border-b border-grid-dimmed py-2 pl-3 pr-2">
        <Header2 className="flex min-w-0 flex-1 items-center gap-1.5"><TaskIcon className="size-4.5 shrink-0 text-tasks" /><span className="truncate">{data.job.name}</span></Header2>
      </div>
      <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <Property.Table>
          <Property.Item><Property.Label>Identifier</Property.Label><Property.Value><CopyableText value={data.job.name} /></Property.Value></Property.Item>
          {data.queueTargets.length > 0 ? <Property.Item><Property.Label>Queue</Property.Label><Property.Value><div className="flex flex-col gap-0.5">{data.queueTargets.map((queue) => <Link key={queue.id} to={queue.path} className="text-text-link hover:underline focus-custom">{data.queueTargets.length === 1 ? queue.queue : `${queue.connection} / ${queue.queue}`}</Link>)}</div></Property.Value></Property.Item> : null}
          <Property.Item><Property.Label>Created</Property.Label><Property.Value><DateTime date={data.job.firstObservedAt} /></Property.Value></Property.Item>
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
  const message = error instanceof Error ? error.message : "The task could not be loaded.";
  return <PageContainer><NavBar><PageTitle backButton={{ to: "/jobs", text: "Tasks" }} title="Task" /></NavBar><PageBody className="grid place-items-center"><div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center"><h1 className="font-medium text-text-bright">Unable to load task</h1><p className="mt-1 text-sm text-text-dimmed">{message}</p></div></PageBody></PageContainer>;
}

function shortName(name: string) { return name.split("\\").at(-1) ?? name; }
function timeTick(value: string) { return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); }
