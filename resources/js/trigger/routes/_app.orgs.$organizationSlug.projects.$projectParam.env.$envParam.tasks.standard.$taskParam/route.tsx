/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, test, versions, schedules, deployment, payload, and queue administration are removed.
 */
import { Link, useLoaderData, useNavigation } from "@remix-run/react";
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
import { TimeFilter } from "~/components/runs/v3/TimeFilter";

type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
type JobDetailRouteData = {
  job: { id: string; name: string; displayName: string; firstObservedAt: string; lastObservedAt: string; runCount: number };
  queueTargets: Array<{ id: string; connection: string; queue: string; path: string }>;
  activity: {
    data: Array<{ bucket: number } & Record<string, number>>;
    statuses: string[];
    range: { from: number; to: number };
  };
  definition: {
    file: { path: string; href: string | null } | null;
    defaultQueue: { connection: string; queue: string };
    retry: { maxAttempts: number | null; backoffSeconds: number[] | null; retryUntil: string | null };
  };
  runs: PresentedRun[];
  pagination: { next?: string; previous?: string };
  filters: { status: RunStatus[]; period: string | null; from: string | null; to: string | null };
  filterOptions: { statuses: RunStatus[]; timeRanges: Array<{ value: string; label: string }> };
  hasAnyRuns: boolean;
};

export default function JobDetailRoute() {
  const data = useLoaderData() as JobDetailRouteData;
  const navigation = useNavigation();

  return (
    <PageContainer>
      <NavBar>
        <div className="flex items-center gap-1">
          <PageTitle
            backButton={{ to: "/jobs", text: "Jobs" }}
            title={<span className="flex min-w-0 items-center gap-1"><TaskIcon className="size-4.5 shrink-0 text-tasks" /><span className="max-w-[50vw] truncate">{data.job.displayName}</span></span>}
          />
          <JobFavoriteButton id={data.job.id} label={shortName(data.job.name)} path={`/jobs/${data.job.id}`} />
        </div>
      </NavBar>
      <PageBody scrollable={false}>
        <ResizablePanelGroup orientation="horizontal" className="max-h-full">
          <ResizablePanel id="task-main" min="300px">
            <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
              <div className="flex h-10 items-center border-b border-grid-dimmed bg-background-bright px-2">
                <TimeFilter defaultPeriod="7d" labelName="Runs" />
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
                      <h2 id="task-runs-heading" className="font-sans text-base leading-6 font-semibold tracking-tight text-text-bright">Runs</h2>
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
  const ticks = useMemo(() => Array.from({ length: 5 }, (_, index) => activity.range.from + ((activity.range.to - activity.range.from) * index) / 4), [activity.range]);

  if (activity.data.length === 0) return <div className="grid h-full place-items-center text-sm text-text-dimmed">No activity in this time range.</div>;
  return (
    <div role="img" aria-label="Recorded Runs by status over time" className="h-full min-h-0 w-full">
      <Chart.Root config={chartConfig} data={activity.data} dataKey="bucket" series={activity.statuses} fillContainer>
        <Chart.Bar
          stackId="status"
          barRadius={0}
          xAxisProps={{ ticks, tickFormatter }}
          yAxisProps={{ allowDecimals: false, domain: [0, (dataMax: number) => Math.max(1, Math.ceil(dataMax))] }}
          tooltipLabelFormatter={tooltipLabelFormatter}
        />
      </Chart.Root>
    </div>
  );
}

function TaskDetailSidebar({ data }: { data: JobDetailRouteData }) {
  return (
    <aside className="grid h-full grid-rows-[auto_1fr] overflow-hidden bg-background-bright" aria-label="Job details">
      <div className="flex min-w-0 items-center gap-2 border-b border-grid-dimmed py-2 pl-3 pr-2">
        <Header2 className="flex min-w-0 flex-1 items-center gap-1.5"><TaskIcon className="size-4.5 shrink-0 text-tasks" /><span className="truncate">{data.job.displayName}</span></Header2>
      </div>
      <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <Property.Table>
          <Property.Item><Property.Label>Identifier</Property.Label><Property.Value><CopyableText value={data.job.name} /></Property.Value></Property.Item>
          {data.definition.file ? <Property.Item><Property.Label>File</Property.Label><Property.Value>{data.definition.file.href ? <a href={data.definition.file.href} className="text-text-link hover:underline focus-custom">{data.definition.file.path}</a> : <CopyableText value={data.definition.file.path} />}</Property.Value></Property.Item> : null}
          <Property.Item><Property.Label>Default queue</Property.Label><Property.Value><Paragraph variant="small">{`${data.definition.defaultQueue.connection} / ${data.definition.defaultQueue.queue}`}</Paragraph></Property.Value></Property.Item>
          {data.queueTargets.length > 0 ? <Property.Item><Property.Label>Previous queues</Property.Label><Property.Value><div data-skyline-protected="job-detail-queue-links" className="flex flex-col gap-0.5">{data.queueTargets.map((queue) => <Link key={queue.id} to={queue.path} className="text-text-link hover:underline focus-custom">{`${queue.connection} / ${queue.queue}`}</Link>)}</div></Property.Value></Property.Item> : null}
          <Property.Item><Property.Label>Retry</Property.Label><Property.Value><RetryDefinition retry={data.definition.retry} /></Property.Value></Property.Item>
          <Property.Item><Property.Label>Created</Property.Label><Property.Value><DateTime date={data.job.firstObservedAt} /></Property.Value></Property.Item>
        </Property.Table>
      </div>
    </aside>
  );
}

function shortName(name: string) { return name.split("\\").at(-1) ?? name; }

function RetryDefinition({ retry }: { retry: JobDetailRouteData["definition"]["retry"] }) {
  const attempts = retry.maxAttempts === null
    ? "Worker default"
    : retry.maxAttempts === 1
      ? "1 attempt (no retries)"
      : `${retry.maxAttempts} attempts`;

  return (
    <div className="flex flex-col gap-0.5">
      <Paragraph variant="small">{attempts}</Paragraph>
      {retry.backoffSeconds?.length ? <Paragraph variant="extra-small" className="text-text-dimmed">Backoff: {retry.backoffSeconds.map((seconds) => `${seconds}s`).join(" → ")}</Paragraph> : null}
      {retry.retryUntil ? <Paragraph variant="extra-small" className="text-text-dimmed">Until: <DateTime date={retry.retryUntil} includeTime /></Paragraph> : null}
    </div>
  );
}
