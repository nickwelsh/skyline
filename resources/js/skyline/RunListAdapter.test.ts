import { describe, expect, it } from "vitest";
import { presentRun, runsQuery } from "./RunListAdapter";
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
      queueDuration: "1ms",
      duration: "1.00s",
      activeDuration: "—",
      queueTarget: "redis / default",
    }));
    expect(presented).not.toHaveProperty("driverId");
    expect(presented).not.toHaveProperty("queueTimeSource");
    expect(presented).not.toHaveProperty("traceIdentity");
    expect(presented).not.toHaveProperty("attemptCount");
    expect(presented).toMatchObject({ queueDurationMs: 1, runDurationMs: 1_000, computeDurationMs: null });
  });

  it("keeps missing active duration truthful", () => {
    expect(presentRun(run(), "state").activeDuration).toBe("—");
  });

  it("applies the visible seven-day default through the API query", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");

    expect(runsQuery(new Request("https://example.test/skyline/runs"), now)).toEqual({
      triggeredFrom: "2026-07-31T12:00:00.000Z",
      triggeredTo: "2026-08-07T12:00:00.000Z",
    });
  });

  it("preserves repeated statuses and explicit public time bounds", () => {
    const request = new Request("https://example.test/skyline/runs?status=running&status=completed&triggeredFrom=2026-08-01T00%3A00%3A00.000Z&triggeredTo=2026-08-02T00%3A00%3A00.000Z");

    expect(runsQuery(request)).toEqual({
      status: ["running", "completed"],
      triggeredFrom: "2026-08-01T00:00:00.000Z",
      triggeredTo: "2026-08-02T00:00:00.000Z",
    });
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
