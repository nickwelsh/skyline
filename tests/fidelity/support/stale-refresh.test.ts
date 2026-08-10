import { describe, expect, test } from "vitest";
import { staleRefreshPlan } from "./stale-refresh";

describe("stale refresh transition", () => {
  test("revalidates selected log detail through its resource route", () => {
    expect(staleRefreshPlan({ id: "log-stale-refresh", surface: "log", state: "stale-refresh", kind: "detail" })).toEqual({
      referenceState: "stale-refresh",
      selectedDetail: { skyline: "event", reference: "log" },
      transition: "resource",
    });
  });

  test("keeps page-owned detail transitions on route revalidation", () => {
    expect(staleRefreshPlan({ id: "run-stale-refresh", surface: "run", state: "stale-refresh", kind: "detail" })).toEqual({
      referenceState: undefined,
      selectedDetail: undefined,
      transition: "page",
    });
  });

  test("revalidates Queue detail while its observed metric resource stays stale", () => {
    expect(staleRefreshPlan({ id: "queue-stale-refresh", surface: "queue", state: "stale-refresh", kind: "detail" })).toEqual({
      referenceState: "stale-refresh",
      selectedDetail: undefined,
      transition: "resource",
    });
  });
});
