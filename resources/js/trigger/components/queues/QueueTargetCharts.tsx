/*!
 * Derived from Trigger.dev QueueMetricCards chart treatment
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: static observed Run/Queue-time series plus the source-composed
 * recorded-Runs card replacement, with no live broker metrics.
 */
import { ChartCard } from "~/components/primitives/charts/ChartCard";
import { ChartSyncProvider } from "~/components/primitives/charts/ChartSyncContext";
import { InformationCircleIcon } from "@heroicons/react/20/solid";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import type { ReactNode } from "react";
import { QueueMetricSeries, type QueueMetricPoint, type QueueMetricSeriesConfig } from "./QueueMetricSeries";

type Point = { timestamp: string };

export function QueueTargetCharts({
  activity,
  queueTime,
  recordedRuns,
}: {
  activity: Array<Point & { recordedRuns: number; recordedRunCounts: Record<RunStatus, number> }>;
  queueTime: Array<Point & { sampleCount: number; medianUs: number | null; p95Us: number | null; maximumUs: number | null }>;
  recordedRuns?: ReactNode;
}) {
  const enqueued = activity.map((point) => point.recordedRuns);
  const started = activity.map((point) => point.recordedRunCounts.running + point.recordedRunCounts.completed + point.recordedRunCounts.failed);
  return (
    <ChartSyncProvider>
      <section aria-label="Queue-target activity" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricChartCard title="Throughput" className="aspect-[2/1]" showLegend extraLegend={[{ color: "var(--color-warning)", label: "Falling behind" }]} points={activity.map((point, index) => ({ timestamp: point.timestamp, enqueued: enqueued[index], started: started[index] }))} series={[{ key: "enqueued", color: "var(--color-queues-chart-ref)", label: "Enqueued" }, { key: "started", color: "var(--color-queues-chart)", label: "Started" }]} warningOverlay={{ series: "started", below: "enqueued" }} />
        <MetricChartCard title="Scheduling delay" className="aspect-[2/1]" showLegend points={queueTime.map((point) => ({ timestamp: point.timestamp, p50: waitPoint(point.medianUs, point.sampleCount), p95: waitPoint(point.p95Us, point.sampleCount), p99: waitPoint(point.maximumUs, point.sampleCount) }))} series={[{ key: "p50", color: "#22D3EE", label: "p50" }, { key: "p95", color: "#F59E0B", label: "p95" }, { key: "p99", color: "#EF4444", label: "p99" }]} valueFormat={formatWaitMs} />
        <div className="h-52 sm:col-span-2">{recordedRuns}</div>
      </section>
    </ChartSyncProvider>
  );
}

export function MetricChartCard({
  title,
  points = [],
  series,
  className,
  showLegend = false,
  extraLegend,
  valueFormat,
  warningOverlay,
  simpleEmpty = false,
  capabilityMarker,
}: {
  title: string;
  points?: QueueMetricPoint[];
  series: QueueMetricSeriesConfig[];
  className?: string;
  showLegend?: boolean;
  extraLegend?: Array<{ color: string; label: string }>;
  valueFormat?: (value: number) => string;
  warningOverlay?: { series: string; below: string; color?: string };
  simpleEmpty?: boolean;
  capabilityMarker?: string;
}) {
  return (
    <div className={className ?? "h-full"}>
      <ChartCard title={<span className="flex min-h-6 flex-col gap-1"><span className="flex items-center gap-1">{title}<button type="button" aria-label={`${title} information`} title={`${title} from captured Queue activity.`} className="rounded-sm text-text-dimmed focus-custom"><InformationCircleIcon className="size-3.5" /></button></span>{showLegend && points.length > 0 ? <span className="flex flex-wrap items-center gap-2">{[...series, ...(extraLegend ?? []).map((item) => ({ ...item, key: item.label }))].map((item) => <span key={item.key} className="flex items-center gap-1 text-xs font-normal text-text-dimmed"><span className="size-2.5 rounded-[2px]" style={{ backgroundColor: item.color }} />{item.label}</span>)}</span> : null}</span>}>
        {simpleEmpty && points.length === 0
          ? <div role="img" aria-label={`${title} chart`} className="grid h-full place-items-center text-xs text-text-dimmed">No activity</div>
          : <QueueMetricSeries title={title} points={points} series={series} valueFormat={valueFormat} warningOverlay={warningOverlay} capabilityMarker={capabilityMarker} />}
      </ChartCard>
    </div>
  );
}

function formatWaitMs(value: number) {
  if (value < 1_000) return `${Math.round(value)}ms`;
  if (value < 60_000) return `${(value / 1_000).toFixed(1)}s`;
  if (value < 3_600_000) return `${(value / 60_000).toFixed(1)}m`;
  return `${(value / 3_600_000).toFixed(1)}h`;
}

function waitPoint(microseconds: number | null, sampleCount: number) {
  return sampleCount > 0 && microseconds !== null ? microseconds / 1_000 : null;
}
