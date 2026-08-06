/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Preserves ErrorGroupDetail, activity, paginated Runs-table treatment,
 * ErrorDetailSidebar, resizable geometry, and route-state composition.
 * Server, tenant, status, assignment, ignore, resolve, alerts, versions,
 * replay, cancellation, and bulk actions are external or capability-hidden.
 */
import { Link, useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CodeBlock } from "~/CodeBlock";
import { ExceptionPreview, type ExceptionPreviewData } from "~/ExceptionPreview";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { ListPagination } from "~/components/ListPagination";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTime } from "~/components/primitives/DateTime";
import { Header2, Header3 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import * as Property from "~/components/primitives/PropertyTable";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/primitives/Resizable";
import { Spinner } from "~/components/primitives/Spinner";
import { TaskRunsTable, type PresentedRun } from "~/components/runs/v3/TaskRunsTable";

type ErrorGroupSummary = {
  id: string;
  fingerprint: string;
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
  activity: Array<{ timestamp: string; occurrences: number }>;
  failedRuns: PresentedRun[];
  pagination: { next?: string; previous?: string };
  filters: { period: string };
  filterOptions: { timeRanges: Array<{ value: string; label: string }> };
  hasAnyOccurrences: boolean;
};

export default function Page() {
  const data = useLoaderData() as ErrorGroupDetailData;

  return (
    <PageContainer>
      <NavBar>
        <PageTitle
          backButton={{ to: "/errors", text: "Errors" }}
          title={<span className="font-mono text-xs">{data.errorGroup.fingerprint.slice(-8)}</span>}
        />
      </NavBar>
      <PageBody scrollable={false}>
        <ErrorGroupDetail data={data} />
      </PageBody>
    </PageContainer>
  );
}

function ErrorGroupDetail({ data }: { data: ErrorGroupDetailData }) {
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const updatePeriod = (period: string) => {
    const next = new URLSearchParams(searchParams);
    period && period !== "all" ? next.set("period", period) : next.delete("period");
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };

  return (
    <ResizablePanelGroup orientation="horizontal" className="max-h-full">
      <ResizablePanel id="error-main" min="300px">
        <div className="grid h-full grid-rows-[12rem_1fr] overflow-hidden">
          <div className="flex flex-col gap-3 overflow-hidden border-b border-grid-bright bg-background-bright py-2 pl-2 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-dimmed">Occurred</span>
              <select
                aria-label="Time range"
                className="h-6 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom"
                value={data.filters.period}
                onChange={(event) => updatePeriod(event.currentTarget.value)}
              >
                {data.filterOptions.timeRanges.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <ActivityChart activity={data.activity} />
          </div>

          <div className="flex min-h-0 flex-col gap-1 overflow-y-hidden">
            <div className="flex items-center justify-between pl-3 pr-2 pt-1">
              <Header3 id="runs-heading" className="mb-1 mt-2">Runs</Header3>
              <ListPagination list={data} />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <TaskRunsTable
                total={data.failedRuns.length}
                hasFilters={data.filters.period !== "all"}
                runs={data.failedRuns}
              />
              {navigation.state !== "idle" && (
                <div
                  aria-label="Loading Error group"
                  className="absolute inset-0 grid place-items-center bg-background-dimmed/80"
                >
                  <Spinner />
                </div>
              )}
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
  const data = useMemo(() => activity.map((point) => ({
    ...point,
    __timestamp: new Date(point.timestamp).getTime(),
  })), [activity]);
  const ticks = useMemo(() => data
    .filter((point) => {
      const date = new Date(point.__timestamp);
      return date.getHours() === 0 && date.getMinutes() === 0;
    })
    .map((point) => point.__timestamp), [data]);

  if (activity.length === 0) {
    return <ActivityChartBlankState />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-grid-bright)" strokeDasharray="3 3" />
        <XAxis
          dataKey="__timestamp"
          tickFormatter={(value: number) => new Date(value).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
          ticks={ticks}
          height={24}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--color-text-dimmed)" }}
        />
        <YAxis
          width={30}
          tickMargin={4}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--color-text-dimmed)" }}
          domain={["auto", (maximum: number) => maximum * 1.15]}
        />
        <Tooltip animationDuration={0} content={() => null} />
        <Bar dataKey="occurrences" fill="#6c5ce7" strokeWidth={0} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
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
                  label="Error"
                />
              </Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>ID</Property.Label>
              <Property.Value><CopyableText value={data.errorGroup.fingerprint.slice(-8)} /></Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>Task</Property.Label>
              <Property.Value>
                <Link
                  to={data.errorGroup.jobPath}
                  className="break-all font-mono text-xs text-text-bright hover:underline focus-custom"
                >
                  {data.errorGroup.jobType}
                </Link>
              </Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>Occurrences</Property.Label>
              <Property.Value>{data.errorGroup.occurrenceCount.toLocaleString()}</Property.Value>
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
          <div data-skyline-extension="error-exception-evidence">
            <ExceptionPreview exception={data.representative} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function RelativeDateTime({ date }: { date: string }) {
  const elapsed = Date.now() - new Date(date).getTime();
  const hours = Math.max(1, Math.floor(elapsed / 3_600_000));
  return <span title={date}>{hours} {hours === 1 ? "hour" : "hours"} ago</span>;
}

export function ErrorDetailErrorBoundary() {
  const error = useRouteError();
  const notFound = (error instanceof Response
    || (typeof error === "object" && error !== null && "status" in error))
    && error.status === 404;

  return (
    <PageContainer>
      <NavBar><PageTitle backButton={{ to: "/errors", text: "Errors" }} title="Error group" /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <h1 className="font-medium text-text-bright">
            {notFound ? "Error group not found" : "Unable to load Error group"}
          </h1>
          <p className="mt-1 text-sm text-text-dimmed">
            {notFound ? "This observed Error group is unavailable." : "Error occurrence evidence could not be loaded."}
          </p>
        </div>
      </PageBody>
    </PageContainer>
  );
}
