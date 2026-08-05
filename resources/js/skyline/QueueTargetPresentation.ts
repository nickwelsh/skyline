import type { PresentedRun } from "../trigger/components/runs/v3/TaskRunsTable";
import type { QueueTimeRangeOption, RunStatus } from "./dto";

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

export type QueueTargetsPresentation = {
  generatedAt: string;
  queueTargets: PresentedQueueTarget[];
  pagination: { previous?: string; next?: string };
  connectionOptions: string[];
  timeRanges: QueueTimeRangeOption[];
  hasAnyQueueTargets: boolean;
  hasFilters: boolean;
};

type ActivityPoint = { timestamp: string; recordedRuns: number; recordedRunCounts: Record<RunStatus, number> };
type QueueTimePoint = { timestamp: string; sampleCount: number; medianUs: number; p95Us: number; maximumUs: number };

export type QueueTargetDetailPresentation = {
  generatedAt: string;
  queueTarget: PresentedQueueTarget;
  activity: ActivityPoint[];
  queueTime: QueueTimePoint[];
  runs: PresentedRun[];
  pagination: { previous?: string; next?: string };
  statusOptions: RunStatus[];
  timeRanges: QueueTimeRangeOption[];
  hasAnyRuns: boolean;
  hasFilters: boolean;
};
