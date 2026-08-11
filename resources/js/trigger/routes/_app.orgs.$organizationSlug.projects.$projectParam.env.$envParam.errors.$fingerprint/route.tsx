/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Preserves ErrorGroupDetail, activity, paginated Runs-table treatment,
 * ErrorDetailSidebar, resizable geometry, and route-state composition.
 * Server, tenant, status, assignment, ignore, resolve, alerts, versions,
 * replay, cancellation, and bulk actions are external or capability-hidden.
 */
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { useMemo } from "react";
import { CodeBlock } from "~/CodeBlock";
import { ExceptionPreview, type ExceptionPreviewData } from "~/ExceptionPreview";
import { RunsIcon } from "~/assets/icons/RunsIcon";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { ListPagination } from "~/components/ListPagination";
import { LinkButton } from "~/components/primitives/Buttons";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTime, RelativeDateTime } from "~/components/primitives/DateTime";
import { Header2, Header3 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import * as Property from "~/components/primitives/PropertyTable";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/primitives/Resizable";
import { TaskRunsTable, type PresentedRun } from "~/components/runs/v3/TaskRunsTable";
import { TimeFilter, type TimeFilterApplyValues } from "~/components/runs/v3/TimeFilter";
import { Chart, type ChartConfig } from "~/components/primitives/charts/ChartCompound";
import { buildActivityTimeAxis } from "~/components/primitives/charts/activityTimeAxis";

type ErrorGroupSummary = {
  id: string;
  fingerprint: string;
  friendlyId: string;
  jobType: string;
  jobPath: string;
  exceptionClass: string;
  representativeMessage: string;
  firstObservedAt: string;
  lastObservedAt: string;
  occurrenceCount: number;
};

type ErrorGroupDetailData = {
  errorGroup: ErrorGroupSummary;
  representative: ExceptionPreviewData;
  activity: { data: Array<{ bucket: number; occurrences: number }>; range: { from: number; to: number } };
  failedRuns: PresentedRun[];
  pagination: { next?: string; previous?: string };
  filters: { period: string | null; from: string | null; to: string | null };
  filterOptions: { timeRanges: Array<{ value: string; label: string }> };
  hasAnyOccurrences: boolean;
  canViewVersions: false;
  canViewMachines: false;
  canBulkReplay: false;
  affectedVersions: [];
  viewAllRunsPath: string;
};

export default function Page() {
  const data = useLoaderData() as ErrorGroupDetailData;
  const [searchParams] = useSearchParams();
  const timeParams = new URLSearchParams();
  for (const key of ["period", "from", "to"]) {
    const value = searchParams.get(key);
    if (value) timeParams.set(key, value);
  }
  const errorsPath = timeParams.size > 0 ? `/errors?${timeParams}` : "/errors";

  return (
    <PageContainer>
      <NavBar>
        <PageTitle
          backButton={{ to: errorsPath, text: "Errors" }}
          title={<span className="font-mono text-xs">{data.errorGroup.friendlyId}</span>}
          favoriteLabel="Errors"
        />
      </NavBar>
      <PageBody scrollable={false}>
        <ErrorGroupDetail data={data} />
      </PageBody>
    </PageContainer>
  );
}

function ErrorGroupDetail({ data }: { data: ErrorGroupDetailData }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const updateTime = (value: TimeFilterApplyValues) => {
    const next = new URLSearchParams(searchParams);
    for (const key of ["period", "from", "to", "cursor", "direction"]) next.delete(key);
    if (value.period) next.set("period", value.period);
    if (value.from) next.set("from", value.from);
    if (value.to) next.set("to", value.to);
    setSearchParams(next);
  };

  return (
    <ResizablePanelGroup orientation="horizontal" className="max-h-full">
      <ResizablePanel id="error-main" min="300px">
        <div className="grid h-full grid-rows-[12rem_1fr] overflow-hidden">
          <div className="flex flex-col gap-3 overflow-hidden border-b border-grid-bright bg-background-bright py-2 pl-2 pr-4">
            <div className="flex items-center gap-2">
              <TimeFilter
                defaultPeriod="7d"
                labelName="Occurred"
                period={data.filters.period ?? undefined}
                from={data.filters.from ?? undefined}
                to={data.filters.to ?? undefined}
                onValueChange={updateTime}
                valueClassName="text-text-bright"
              />
            </div>
            <ActivityChart activity={data.activity} />
          </div>

          <div className="flex min-h-0 flex-col gap-1 overflow-y-hidden">
            <div className="flex items-center justify-between pl-3 pr-2 pt-1">
              <Header3 id="runs-heading" className="mb-1 mt-2">Runs</Header3>
              <div className="flex items-center gap-2">
                <LinkButton variant="secondary/small" to={data.viewAllRunsPath} LeadingIcon={RunsIcon}>View all runs</LinkButton>
                <ListPagination list={data} />
              </div>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <TaskRunsTable
                total={data.failedRuns.length}
                hasFilters={data.filters.period !== "all" || data.filters.from !== null || data.filters.to !== null}
                runs={data.failedRuns}
                isLoading={false}
                presentation="error"
                showVersions={data.canViewVersions}
                showMachines={data.canViewMachines}
              />
            </div>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle id="error-detail-handle" />
      <ResizablePanel id="error-detail" min="280px" default="380px" max="500px" isStaticAtRest>
        <ErrorDetailSidebar data={data} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function ActivityChart({ activity }: { activity: ErrorGroupDetailData["activity"] }) {
  const chartConfig: ChartConfig = useMemo(() => ({
    occurrences: { label: "Occurrences", color: "#6c5ce7" },
  }), []);
  const { tickFormatter, tooltipLabelFormatter } = useMemo(() => buildActivityTimeAxis(activity.data), [activity.data]);
  const ticks = useMemo(() => Array.from({ length: 5 }, (_, index) => activity.range.from + ((activity.range.to - activity.range.from) * index) / 4), [activity.range]);

  if (activity.data.length === 0) {
    return <ActivityChartBlankState />;
  }

  return (
    <div role="img" aria-label="Error occurrences over time" className="h-full min-h-0 w-full">
      <Chart.Root config={chartConfig} data={activity.data} dataKey="bucket" series={["occurrences"]} fillContainer>
        <Chart.Bar
          barRadius={0}
          xAxisProps={{ ticks, tickFormatter }}
          yAxisProps={{ allowDecimals: false, domain: [0, (dataMax: number) => Math.max(1, Math.ceil(dataMax))] }}
          tooltipLabelFormatter={tooltipLabelFormatter}
        />
      </Chart.Root>
    </div>
  );
}

function ActivityChartBlankState() {
  return (
    <div className="flex min-h-0 flex-1 items-end gap-px rounded-sm">
      {[...Array(42)].map((_, index) => (
        <div key={index} className="h-full flex-1 bg-background-dimmed" />
      ))}
    </div>
  );
}

function ErrorDetailSidebar({ data }: { data: ErrorGroupDetailData }) {
  return (
    <aside
      aria-label="Error group details"
      className="grid h-full grid-rows-[auto_1fr] overflow-hidden bg-background-bright"
    >
      <div className="border-b border-grid-dimmed px-3 py-2">
        <Header2 className="truncate">Details</Header2>
      </div>
      <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <div className="flex flex-col gap-4">
          <Property.Table>
            <Property.Item className="gap-1">
              <Property.Label>Error</Property.Label>
              <Property.Value>
                <CodeBlock
                  code={data.errorGroup.representativeMessage}
                  showCopyButton
                  showLineNumbers={false}
                  showOpenInModal={false}
                  language="typescript"
                  wrap
                />
              </Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>ID</Property.Label>
              <Property.Value><CopyableText value={data.errorGroup.friendlyId} /></Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>Task</Property.Label>
              <Property.Value><CopyableText value={data.errorGroup.jobType} /></Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>Occurrences</Property.Label>
              <Property.Value><span className="tabular-nums">{data.errorGroup.occurrenceCount.toLocaleString()}</span></Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>First seen</Property.Label>
              <Property.Value><DateTime date={data.errorGroup.firstObservedAt} /></Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>Last seen</Property.Label>
              <Property.Value><RelativeDateTime date={data.errorGroup.lastObservedAt} /></Property.Value>
            </Property.Item>
          </Property.Table>
          <ExceptionPreview exception={data.representative} />
        </div>
      </div>
    </aside>
  );
}
