/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, test, source definition, versions, retries, schedules, deployment, payload, and queue administration are removed.
 */
import { Link, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { useMemo } from "react";
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
import { Chart, type ChartConfig } from "~/components/primitives/charts/ChartCompound";
import { buildActivityTimeAxis } from "~/components/primitives/charts/activityTimeAxis";
import { statusColor } from "~/components/primitives/charts/statusColors";
import { TaskRunsList } from "~/components/runs/v3/TaskRunsList";
import type { PresentedRun } from "~/components/runs/v3/TaskRunsTable";

type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
type JobDetailRouteData = {
  job: { id: string; name: string; firstObservedAt: string; lastObservedAt: string; runCount: number };
  queueTargets: Array<{ id: string; connection: string; queue: string; path: string }>;
  activity: {
    data: Array<{ bucket: number } & Record<string, number>>;
    statuses: string[];
  };
  runs: PresentedRun[];
  pagination: { next?: string; previous?: string };
  filters: { status: RunStatus[] };
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
                      <TaskRunsList
                        list={{ runs: data.runs, hasAnyRuns: data.hasAnyRuns, hasFilters: data.filters.status.length > 0 }}
                        isLoading={navigation.state !== "idle"}
                      />
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
  const chartConfig: ChartConfig = useMemo(() => Object.fromEntries(activity.statuses.map((status) => [status, {
    label: status.charAt(0) + status.slice(1).toLowerCase(),
    color: statusColor(status),
  }])), [activity.statuses]);
  const { tickFormatter, tooltipLabelFormatter } = useMemo(() => buildActivityTimeAxis(activity.data), [activity.data]);

  if (activity.data.length === 0) return <div className="grid h-full place-items-center text-sm text-text-dimmed">No activity in this time range.</div>;
  return (
    <div role="img" aria-label="Recorded Runs by status over time" className="h-full min-h-0 w-full">
      <Chart.Root config={chartConfig} data={activity.data} dataKey="bucket" series={activity.statuses} fillContainer>
        <Chart.Bar stackId="status" barRadius={0} xAxisProps={{ tickFormatter }} tooltipLabelFormatter={tooltipLabelFormatter} />
      </Chart.Root>
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
          <div data-skyline-protected="job-detail-identifier" className="relative"><Property.Item><Property.Label>Identifier</Property.Label><Property.Value><CopyableText value={data.job.name} /></Property.Value></Property.Item><span aria-hidden="true" data-skyline-capability-boundary="job-detail-source-definition" className="pointer-events-none absolute inset-0" /></div>
          {data.queueTargets.length > 0 ? <Property.Item className="relative"><Property.Label>Queue</Property.Label><Property.Value><div data-skyline-protected="job-detail-queue-links" className="flex flex-col gap-0.5">{data.queueTargets.map((queue) => <Link key={queue.id} to={queue.path} className="text-text-link hover:underline focus-custom">{data.queueTargets.length === 1 ? queue.queue : `${queue.connection} / ${queue.queue}`}</Link>)}</div></Property.Value><span aria-hidden="true" data-skyline-capability-boundary="job-detail-queue-administration" className="pointer-events-none absolute inset-0" /></Property.Item> : null}
          <div data-skyline-protected="job-detail-created" className="relative"><Property.Item><Property.Label>Created</Property.Label><Property.Value><DateTime date={data.job.firstObservedAt} /></Property.Value></Property.Item><span aria-hidden="true" data-skyline-capability-boundary="job-detail-runtime-policy" className="pointer-events-none absolute inset-0" /></div>
        </Property.Table>
      </div>
    </aside>
  );
}

function shortName(name: string) { return name.split("\\").at(-1) ?? name; }
