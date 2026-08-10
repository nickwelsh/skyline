type QueueActivityPoint = {
  timestamp: string;
  recordedRuns: number;
  recordedRunCounts: Record<"queued" | "running" | "retrying" | "completed" | "failed", number>;
};

type QueueTimePoint = {
  timestamp: string;
  sampleCount: number;
  medianUs: number | null;
  p95Us: number | null;
  maximumUs: number | null;
};

export function queueActivityWaitHistory<T extends { series: { activity: QueueActivityPoint[]; queueTime: QueueTimePoint[] } }>(detail: T): T {
  const clone = structuredClone(detail);
  const timestamps = [...clone.series.activity, ...clone.series.queueTime].map(({ timestamp }) => timestamp);
  const timestamp = (index: number) => timestamps[index] ?? new Date(Date.parse("2026-08-05T20:00:00.000Z") + index * 60_000).toISOString();

  clone.series.activity = [
    activity(timestamp(0), { queued: 3 }),
    activity(timestamp(1), { running: 2 }),
    activity(timestamp(2), { queued: 1, running: 1 }),
  ];
  clone.series.queueTime = [
    wait(timestamp(3), 5_000, 15_000, 25_000),
    wait(timestamp(4), 40_000, 80_000, 120_000),
    wait(timestamp(5), 20_000, 35_000, 50_000),
  ];
  return clone;
}

function activity(timestamp: string, counts: Partial<QueueActivityPoint["recordedRunCounts"]>): QueueActivityPoint {
  const recordedRunCounts = { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0, ...counts };
  return { timestamp, recordedRuns: Object.values(recordedRunCounts).reduce((sum, count) => sum + count, 0), recordedRunCounts };
}

function wait(timestamp: string, medianUs: number, p95Us: number, maximumUs: number): QueueTimePoint {
  return { timestamp, sampleCount: 1, medianUs, p95Us, maximumUs };
}
