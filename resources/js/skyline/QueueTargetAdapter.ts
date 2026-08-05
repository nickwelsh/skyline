import type { PresentedRun } from "../trigger/components/runs/v3/TaskRunsTable";
import type { QueueTargetDetailPresentation } from "../trigger/components/queues/QueueTargetDetailPresenter";
import type { QueueTargetsPresentation } from "../trigger/components/queues/QueueTargetsPresenter";
import type {
  QueueTargetDetailDto,
  QueueTargetRunsQuery,
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
    queueTargets: page.queueTargets.map((target) => ({
      id: target.id,
      path: `/queues/${encodeURIComponent(target.id)}`,
      connection: target.connection,
      queue: target.queue,
      destination: `${target.connection} / ${target.queue}`,
      state: busyCount(target.recordedRunCounts) > 0 ? "Busy" : "Idle",
      recordedRuns: target.recordedRunCount.toLocaleString(),
      recordedRunCounts: target.recordedRunCounts,
      queueTimeSampleCount: target.queueTime.sampleCount,
      medianQueueTime: formatDuration(target.queueTime.medianUs),
      p95QueueTime: formatDuration(target.queueTime.p95Us),
      maximumQueueTime: formatDuration(target.queueTime.maximumUs),
      firstObservedAt: target.firstObservedAt,
      lastObservedAt: target.lastObservedAt,
    })),
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
  const target = presentQueueTargets({
    ...page,
    queueTargets: [page.queueTarget],
    options: { connections: [page.queueTarget.connection], timeRanges: page.options.timeRanges },
    hasAnyQueueTargets: true,
  }).queueTargets[0];

  return {
    generatedAt: page.generatedAt,
    queueTarget: target,
    activity: page.series.activity,
    queueTime: page.series.queueTime.filter((point): point is typeof point & {
      medianUs: number;
      p95Us: number;
      maximumUs: number;
    } => point.medianUs !== null && point.p95Us !== null && point.maximumUs !== null),
    runs: page.runs.map((run): PresentedRun => ({
      id: run.id,
      path: `/runs/${encodeURIComponent(run.id)}`,
      jobType: run.name,
      status: run.status,
      queueTarget: target.destination,
      traceIdentity: run.traceId,
      attemptCount: run.attemptCount,
      triggeredAt: run.triggeredAt,
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

function busyCount(counts: Record<RunStatus, number>) {
  return counts.queued + counts.running + counts.retrying;
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
