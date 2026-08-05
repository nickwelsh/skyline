/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server loaders and broker administration are external or capability-absent.
 */
import { Link, useLoaderData, useNavigation, useRouteError } from "@remix-run/react";
import { QueuesIcon } from "~/assets/icons/QueuesIcon";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Badge } from "~/components/primitives/Badge";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Spinner } from "~/components/primitives/Spinner";
import { QueueTargetFilters } from "~/components/queues/QueueTargetFilters";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { cn } from "~/utils/cn";

export type PresentedQueueTarget = {
  id: string;
  path: string;
  connection: string;
  queue: string;
  destination: string;
  state: "Idle" | "Busy";
  recordedRuns: string;
  recordedRunCounts: Record<RunStatus, number>;
  queueTimeSampleCount: number;
  medianQueueTime: string;
  p95QueueTime: string;
  maximumQueueTime: string;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
};

export type QueueTargetsRouteData = {
  generatedAt: string;
  queueTargets: PresentedQueueTarget[];
  pagination: { previous?: string; next?: string };
  connectionOptions: string[];
  hasAnyQueueTargets: boolean;
  hasFilters: boolean;
};

export default function QueuesRoute() {
  const data = useLoaderData() as QueueTargetsRouteData;
  const navigation = useNavigation();
  const loading = navigation.state !== "idle";

  return (
    <PageContainer>
      <NavBar>
        <PageTitle title={<><QueuesIcon className="size-4 text-queues" />Queues</>} />
      </NavBar>
      <PageBody scrollable={false} className="grid min-h-0 grid-rows-[auto_1fr_auto] p-0">
        <QueueTargetFilters connections={data.connectionOptions} generatedAt={data.generatedAt} />
        <div className="relative min-h-0 overflow-hidden">
          {data.queueTargets.length > 0 ? (
            <QueueTargetsTable targets={data.queueTargets} loading={loading} />
          ) : (
            <EmptyState filtered={data.hasAnyQueueTargets && data.hasFilters} />
          )}
          {loading && data.queueTargets.length === 0 && <LoadingState label="Loading Queue targets" />}
        </div>
        <div className="flex h-11 items-center justify-end border-t border-grid-bright px-3">
          <ListPagination list={data} />
        </div>
      </PageBody>
    </PageContainer>
  );
}

export function QueuesErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Queue targets could not be loaded.";
  return <ErrorState title="Unable to load Queues" message={message} />;
}

function QueueTargetsTable({ targets, loading }: { targets: PresentedQueueTarget[]; loading: boolean }) {
  return (
    <div className="max-h-full overflow-auto whitespace-nowrap border-t border-grid-dimmed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background-dimmed">
          <tr className="border-b border-grid-dimmed text-left">
            <HeaderCell>Queue</HeaderCell>
            <HeaderCell>Connection</HeaderCell>
            <HeaderCell>State</HeaderCell>
            <HeaderCell>Recorded Runs</HeaderCell>
            <HeaderCell>Median queue time</HeaderCell>
            <HeaderCell>P95 queue time</HeaderCell>
            <HeaderCell>Maximum queue time</HeaderCell>
            <HeaderCell>Last observed</HeaderCell>
          </tr>
        </thead>
        <tbody aria-busy={loading} className={cn(loading && "opacity-50")}>
          {targets.map((target) => (
            <tr key={target.id} className="group/table-row border-b border-grid-dimmed">
              <Cell className="max-w-80">
                <Link to={target.path} className="block truncate font-medium text-text-bright outline-hidden hover:underline focus-custom">
                  {target.queue}
                </Link>
                <span className="block truncate font-mono text-xs text-text-faint">{target.id}</span>
              </Cell>
              <Cell className="font-mono text-text-bright">{target.connection}</Cell>
              <Cell><Badge variant="small" className={target.state === "Busy" ? "text-pending" : "text-text-dimmed"}>{target.state}</Badge></Cell>
              <Cell className="tabular-nums">{target.recordedRuns}</Cell>
              <Cell className="font-mono tabular-nums">{sample(target.medianQueueTime, target.queueTimeSampleCount)}</Cell>
              <Cell className="font-mono tabular-nums">{sample(target.p95QueueTime, target.queueTimeSampleCount)}</Cell>
              <Cell className="font-mono tabular-nums">{sample(target.maximumQueueTime, target.queueTimeSampleCount)}</Cell>
              <Cell className="text-text-bright">{target.lastObservedAt ? <DateTimeShort date={target.lastObservedAt} /> : "—"}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sample(value: string, count: number) {
  return count === 0 ? <span title="No recorded queue-time samples">—</span> : value;
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 pb-3 text-sm font-normal text-text-dimmed">{children}</th>;
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 text-xs group-hover/table-row:bg-background-bright", className)}>{children}</td>;
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid h-full min-h-64 place-items-center text-center">
      <div>
        <h2 className="font-medium text-text-bright">{filtered ? "No matching Queue targets" : "No Queue targets yet"}</h2>
        <p className="mt-1 text-sm text-text-dimmed">{filtered ? "Change or clear filters to see more Queue targets." : "Confirmed Runs with named asynchronous destinations will appear here."}</p>
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return <div aria-label={label} className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>;
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <PageContainer>
      <NavBar><PageTitle title="Queues" /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <h1 className="font-medium text-text-bright">{title}</h1>
          <p className="mt-1 text-sm text-text-dimmed">{message}</p>
        </div>
      </PageBody>
    </PageContainer>
  );
}
