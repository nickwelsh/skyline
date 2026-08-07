import type { PresentedRun } from "../trigger/components/runs/v3/TaskRunsTable";
import type { QueueTargetDetailPresentation } from "../trigger/components/queues/QueueTargetDetailPresenter";
import type { QueueTargetsPresentation } from "../trigger/components/queues/QueueTargetsPresenter";
import type {
  QueueTargetDetailDto,
  QueueTargetRunsQuery,
  QueueTargetSummary,
  QueueTargetsPageDto,
  QueueTargetsQuery,
  RunStatus,
} from "./dto";
import { formatDuration } from "./Duration";

export function queueTargetsQuery(request: Request): QueueTargetsQuery {
  const params = new URL(request.url).searchParams;
  return compact({
    cursor: value(params, "cursor"),
    connection: value(params, "connection"),
    search: value(params, "search"),
    from: value(params, "from"),
    to: value(params, "to"),
  });
}

export function queueTargetQuery(request: Request): QueueTargetRunsQuery {
  const params = new URL(request.url).searchParams;
  const status = params.getAll("status").filter(isStatus);
  return compact({
    cursor: value(params, "cursor"),
    search: value(params, "search"),
    from: value(params, "from"),
    to: value(params, "to"),
    status: status.length > 0 ? status : undefined,
  });
}

export function presentQueueTargets(page: QueueTargetsPageDto): QueueTargetsPresentation {
  return {
    generatedAt: page.generatedAt,
    environment: {
      queued: page.environmentSummary.queued,
      running: page.environmentSummary.running,
    },
    queueTargets: page.queueTargets.map(presentQueueTargetSummary),
    pagination: {
      previous: page.pagination.previous ?? undefined,
      next: page.pagination.next ?? undefined,
    },
    connectionOptions: page.options.connections,
    timeRanges: page.options.timeRanges,
    hasAnyQueueTargets: page.hasAnyQueueTargets,
    hasFilters: Object.values(page.filters).some(hasFilterValue),
  };
}

export function presentQueueTarget(page: QueueTargetDetailDto): QueueTargetDetailPresentation {
  const target = presentQueueTargetSummary(page.queueTarget);

  return {
    generatedAt: page.generatedAt,
    queueTarget: target,
    stats: {
      queued: page.queueTarget.recordedRunCounts.queued,
      running: page.queueTarget.recordedRunCounts.running,
      peakQueued: Math.max(0, ...page.series.activity.map((point) => point.recordedRunCounts.queued)),
      maximumQueueTime: formatWaitUs(maximumQueueTime(page.series.queueTime)),
    },
    activity: page.series.activity,
    queueTime: page.series.queueTime,
    runs: page.runs.map((run): PresentedRun => ({
      id: run.id,
      path: `/runs/${encodeURIComponent(run.id)}`,
      jobType: run.name,
      status: run.status,
      queueTarget: target.destination,
      traceIdentity: run.traceId,
      attemptCount: run.attemptCount,
      startedAt: run.startedAt,
      queueDuration: formatDuration(run.queueDurationUs),
      duration: formatDuration(run.durationUs ?? run.activeDurationUs),
    })),
    pagination: {
      previous: page.pagination.previous ?? undefined,
      next: page.pagination.next ?? undefined,
    },
    statusOptions: page.options.statuses,
    timeRanges: page.options.timeRanges,
    hasAnyRuns: page.hasAnyRuns,
    hasFilters: Object.values(page.filters).some(hasFilterValue),
  };
}

function presentQueueTargetSummary(target: QueueTargetSummary) {
  return {
    id: target.id,
    path: `/queues/${encodeURIComponent(target.id)}`,
    connection: target.connection,
    queue: target.queue,
    destination: `${target.connection} / ${target.queue}`,
    queued: target.recordedRunCounts.queued,
    running: target.recordedRunCounts.running,
    health: queueHealth(target.recordedRunCounts),
    delayP95: formatWaitUs(target.queueTime.p95Us),
    recordedRuns: target.recordedRunCount.toLocaleString(),
    recordedRunCounts: target.recordedRunCounts,
    queueTimeSampleCount: target.queueTime.sampleCount,
    medianQueueTime: formatWaitUs(target.queueTime.medianUs),
    p95QueueTime: formatWaitUs(target.queueTime.p95Us),
    maximumQueueTime: formatWaitUs(target.queueTime.maximumUs),
    firstObservedAt: target.firstObservedAt,
    lastObservedAt: target.lastObservedAt,
  };
}

function formatWaitUs(microseconds: number | null): string {
  if (microseconds === null) return "–";
  const milliseconds = microseconds / 1_000;
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(1)}s`;
  if (milliseconds < 3_600_000) return `${(milliseconds / 60_000).toFixed(1)}m`;
  return `${(milliseconds / 3_600_000).toFixed(1)}h`;
}

function maximumQueueTime(points: QueueTargetDetailDto["series"]["queueTime"]): number | null {
  const values = points.flatMap((point) => point.maximumUs === null ? [] : [point.maximumUs]);

  return values.length > 0 ? Math.max(...values) : null;
}

function queueHealth(counts: Record<RunStatus, number>): "Queued" | "Active" | "Idle" {
  if (counts.queued > 0) return "Queued";
  if (counts.running + counts.retrying > 0) return "Active";
  return "Idle";
}

function value(params: URLSearchParams, key: string) {
  return params.get(key) || undefined;
}

function isStatus(value: string): value is RunStatus {
  return ["queued", "running", "retrying", "completed", "failed"].includes(value);
}

function hasFilterValue(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "";
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
