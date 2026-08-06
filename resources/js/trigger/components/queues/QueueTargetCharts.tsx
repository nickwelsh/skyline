/*!
 * Derived from Trigger.dev QueueMetricCards chart treatment
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: static observed Run/Queue-time series plus the source-composed
 * recorded-Runs card replacement, with no live broker metrics.
 */
import { Header3 } from "~/components/primitives/Headers";
import { InformationCircleIcon } from "@heroicons/react/20/solid";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import type { ReactNode } from "react";

type Point = { timestamp: string };

export function QueueEnvironmentCharts({
  targets,
}: {
  targets: Array<{ running: number; queued: number; queueTimeSampleCount: number; backlog: number[] }>;
}) {
  const running = targets.map((target) => target.running);
  const backlog = targets.flatMap((target) => target.backlog);
  const delay = targets.map((target) => target.queueTimeSampleCount);
  return (
    <>
      <MetricChartCard title="Env saturation" series={[{ values: running, color: "var(--color-queues-chart)" }]} />
      <MetricChartCard title="Backlog" series={[{ values: backlog, color: "var(--color-queues-chart)" }]} />
      <MetricChartCard title="Scheduling delay p95" series={[{ values: delay, color: "var(--color-queues-chart)" }]} />
      <MetricChartCard title="Throttled" series={[{ values: targets.map(() => 0), color: "var(--color-warning)" }]} />
    </>
  );
}

export function QueueTargetCharts({
  activity,
  queueTime,
  recordedRuns,
}: {
  activity: Array<Point & { recordedRuns: number; recordedRunCounts: Record<RunStatus, number> }>;
  queueTime: Array<Point & { sampleCount: number; medianUs: number; p95Us: number; maximumUs: number }>;
  recordedRuns?: ReactNode;
}) {
  const running = activity.map((point) => point.recordedRunCounts.running);
  const queued = activity.map((point) => point.recordedRunCounts.queued);
  const enqueued = activity.map((point) => point.recordedRuns);
  const started = activity.map((point) => point.recordedRunCounts.running + point.recordedRunCounts.completed + point.recordedRunCounts.failed);
  return (
    <section aria-label="Queue-target activity" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <MetricChartCard title="Concurrency" className="aspect-[2/1]" legend={[{ color: "var(--color-queues-chart)", label: "Running" }]} series={[{ values: running, color: "var(--color-queues-chart)" }]} />
      <MetricChartCard title="Queue depth" className="aspect-[2/1]" series={[{ values: queued, color: "var(--color-queues-chart)" }]} />
      <MetricChartCard title="Throughput" className="aspect-[2/1]" legend={[{ color: "var(--color-queues-chart-ref)", label: "Enqueued" }, { color: "var(--color-queues-chart)", label: "Started" }]} series={[{ values: enqueued, color: "var(--color-queues-chart-ref)" }, { values: started, color: "var(--color-queues-chart)" }]} />
      <MetricChartCard title="Scheduling delay" className="aspect-[2/1]" legend={[{ color: "#22D3EE", label: "p50" }, { color: "#F59E0B", label: "p95" }, { color: "#EF4444", label: "p99" }]} series={[{ values: queueTime.map((point) => point.medianUs), color: "#22D3EE" }, { values: queueTime.map((point) => point.p95Us), color: "#F59E0B" }, { values: queueTime.map((point) => point.maximumUs), color: "#EF4444" }]} />
      {recordedRuns ?? <MetricChartCard title="Throttled" className="h-52 sm:col-span-2" series={[{ values: activity.map(() => 0), color: "var(--color-warning)" }]} />}
    </section>
  );
}

function SeriesCard({
  title,
  points,
  color,
  insufficient = false,
}: {
  title: string;
  points: Array<Point & { value: number }>;
  color: string;
  insufficient?: boolean;
}) {
  const path = line(points.map((point) => point.value));
  return (
    <figure className="h-52 rounded-lg border border-grid-bright bg-background-bright p-3">
      <Header3>{title}</Header3>
      {points.length === 0 ? (
        <div className="grid h-36 place-items-center text-xs text-text-dimmed">No recorded activity</div>
      ) : (
        <svg role="img" aria-label={`${title} chart`} viewBox="0 0 400 128" className="h-32 w-full overflow-visible">
          <title>{title}</title>
          <line x1="0" x2="400" y1="126" y2="126" stroke="var(--color-grid-bright)" />
          <polyline points={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {insufficient && <figcaption className="text-xs text-text-dimmed">Insufficient samples for a queue-time trend.</figcaption>}
    </figure>
  );
}

export function MetricChartCard({
  title,
  series,
  className,
  legend,
}: {
  title: string;
  series: Array<{ values: number[]; color: string; label?: string }>;
  className?: string;
  legend?: Array<{ color: string; label: string }>;
}) {
  return (
    <figure className={`group min-h-0 overflow-hidden rounded-lg border border-grid-bright bg-background-bright pb-2 pt-3 ${className ?? "h-full"}`}>
      <div className="mb-3 flex min-h-6 flex-col gap-1 pl-4 pr-3">
        <span className="flex items-center gap-1"><Header3>{title}</Header3><button type="button" aria-label={`${title} information`} title={`${title} from captured Queue activity.`} className="rounded-sm text-text-dimmed focus-custom"><InformationCircleIcon className="size-3.5" /></button></span>
        {legend && <div className="flex gap-2">{legend.map((item) => <span key={item.label} className="flex items-center gap-1 text-xs text-text-dimmed"><span className="size-2.5 rounded-[2px]" style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>}
      </div>
      <svg role="img" aria-label={`${title} chart`} viewBox="0 0 400 180" className="h-[calc(100%-2.25rem)] w-full px-2">
        <title>{title}</title>
        <line x1="24" x2="396" y1="166" y2="166" stroke="var(--color-grid-bright)" />
        {series.map((item, index) => <polyline key={index} points={lineFor(item.values, 400, 166)} fill="none" stroke={item.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      </svg>
    </figure>
  );
}

function line(values: number[]) {
  const maximum = Math.max(...values, 1);
  return values.map((value, index) => {
    const x = values.length === 1 ? 200 : (index / (values.length - 1)) * 400;
    const y = 124 - (value / maximum) * 112;
    return `${x},${y}`;
  }).join(" ");
}

function lineFor(values: number[], width: number, height: number) {
  const maximum = Math.max(...values, 1);
  return values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : 24 + index / (values.length - 1) * (width - 28);
    const y = height - 4 - value / maximum * (height - 24);
    return `${x},${y}`;
  }).join(" ");
}
