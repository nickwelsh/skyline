/*!
 * Reached Queue-list presenter composition from Trigger.dev
 * _app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline supplies captured Queue evidence; broker mutations remain absent.
 */
import { QueuesIcon } from "~/assets/icons/QueuesIcon";
import { ListPagination } from "~/components/ListPagination";
import { MetricsLayout } from "~/components/layout/MetricsLayout";
import {
  Table,
  TableBlankRow,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "~/components/primitives/Table";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { Paragraph } from "~/components/primitives/Paragraph";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { QueueBigNumber } from "./QueueBigNumber";
import { QueueConnectionFilter, QueuePeriodFilter, QueueSearchFilter, type QueueTimeRangeOption } from "./QueueTargetFilters";

export type PresentedQueueTarget = {
  id: string;
  path: string;
  connection: string;
  queue: string;
  destination: string;
  recordedRuns: string;
  recordedRunCounts: Record<RunStatus, number>;
  queueTimeSampleCount: number;
  medianQueueTime: string;
  p95QueueTime: string;
  maximumQueueTime: string;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
};

export type QueueTargetsPresentation = {
  generatedAt: string;
  environment: { queued: number; running: number };
  queueTargets: PresentedQueueTarget[];
  pagination: { previous?: string; next?: string };
  connectionOptions: string[];
  timeRanges: QueueTimeRangeOption[];
  hasAnyQueueTargets: boolean;
  hasFilters: boolean;
};

export function QueueTargetsPresenter({ data, loading }: { data: QueueTargetsPresentation; loading: boolean }) {
  return (
    <MetricsLayout.Root>
      <MetricsLayout.Filters className="px-2">
        <div className="flex items-center gap-1.5"><QueueSearchFilter /><QueueConnectionFilter connections={data.connectionOptions} /></div>
        <div className="flex items-center gap-1.5">
          <QueuePeriodFilter generatedAt={data.generatedAt} timeRanges={data.timeRanges} />
          <ListPagination list={data} />
        </div>
      </MetricsLayout.Filters>
      <MetricsLayout.Grid>
        <QueueBigNumber title="Recorded queued" value={data.environment.queued} suffix="Runs" protectedMarker="queue-root-recorded-queued" />
        <QueueBigNumber title="Recorded running" value={data.environment.running} suffix="Runs" protectedMarker="queue-root-recorded-running" capabilityBoundary="queue-root-running" />
        <QueueBigNumber title="Allocated" formattedValue="–" />
        <QueueBigNumber title="Environment limit" formattedValue="Unavailable" capabilityBoundary="queue-root-environment-limit" />
      </MetricsLayout.Grid>
      <MetricsLayout.Content>
        <QueueTargetsTable targets={data.queueTargets} loading={loading} filtered={data.hasAnyQueueTargets && data.hasFilters} />
      </MetricsLayout.Content>
    </MetricsLayout.Root>
  );
}

function QueueTargetsTable({ targets, loading, filtered }: { targets: PresentedQueueTarget[]; loading: boolean; filtered: boolean }) {
  return (
    <div data-skyline-protected="queue-list-target-evidence"><Table containerClassName="border-t">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell alignment="right">Recorded Runs</TableHeaderCell>
          <TableHeaderCell>Status counts</TableHeaderCell>
          <TableHeaderCell alignment="right">Queue-time samples</TableHeaderCell>
          <TableHeaderCell alignment="right">Median</TableHeaderCell>
          <TableHeaderCell alignment="right">p95</TableHeaderCell>
          <TableHeaderCell alignment="right">Max</TableHeaderCell>
          <TableHeaderCell>First observed</TableHeaderCell>
          <TableHeaderCell>Last observed</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody aria-busy={loading} className={loading ? "opacity-50" : undefined}>
        {targets.length > 0 ? targets.map((target) => (
          <TableRow key={target.id}>
            <TableCell
              to={target.path}
              isTabbableCell
              capabilityBoundary={target.recordedRunCounts.queued > 0 ? `queue-target-${target.id}-warning` : undefined}
              leadingContent={<QueuesIcon className="size-[1.125rem] text-purple-500" />}
            >
              {target.destination}
            </TableCell>
            <TableCell to={target.path} alignment="right" capabilityBoundary={`queue-target-${target.id}-limit`} actionClassName="pl-16 tabular-nums" className="w-[1%]">{target.recordedRuns}</TableCell>
            <TableCell to={target.path} capabilityBoundary={`queue-target-${target.id}-limited-by`}><RecordedStatusBreakdown counts={target.recordedRunCounts} /></TableCell>
            <TableCell to={target.path} alignment="right" capabilityBoundary={`queue-target-${target.id}-backlog`} actionClassName="pl-16 tabular-nums" className="w-[1%]">{target.queueTimeSampleCount}</TableCell>
            <MetricCell target={target} value={target.medianQueueTime} bright={target.queueTimeSampleCount > 0} />
            <TableCell to={target.path} alignment="right" capabilityBoundary={target.recordedRunCounts.queued > 0 ? `queue-target-${target.id}-health` : undefined} actionClassName="pl-16 tabular-nums" className={target.queueTimeSampleCount > 0 ? "w-[1%] text-text-bright" : "w-[1%]"}>{target.p95QueueTime}</TableCell>
            <TableCell to={target.path} alignment="right" capabilityBoundary={`queue-target-${target.id}-pause-resume`} actionClassName="pl-16 tabular-nums" className={target.queueTimeSampleCount > 0 ? "w-[1%] text-text-bright" : "w-[1%]"}>{target.maximumQueueTime}</TableCell>
            <TableCell to={target.path}>{target.firstObservedAt ? <DateTimeShort date={target.firstObservedAt} /> : "–"}</TableCell>
            <TableCell to={target.path}>{target.lastObservedAt ? <DateTimeShort date={target.lastObservedAt} /> : "–"}</TableCell>
          </TableRow>
        )) : (
          <TableBlankRow colSpan={9}>{!loading ? <Paragraph className="w-auto">{filtered ? "No queues found matching your filters" : "No queues found"}</Paragraph> : null}</TableBlankRow>
        )}
      </TableBody>
    </Table></div>
  );
}

function MetricCell({ target, value, bright = false }: { target: PresentedQueueTarget; value: string | number; bright?: boolean }) {
  return <TableCell to={target.path} alignment="right" actionClassName="pl-16 tabular-nums" className={bright ? "w-[1%] text-text-bright" : "w-[1%]"}>{value}</TableCell>;
}

export function RecordedStatusBreakdown({ counts }: { counts: Record<RunStatus, number> }) {
  return (
    <dl role="group" aria-label="Recorded Run status counts" className="flex items-center gap-2">
      {(["queued", "running", "retrying", "completed", "failed"] as const).map((status) => (
        <div key={status} className="flex items-center gap-1"><dt className="capitalize text-text-faint">{status}</dt><dd className="font-mono tabular-nums text-text-bright">{counts[status].toLocaleString()}</dd></div>
      ))}
    </dl>
  );
}
