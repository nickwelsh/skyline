import { describe, expect, it } from "vitest";
import { canonicalActionUrl } from "./actions";

describe("canonical action URL", () => {
  it("keeps the reference selection query on its canonical route", () => {
    expect(canonicalActionUrl(
      "/oracle/runs-exception-expanded?span=attempt_run_1_1",
      "/skyline/runs/run_1",
    )).toBe("/skyline/runs/run_1?span=attempt_run_1_1");
  });

  it("keeps a pinned canonical query when the harness route has none", () => {
    expect(canonicalActionUrl("/oracle/log-found", "/skyline/logs?event=event_1")).toBe("/skyline/logs?event=event_1");
  });
});
