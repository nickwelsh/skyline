import { describe, expect, it } from "vitest";
import { presentRun } from "./RunListAdapter";
import type { RunSummary } from "./dto";

describe("RunListAdapter", () => {
  it("preserves compact millisecond formatting in Runs", () => {
    expect(presentRun(run(), "state")).toEqual(expect.objectContaining({
      queueDuration: "1ms",
      duration: "1.00s",
    }));
  });
});

function run(): RunSummary {
  return {
    id: "run_1",
    traceId: "trace_1",
    isRoot: true,
    name: "App\\Jobs\\Invoice",
    status: "completed",
    connection: "redis",
    queue: "default",
    attemptCount: 1,
    triggeredAt: "2026-08-05T12:00:00.000000000Z",
    queuedAt: "2026-08-05T12:00:00.000000000Z",
    startedAt: "2026-08-05T12:00:00.001000000Z",
    finishedAt: "2026-08-05T12:00:01.001000000Z",
    queueDurationUs: 1_000,
    durationUs: 1_000_000,
    revision: 1,
  };
}
