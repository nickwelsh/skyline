/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Preserves ErrorGroupDetail, activity, paginated Runs-table treatment,
 * ErrorDetailSidebar, resizable geometry, and route-state composition.
 * Server, tenant, status, assignment, ignore, resolve, alerts, versions,
 * replay, cancellation, and bulk actions are external or capability-hidden.
 */
import { Link, useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { BugIcon } from "~/assets/icons/BugIcon";
import { ExceptionPreview, type ExceptionPreviewData } from "~/ExceptionPreview";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { ListPagination } from "~/components/ListPagination";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { Header2, Header3 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Paragraph } from "~/components/primitives/Paragraph";
import * as Property from "~/components/primitives/PropertyTable";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/primitives/Resizable";
import { Spinner } from "~/components/primitives/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "~/components/primitives/Table";

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

type FailedAttempt = {
  id: string;
  runId: string;
  attemptNumber: number;
  observedAt: string;
  runPath: string;
  attemptPath: string;
  exception: ExceptionPreviewData;
};

type ErrorGroupDetailData = {
  errorGroup: ErrorGroupSummary;
  representative: ExceptionPreviewData;
  activity: Array<{ timestamp: string; occurrences: number }>;
  failedAttempts: FailedAttempt[];
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
      <PageBody scrollable={false} className="p-0">
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
          <section
            aria-labelledby="error-activity-heading"
            className="flex flex-col gap-3 overflow-hidden border-b border-grid-bright bg-background-bright py-2 pl-2 pr-4"
          >
            <div className="flex items-center gap-2">
              <Header3 id="error-activity-heading">Occurrence activity</Header3>
              <select
                aria-label="Time range"
                className="ml-auto h-6 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom"
                value={data.filters.period}
                onChange={(event) => updatePeriod(event.currentTarget.value)}
              >
                {data.filterOptions.timeRanges.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <ActivityChart activity={data.activity} />
          </section>

          <section
            aria-labelledby="failed-attempts-heading"
            className="flex min-h-0 flex-col gap-1 overflow-y-hidden"
          >
            <div className="flex items-center justify-between pl-3 pr-2 pt-1">
              <Header3 id="failed-attempts-heading" className="mb-1 mt-2">Failed Attempts</Header3>
              <ListPagination list={data} />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {data.failedAttempts.length > 0
                ? <FailedAttemptsTable attempts={data.failedAttempts} />
                : <FailedAttemptsBlankState filtered={data.hasAnyOccurrences} />}
              {navigation.state !== "idle" && (
                <div
                  aria-label="Loading Error group"
                  className="absolute inset-0 grid place-items-center bg-background-dimmed/80"
                >
                  <Spinner />
                </div>
              )}
            </div>
          </section>
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
  const peak = Math.max(1, ...activity.map((point) => point.occurrences));

  if (activity.length === 0) {
    return <ActivityChartBlankState />;
  }

  return (
    <div
      role="img"
      aria-label="Error occurrences over time"
      className="flex min-h-0 flex-1 items-end gap-1 border-b border-l border-grid-bright px-2 pt-4"
    >
      {activity.map((point) => (
        <div
          key={point.timestamp}
          title={`${point.timestamp}: ${point.occurrences} occurrences`}
          className="flex h-full min-w-2 flex-1 items-end"
        >
          <span
            className="w-full bg-indigo-500"
            style={{ height: `${Math.max(3, point.occurrences / peak * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function ActivityChartBlankState() {
  return (
    <div className="grid flex-1 place-items-center text-sm text-text-dimmed">
      No occurrences in this time range.
    </div>
  );
}

function FailedAttemptsTable({ attempts }: { attempts: FailedAttempt[] }) {
  return (
    <Table containerClassName="max-h-full pb-10" showTopBorder={false} variant="dimmed">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Attempt</TableHeaderCell>
          <TableHeaderCell>Run</TableHeaderCell>
          <TableHeaderCell>Error</TableHeaderCell>
          <TableHeaderCell>Observed</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attempts.map((attempt) => (
          <TableRow key={attempt.id}>
            <TableCell to={attempt.attemptPath} isTabbableCell>
              <span className="font-mono">Attempt {attempt.attemptNumber}</span>
            </TableCell>
            <TableCell to={attempt.runPath}>
              <span className="font-mono">{attempt.runId}</span>
            </TableCell>
            <TableCell to={attempt.attemptPath} className="max-w-96 font-mono">
              <span className="block max-w-96 truncate" title={attempt.exception.message}>
                {attempt.exception.message}
              </span>
            </TableCell>
            <TableCell to={attempt.attemptPath}>
              <DateTimeShort date={attempt.observedAt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FailedAttemptsBlankState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <BugIcon className="size-16 text-secondary" />
      <div>
        <h3 className="font-medium text-text-bright">
          {filtered ? "No matching failed Attempts" : "No failed Attempts"}
        </h3>
        <Paragraph className="mt-1 text-text-dimmed">
          {filtered ? "Change the time range to see more occurrences." : "No occurrence evidence is available."}
        </Paragraph>
      </div>
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
            <Property.Item>
              <Property.Label>ID</Property.Label>
              <Property.Value><span className="break-all font-mono text-xs">{data.errorGroup.fingerprint}</span></Property.Value>
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
              <Property.Label>Exception</Property.Label>
              <Property.Value><span className="break-all font-mono text-xs">{data.errorGroup.exceptionClass}</span></Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>Occurrences</Property.Label>
              <Property.Value>{data.errorGroup.occurrenceCount.toLocaleString()}</Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>First seen</Property.Label>
              <Property.Value><DateTimeShort date={data.errorGroup.firstObservedAt} /></Property.Value>
            </Property.Item>
            <Property.Item>
              <Property.Label>Last seen</Property.Label>
              <Property.Value><DateTimeShort date={data.errorGroup.lastObservedAt} /></Property.Value>
            </Property.Item>
          </Property.Table>
          <ExceptionPreview exception={data.representative} />
        </div>
      </div>
    </aside>
  );
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
