/*!
 * Reached Queue-list presenter composition from Trigger.dev
 * _app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline supplies observed evidence through QueueTargetsPresentation; broker controls stay absent.
 */
import { ListPagination } from "~/components/ListPagination";
import { MetricsLayout } from "~/components/layout/MetricsLayout";
import { Badge } from "~/components/primitives/Badge";
import { DateTimeShort } from "~/components/primitives/DateTime";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "~/components/primitives/Table";
import { Spinner } from "~/components/primitives/Spinner";
import type { QueueTargetsPresentation, PresentedQueueTarget } from "../../../skyline/QueueTargetPresentation";
import type { RunStatus } from "../../../skyline/dto";
import { QueueTargetFilters } from "./QueueTargetFilters";

export function QueueTargetsPresenter({ data, loading }: { data: QueueTargetsPresentation; loading: boolean }) {
  return (
    <MetricsLayout.Root>
      <MetricsLayout.Filters className="px-2">
        <QueueTargetFilters connections={data.connectionOptions} generatedAt={data.generatedAt} timeRanges={data.timeRanges} />
        <ListPagination list={data} />
      </MetricsLayout.Filters>
      <MetricsLayout.Content>
        <div className="relative min-h-64">
          {data.queueTargets.length > 0
            ? <QueueTargetsTable targets={data.queueTargets} loading={loading} />
            : <QueueTargetsEmpty filtered={data.hasAnyQueueTargets && data.hasFilters} />}
          {loading && data.queueTargets.length === 0 && <LoadingState label="Loading Queue targets" />}
        </div>
      </MetricsLayout.Content>
    </MetricsLayout.Root>
  );
}

function QueueTargetsTable({ targets, loading }: { targets: PresentedQueueTarget[]; loading: boolean }) {
  return (
    <Table containerClassName="border-t" variant="dimmed">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Queue</TableHeaderCell>
          <TableHeaderCell>Connection</TableHeaderCell>
          <TableHeaderCell>State</TableHeaderCell>
          <TableHeaderCell>Recorded Runs by status</TableHeaderCell>
          <TableHeaderCell alignment="right">Recorded Runs</TableHeaderCell>
          <TableHeaderCell alignment="right">Queue-time samples</TableHeaderCell>
          <TableHeaderCell alignment="right">Median</TableHeaderCell>
          <TableHeaderCell alignment="right">P95</TableHeaderCell>
          <TableHeaderCell alignment="right">Maximum</TableHeaderCell>
          <TableHeaderCell>First observed</TableHeaderCell>
          <TableHeaderCell>Last observed</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody aria-busy={loading} className={loading ? "opacity-50" : undefined}>
        {targets.map((target) => (
          <TableRow key={target.id}>
            <TableCell to={target.path} isTabbableCell className="max-w-80">
              <span className="block truncate font-medium text-text-bright">{target.queue}</span>
              <span className="block truncate font-mono text-xs text-text-faint">{target.id}</span>
            </TableCell>
            <TableCell className="font-mono text-text-bright">{target.connection}</TableCell>
            <TableCell><Badge variant="small" className={target.state === "Busy" ? "text-pending" : "text-text-dimmed"}>{target.state}</Badge></TableCell>
            <TableCell><RecordedStatusBreakdown counts={target.recordedRunCounts} /></TableCell>
            <TableCell alignment="right" className="tabular-nums">{target.recordedRuns}</TableCell>
            <TableCell alignment="right" className="tabular-nums">{target.queueTimeSampleCount.toLocaleString()}</TableCell>
            <TableCell alignment="right" className="font-mono tabular-nums">{sample(target.medianQueueTime, target.queueTimeSampleCount)}</TableCell>
            <TableCell alignment="right" className="font-mono tabular-nums">{sample(target.p95QueueTime, target.queueTimeSampleCount)}</TableCell>
            <TableCell alignment="right" className="font-mono tabular-nums">{sample(target.maximumQueueTime, target.queueTimeSampleCount)}</TableCell>
            <TableCell>{target.firstObservedAt ? <DateTimeShort date={target.firstObservedAt} /> : "—"}</TableCell>
            <TableCell>{target.lastObservedAt ? <DateTimeShort date={target.lastObservedAt} /> : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RecordedStatusBreakdown({ counts }: { counts: Record<RunStatus, number> }) {
  return (
    <dl aria-label="Recorded Run status breakdown" className="flex items-center gap-2">
      {(["queued", "running", "retrying", "completed", "failed"] as const).map((status) => (
        <div key={status} className="flex items-center gap-1">
          <dt className="capitalize text-text-faint">{status}</dt>
          <dd className="font-mono tabular-nums text-text-bright">{counts[status].toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

function sample(value: string, count: number) {
  return count === 0 ? <span title="No recorded queue-time samples">—</span> : value;
}

function QueueTargetsEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid min-h-64 place-items-center text-center">
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
