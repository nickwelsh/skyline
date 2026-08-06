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
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "~/components/primitives/Table";
import { Spinner } from "~/components/primitives/Spinner";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { QueueBigNumber } from "./QueueBigNumber";
import { QueueEnvironmentCharts } from "./QueueTargetCharts";
import { QueueConnectionFilter, QueuePeriodFilter, QueueSearchFilter, type QueueTimeRangeOption } from "./QueueTargetFilters";

export type PresentedQueueTarget = {
  id: string;
  path: string;
  connection: string;
  queue: string;
  destination: string;
  state: "Idle" | "Busy";
  queued: number;
  running: number;
  limit: number | null;
  limitedBy: "Environment" | null;
  health: "Backlogged" | "Active" | "Idle";
  delayP95: string;
  backlog: number[];
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
  environment: { queued: number; running: number; allocated: number | null; limit: number | null };
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
        <QueueBigNumber title="Queued" value={data.environment.queued} />
        <QueueBigNumber title="Running" value={data.environment.running} capabilityMarker="queue-root-running" />
        <QueueBigNumber title="Allocated" value={data.environment.allocated} />
        <QueueBigNumber title="Environment limit" value={data.environment.limit} capabilityMarker="queue-root-environment-limit" />
      </MetricsLayout.Grid>
      {(data.hasFilters || data.hasAnyQueueTargets) && (
        <MetricsLayout.Grid kind="charts" columns={{ base: 2, lg: 4 }}>
          <QueueEnvironmentCharts />
        </MetricsLayout.Grid>
      )}
      <MetricsLayout.Content>
        <div className="relative min-h-32">
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
    <Table containerClassName="border-t">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell alignment="right">Queued</TableHeaderCell>
          <TableHeaderCell alignment="right">Running</TableHeaderCell>
          <TableHeaderCell alignment="right">Limit</TableHeaderCell>
          <TableHeaderCell alignment="right">Limited by</TableHeaderCell>
          <TableHeaderCell alignment="right">Health</TableHeaderCell>
          <TableHeaderCell alignment="right">Delay p95</TableHeaderCell>
          <TableHeaderCell alignment="right">Backlog</TableHeaderCell>
          <TableHeaderCell className="w-[1%] pl-32"><span className="sr-only">Pause/resume</span></TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody aria-busy={loading} className={loading ? "opacity-50" : undefined}>
        {targets.map((target) => (
          <TableRow key={target.id}>
            <TableCell
              to={target.path}
              isTabbableCell
              leadingContent={<QueuesIcon className="size-[1.125rem] text-purple-500" />}
              trailingContent={target.health === "Backlogged" ? <span aria-hidden="true" data-skyline-capability={`queue-target-${target.id}-warning`} className="block size-4" /> : undefined}
            >
              {target.queue}
            </TableCell>
            <MetricCell target={target} value={target.queued} />
            <MetricCell target={target} value={target.running} bright={target.running > 0} />
            <MetricCell target={target} value={target.limit ?? "–"} capabilityMarker={`queue-target-${target.id}-limit`} />
            <MetricCell target={target} value={target.limitedBy ?? "–"} capabilityMarker={`queue-target-${target.id}-limited-by`} />
            <TableCell to={target.path} alignment="right"><QueueHealthBadge health={target.health} capabilityMarker={target.health === "Backlogged" ? `queue-target-${target.id}-health` : undefined} /></TableCell>
            <MetricCell target={target} value={target.queueTimeSampleCount > 0 ? target.delayP95 : "–"} bright={target.queueTimeSampleCount > 0} />
            <TableCell to={target.path} alignment="right"><BacklogSparkline values={target.backlog} capabilityMarker={`queue-target-${target.id}-backlog`} /></TableCell>
            <TableCell capabilityMarker={`queue-target-${target.id}-pause-resume`} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MetricCell({ target, value, bright = false, capabilityMarker }: { target: PresentedQueueTarget; value: string | number; bright?: boolean; capabilityMarker?: string }) {
  return <TableCell capabilityMarker={capabilityMarker} to={target.path} alignment="right" actionClassName="pl-16 tabular-nums" className={bright ? "w-[1%] text-text-bright" : "w-[1%]"}>{value}</TableCell>;
}

function QueueHealthBadge({ health, capabilityMarker }: { health: PresentedQueueTarget["health"]; capabilityMarker?: string }) {
  const styles = health === "Backlogged"
    ? "bg-blue-500/10 text-blue-500"
    : health === "Active" ? "bg-success/10 text-success" : "bg-charcoal-500/10 text-text-dimmed";
  return <span data-skyline-capability={capabilityMarker} className={`contrast-chip ml-auto inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${styles}`}>{health}</span>;
}

function BacklogSparkline({ values, capabilityMarker }: { values: number[]; capabilityMarker?: string }) {
  if (values.length === 0) return <span data-skyline-capability={capabilityMarker} className="text-text-dimmed">–</span>;
  const maximum = Math.max(...values, 1);
  const points = values.map((value, index) => `${values.length === 1 ? 67 : index / (values.length - 1) * 134},${22 - value / maximum * 18}`).join(" ");
  return (
    <svg aria-hidden="true" data-skyline-capability={capabilityMarker} viewBox="0 0 134 24" className="h-6 w-[134px]">
      <line x1="0" x2="134" y1="23" y2="23" stroke="var(--color-border-bright)" />
      <polyline points={points} fill="none" stroke="var(--color-queues-chart)" strokeWidth="1" />
      {values.length === 1 && <circle cx="67" cy={22 - values[0] / maximum * 18} r="2.5" fill="var(--color-queues-chart)" />}
    </svg>
  );
}

export function RecordedStatusBreakdown({ counts }: { counts: Record<RunStatus, number> }) {
  return (
    <dl aria-label="Recorded Run status breakdown" className="flex items-center gap-2">
      {(["queued", "running", "retrying", "completed", "failed"] as const).map((status) => (
        <div key={status} className="flex items-center gap-1"><dt className="capitalize text-text-faint">{status}</dt><dd className="font-mono tabular-nums text-text-bright">{counts[status].toLocaleString()}</dd></div>
      ))}
    </dl>
  );
}

function QueueTargetsEmpty({ filtered }: { filtered: boolean }) {
  return <div className="grid min-h-32 place-items-center py-6 text-center text-text-dimmed"><h2 className="font-medium text-text-bright">{filtered ? "No queues found matching your filters" : "No queues found"}</h2></div>;
}

function LoadingState({ label }: { label: string }) {
  return <div aria-label={label} className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>;
}
