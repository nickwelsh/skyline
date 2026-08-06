import { describe, expect, it } from "vitest";
import { presentQueueTarget, presentQueueTargets, queueTargetQuery, queueTargetsQuery } from "./QueueTargetAdapter";
import type { QueueTargetDetailDto, QueueTargetsPageDto } from "./dto";

describe("QueueTargetAdapter", () => {
  it("reads shareable Queue-target list and detail filters", () => {
    expect(queueTargetsQuery(new Request("https://example.test/skyline/queues?connection=redis&search=bill&from=2026-08-01T00%3A00%3A00Z&to=2026-08-02T00%3A00%3A00Z&cursor=next"))).toEqual({
      connection: "redis",
      search: "bill",
      from: "2026-08-01T00:00:00Z",
      to: "2026-08-02T00:00:00Z",
      cursor: "next",
    });
    expect(queueTargetQuery(new Request("https://example.test/skyline/queues/queue_1?status=failed&status=running&search=Invoice"))).toEqual({
      status: ["failed", "running"],
      search: "Invoice",
    });
  });

  it("presents captured Queue evidence through the source list metrics seam", () => {
    const route = presentQueueTargets(listPage());

    expect(route.environment).toEqual({ queued: 1, running: 1, allocated: null, limit: null });
    expect(route.queueTargets[0]).toEqual(expect.objectContaining({
      path: "/queues/queue_redis",
      destination: "redis / billing",
      state: "Busy",
      queued: 1,
      running: 1,
      limit: null,
      limitedBy: "Environment",
      health: "Backlogged",
      delayP95: "4.70ms",
      backlog: [1],
      recordedRuns: "3",
    }));
    expect(route.connectionOptions).toEqual(["redis", "sqs"]);
    expect(route.timeRanges).toEqual([
      { value: "all", label: "All time", durationSeconds: null },
      { value: "24h", label: "Last 24 hours", durationSeconds: 86_400 },
    ]);
    expect(route.queueTargets[0]).toEqual(expect.objectContaining({
      recordedRunCounts: { queued: 1, running: 1, retrying: 0, completed: 1, failed: 0 },
      queueTimeSampleCount: 2,
      firstObservedAt: "2026-08-05T11:00:00.000000000Z",
      lastObservedAt: "2026-08-05T12:00:00.000000000Z",
    }));
    expect(JSON.stringify(route)).not.toMatch(/brokerDepth|workers|concurrency|pause/i);
  });

  it("presents captured Queue evidence through the source detail metrics seam", () => {
    const route = presentQueueTarget(detailPage());

    expect(route.queueTarget.destination).toBe("redis / billing");
    expect(route.stats).toEqual({
      running: 1,
      limit: null,
      queued: 1,
      peakQueued: 0,
      oldestWait: "0",
      worstWait: "2.00ms",
    });
    expect(route.activity[0]).toEqual(expect.objectContaining({ timestamp: "2026-08-05T12:00:00.000000000Z", recordedRuns: 1 }));
    expect(route.queueTime[0]).toEqual(expect.objectContaining({ medianUs: 2000, p95Us: 2000 }));
    expect(route.runs[0]).toEqual(expect.objectContaining({
      path: "/runs/run_1",
      jobType: "App\\Jobs\\Invoice",
      queueTarget: "redis / billing",
      startedAt: "2026-08-05T12:00:00.002000000Z",
    }));
    expect(route.timeRanges).toEqual([
      { value: "all", label: "All time", durationSeconds: null },
      { value: "24h", label: "Last 24 hours", durationSeconds: 86_400 },
    ]);
  });
});

function listPage(): QueueTargetsPageDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00.000000000Z",
    capabilities: {} as QueueTargetsPageDto["capabilities"],
    queueTargets: [summary()],
    pagination: { previous: null, next: null },
    filters: { connection: null, search: null, from: null, to: null, status: [] },
    options: {
      connections: ["redis", "sqs"],
      timeRanges: [{ value: "all", label: "All time", durationSeconds: null }, { value: "24h", label: "Last 24 hours", durationSeconds: 86_400 }],
    },
    hasAnyQueueTargets: true,
  };
}

function detailPage(): QueueTargetDetailDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00.000000000Z",
    capabilities: {} as QueueTargetDetailDto["capabilities"],
    queueTarget: summary(),
    series: {
      activity: [{
        timestamp: "2026-08-05T12:00:00.000000000Z",
        recordedRuns: 1,
        recordedRunCounts: { queued: 0, running: 0, retrying: 0, completed: 1, failed: 0 },
      }],
      queueTime: [{ timestamp: "2026-08-05T12:00:00.000000000Z", sampleCount: 1, medianUs: 2000, p95Us: 2000, maximumUs: 2000 }],
    },
    runs: [{
      id: "run_1",
      href: "/skyline/runs/run_1",
      traceId: "trace_1",
      name: "App\\Jobs\\Invoice",
      status: "completed",
      attemptCount: 1,
      triggeredAt: "2026-08-05T12:00:00.000000000Z",
      startedAt: "2026-08-05T12:00:00.002000000Z",
      finishedAt: "2026-08-05T12:00:01.000000000Z",
      queueDurationUs: 2000,
      durationUs: 998000,
      activeDurationUs: null,
    }],
    pagination: { previous: null, next: null },
    filters: { connection: null, search: null, from: null, to: null, status: [] },
    options: {
      statuses: ["queued", "running", "retrying", "completed", "failed"],
      timeRanges: [{ value: "all", label: "All time", durationSeconds: null }, { value: "24h", label: "Last 24 hours", durationSeconds: 86_400 }],
    },
    hasAnyRuns: true,
    queueCapabilities: {
      pause: false,
      resume: false,
      concurrency: false,
      allocation: false,
      rateLimit: false,
      workers: false,
      billing: false,
      environmentControls: false,
    },
  };
}

function summary() {
  return {
    id: "queue_redis",
    connection: "redis",
    queue: "billing",
    firstObservedAt: "2026-08-05T11:00:00.000000000Z",
    lastObservedAt: "2026-08-05T12:00:00.000000000Z",
    recordedRunCount: 3,
    recordedRunCounts: { queued: 1, running: 1, retrying: 0, completed: 1, failed: 0 },
    queueTime: { sampleCount: 2, medianUs: 2000, p95Us: 4700, maximumUs: 5000 },
  };
}
