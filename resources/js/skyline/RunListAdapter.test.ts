import { describe, expect, it } from "vitest";
import { presentRun } from "./RunListAdapter";
import type { RunSummary } from "./dto";

describe("RunListAdapter", () => {
  it("preserves compact millisecond formatting in Runs", () => {
    const presented = presentRun(run(), "state");

    expect(presented).toEqual(expect.objectContaining({
      id: "run_1",
      friendlyId: "run_1",
      path: "/runs/run_1?tableState=state",
      isRoot: false,
      jobType: "App\\Jobs\\Invoice",
      taskIdentifier: "App\\Jobs\\Invoice",
      rootTaskRunId: "run_parent",
      status: "completed",
      startedAt: "2026-08-05T12:00:00.001000000Z",
      finishedAt: "2026-08-05T12:00:01.001000000Z",
      queueDuration: "1ms",
      duration: "1.00s",
      activeDuration: "1.00s",
      queueTarget: "redis / default",
    }));
    expect(presented).not.toHaveProperty("driverId");
    expect(presented).not.toHaveProperty("queueTimeSource");
  });
});

function run(): RunSummary {
  return {
    id: "run_1",
    traceId: "trace_1",
    parentRunId: "run_parent",
    isRoot: false,
    name: "App\\Jobs\\Invoice",
    status: "completed",
    connection: "redis",
    queue: "default",
    driverId: "redis-job-42",
    attemptCount: 1,
    triggeredAt: "2026-08-05T12:00:00.000000000Z",
    queuedAt: "2026-08-05T12:00:00.000000000Z",
    startedAt: "2026-08-05T12:00:00.001000000Z",
    finishedAt: "2026-08-05T12:00:01.001000000Z",
    queueDurationUs: 1_000,
    queueTimeSource: "framework_event",
    durationUs: 1_000_000,
    revision: 1,
  };
}
