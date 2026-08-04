import { describe, expect, it } from "vitest";
import { FixtureAdapter } from "./FixtureAdapter";

describe("FixtureAdapter", () => {
  it("adapts representative Runs into the pinned 25-row cursor contract", () => {
    const page = new FixtureAdapter().runs({ status: ["completed", "failed"], limit: 25 });

    expect(page.runs.map((run) => run.status)).toEqual(["completed", "completed", "failed"]);
    expect(page.pagination).toEqual({ next: undefined, previous: undefined });
    expect(page.hasAnyRuns).toBe(true);
    expect(page.runs[0]).toMatchObject({
      id: "run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
      name: "App\\Jobs\\GenerateMonthlyInvoices",
      connection: "redis",
      queue: "billing",
      attemptCount: 2,
      queueDurationMs: 312,
      durationMs: 15_300,
    });
  });

  it("paginates fixtures and resolves every Runs row to its own trace", () => {
    const adapter = new FixtureAdapter();
    const first = adapter.runs({ limit: 25 });
    const second = adapter.runs({ cursor: first.pagination.next, limit: 25 });

    expect(first.runs).toHaveLength(25);
    expect(first.pagination).toEqual({ next: "25", previous: undefined });
    expect(second.runs).toHaveLength(5);
    expect(second.pagination).toEqual({ next: undefined, previous: "0" });

    for (const run of [...first.runs, ...second.runs]) {
      expect(adapter.trace(run.id).run.id).toBe(run.id);
    }
  });

  it("adapts retry, child Run, SQL, and exception fixtures at trace and inspector seams", () => {
    const adapter = new FixtureAdapter();
    const trace = adapter.trace("run_01J8R4NQX6K3PV4W0A1H2Z7M9C");
    const query = adapter.inspector("span_4f24adb545b26d31");
    const failedAttempt = adapter.inspector("attempt_01J8R4NQX6K3PV4W0A1H2Z7M9C_1");

    expect(trace.run).toMatchObject({
      id: "run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
      traceId: "fda8d9cf9d53e8845fd0738b8407731d",
    });
    expect(trace.trace.events.map((event) => event.data.kind)).toContain("run");
    expect(trace.trace.events.map((event) => event.data.kind)).toContain("attempt");
    expect(trace.trace.events.map((event) => event.data.kind)).toContain("query");
    expect(query).toMatchObject({ kind: "query", sql: "insert into `invoices` (`customer_id`, `total`, `created_at`) values (?, ?, ?)" });
    expect(failedAttempt).toMatchObject({
      kind: "attempt",
      exception: { class: "Illuminate\\Database\\DeadlockException" },
    });
  });
});
