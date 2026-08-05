/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Live broker metrics, concurrency keys, pause, allocation, billing, and worker controls are omitted.
 */
import { useLoaderData, useNavigation, useRouteError } from "@remix-run/react";
import type { PresentedRun } from "~/components/runs/v3/TaskRunsTable";
import { TaskRunsTable } from "~/components/runs/v3/TaskRunsTable";
import { QueueTargetCharts } from "~/components/queues/QueueTargetCharts";
import { QueueTargetFilters } from "~/components/queues/QueueTargetFilters";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Badge } from "~/components/primitives/Badge";
import { Header3 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Spinner } from "~/components/primitives/Spinner";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import type { PresentedQueueTarget } from "../_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route";

type ActivityPoint = { timestamp: string; recordedRuns: number; recordedRunCounts: Record<RunStatus, number> };
type QueueTimePoint = { timestamp: string; sampleCount: number; medianUs: number; p95Us: number; maximumUs: number };

export type QueueTargetDetailRouteData = {
  generatedAt: string;
  queueTarget: PresentedQueueTarget;
  activity: ActivityPoint[];
  queueTime: QueueTimePoint[];
  runs: PresentedRun[];
  pagination: { previous?: string; next?: string };
  statusOptions: RunStatus[];
  hasAnyRuns: boolean;
  hasFilters: boolean;
};

export default function QueueDetailRoute() {
  const data = useLoaderData() as QueueTargetDetailRouteData;
  const navigation = useNavigation();
  const loading = navigation.state !== "idle";

  return (
    <PageContainer>
      <NavBar>
        <PageTitle title={data.queueTarget.queue} backButton={{ to: "/queues", text: "Queues" }} />
      </NavBar>
      <PageBody scrollable={false} className="grid min-h-0 grid-rows-[auto_auto_auto_1fr_auto] p-0">
        <div className="flex items-center gap-2 border-b border-grid-bright bg-background-bright px-3 py-2">
          <span className="font-mono text-xs text-text-dimmed">{data.queueTarget.connection} / {data.queueTarget.queue}</span>
          <Badge variant="small" className={data.queueTarget.state === "Busy" ? "text-pending" : "text-text-dimmed"}>{data.queueTarget.state}</Badge>
          <span className="ml-auto text-xs text-text-dimmed">Recorded Runs, not broker depth</span>
        </div>
        <Stats target={data.queueTarget} />
        <QueueTargetCharts activity={data.activity} queueTime={data.queueTime} />
        <section aria-labelledby="queue-runs-heading" className="grid min-h-0 grid-rows-[auto_auto_1fr] border-t border-grid-bright">
          <div className="px-3 pt-3"><Header3 id="queue-runs-heading">Recorded Runs</Header3></div>
          <QueueTargetFilters statuses={data.statusOptions} generatedAt={data.generatedAt} />
          <div className="relative min-h-0 overflow-hidden">
            {data.runs.length > 0 ? <TaskRunsTable runs={data.runs} isLoading={loading} /> : <RunsEmpty filtered={data.hasAnyRuns && data.hasFilters} />}
            {loading && data.runs.length === 0 && <div aria-label="Loading Queue-target Runs" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>}
          </div>
        </section>
        <div className="flex h-11 items-center justify-end border-t border-grid-bright px-3"><ListPagination list={data} /></div>
      </PageBody>
    </PageContainer>
  );
}

export function QueueDetailErrorBoundary() {
  const error = useRouteError();
  const notFound = (error instanceof Response || (typeof error === "object" && error !== null && "status" in error))
    && error.status === 404;
  return (
    <PageContainer>
      <NavBar><PageTitle title="Queue target" backButton={{ to: "/queues", text: "Queues" }} /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <h1 className="font-medium text-text-bright">{notFound ? "Queue target not found" : "Unable to load Queue target"}</h1>
          <p className="mt-1 text-sm text-text-dimmed">{notFound ? "This observed Queue target is unavailable." : "Queue-target evidence could not be loaded."}</p>
        </div>
      </PageBody>
    </PageContainer>
  );
}

function Stats({ target }: { target: PresentedQueueTarget }) {
  const stats = [
    ["Recorded Runs", target.recordedRuns],
    ["Queue-time samples", target.queueTimeSampleCount.toLocaleString()],
    ["Median", target.medianQueueTime],
    ["P95", target.p95QueueTime],
    ["Maximum", target.maximumQueueTime],
  ];
  return (
    <dl className="grid grid-cols-5 border-b border-grid-bright bg-background-dimmed">
      {stats.map(([label, value]) => (
        <div key={label} className="border-r border-grid-bright px-3 py-2 last:border-r-0">
          <dt className="text-xs text-text-dimmed">{label}</dt>
          <dd className="mt-1 font-mono text-sm tabular-nums text-text-bright">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RunsEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid h-full min-h-32 place-items-center text-center">
      <div>
        <h2 className="font-medium text-text-bright">{filtered ? "No matching Runs" : "No Runs in this range"}</h2>
        <p className="mt-1 text-sm text-text-dimmed">{filtered ? "Change or clear filters to see recorded Runs." : "No confirmed Runs were observed for this Queue target."}</p>
      </div>
    </div>
  );
}
