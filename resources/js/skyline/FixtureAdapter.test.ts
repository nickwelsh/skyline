import { describe, expect, it } from "vitest";
import { FixtureAdapter } from "./FixtureAdapter";

describe("FixtureAdapter", () => {
  it("keeps the environment Queue summary independent of row filters", async () => {
    const adapter = new FixtureAdapter();
    const unfiltered = await adapter.queueTargets();
    const filtered = await adapter.queueTargets({ search: "missing queue target" });

    expect(filtered.queueTargets).toEqual([]);
    expect(unfiltered.environmentSummary).toEqual({
      queued: unfiltered.queueTargets.reduce((total, target) => total + target.recordedRunCounts.queued, 0),
      running: unfiltered.queueTargets.reduce((total, target) => total + target.recordedRunCounts.running, 0),
      allocated: null,
      limit: null,
    });
    expect(filtered.environmentSummary).toEqual(unfiltered.environmentSummary);
  });

  it("applies Telemetry-event search without losing unfiltered evidence state", async () => {
    const page = await new FixtureAdapter().telemetryEvents({ search: "import delayed" });

    expect(page.telemetryEvents.map((event) => event.id)).toEqual(["event_fixture_log"]);
    expect(page.filters.search).toBe("import delayed");
    expect(page.hasAnyTelemetryEvents).toBe(true);
  });

  it("adapts grouped failure fixtures without erasing occurrence evidence", async () => {
    const adapter = new FixtureAdapter();
    const page = await adapter.errorGroups({ exceptionClass: "Illuminate\\Database\\DeadlockException" });

    expect(page.errorGroups).toHaveLength(1);
    expect(page.errorGroups[0]).toMatchObject({
      occurrenceCount: 2,
      jobType: "App\\Jobs\\GenerateMonthlyInvoices",
      exceptionClass: "Illuminate\\Database\\DeadlockException",
    });
    expect(page.options.exceptionClasses).toEqual(["Illuminate\\Database\\DeadlockException", "UnexpectedValueException"]);

    const detail = await adapter.errorGroup(page.errorGroups[0].id);
    expect(detail.failedAttempts.map((attempt) => attempt.exception.message)).toEqual([
      "Deadlock found when trying to get lock; retry transaction",
      "Deadlock victim selected for invoice batch 42",
    ]);
    expect(detail.representative.frames.map((frame) => frame.isVendor)).toEqual([false, true]);
    expect(detail.activity.reduce((total, point) => total + point.occurrences, 0)).toBe(2);
  });

  it("filters mixed Error groups at the occurrence evidence seam", async () => {
    const adapter = new FixtureAdapter();
    const matched = await adapter.errorGroups({ search: "victim selected" });

    expect(matched.errorGroups).toHaveLength(1);
    expect(matched.errorGroups[0]).toMatchObject({
      representativeMessage: "Deadlock victim selected for invoice batch 42",
      occurrenceCount: 1,
      latest: { runId: "run_fixture_repeated_deadlock" },
    });
    expect(matched.errorGroups[0].activity.reduce((total, point) => total + point.occurrences, 0)).toBe(1);
    await expect(adapter.errorGroups({ search: "billing" })).resolves.toMatchObject({ errorGroups: [] });
  });

  it("adapts representative Runs into the pinned 25-row cursor contract", async () => {
    const page = await new FixtureAdapter().runs({ status: ["completed", "failed"] });

    expect(page.runs.map((run) => run.status)).toEqual(["completed", "completed", "failed"]);
    expect(page.pagination).toEqual({ next: null, previous: null });
    expect(page.hasAnyRuns).toBe(true);
    expect(page.runs[0]).toMatchObject({
      id: "run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
      name: "App\\Jobs\\GenerateMonthlyInvoices",
      connection: "redis",
      queue: "billing",
      attemptCount: 2,
      queueDurationUs: 312_000,
      durationUs: 15_300_000,
    });
  });

  it("treats an empty status selection as no Runs filter", async () => {
    const page = await new FixtureAdapter().runs({ status: [] });

    expect(page.runs).toHaveLength(25);
    expect(page.pagination.next).toBe("25");
  });

  it("paginates fixtures and resolves every Runs row to its own trace", async () => {
    const adapter = new FixtureAdapter();
    const first = await adapter.runs();
    const second = await adapter.runs({ cursor: first.pagination.next ?? undefined });

    expect(first.runs).toHaveLength(25);
    expect(first.pagination).toEqual({ next: "25", previous: null });
    expect(second.runs).toHaveLength(5);
    expect(second.pagination).toEqual({ next: null, previous: "0" });

    for (const run of [...first.runs, ...second.runs]) {
      expect((await adapter.trace(run.id)).run.id).toBe(run.id);
    }
  });

  it("applies Job time-range and cursor queries instead of only echoing them", async () => {
    const adapter = new FixtureAdapter();
    const job = (await adapter.jobs({ period: "1h" })).jobs[0];
    const page = await adapter.job(job.id, { period: "1h", cursor: "1" });

    expect(page.runs).toEqual([]);
    expect(page.activity).toMatchObject([{ total: 1 }]);
    expect(page.pagination).toEqual({ next: null, previous: "0" });
    expect(page.filters).toEqual({ status: [], period: "1h" });
  });

  it("adapts retry, child Run, SQL, and exception fixtures at trace and inspector seams", async () => {
    const adapter = new FixtureAdapter();
    const trace = await adapter.trace("run_01J8R4NQX6K3PV4W0A1H2Z7M9C");
    const childTrace = await adapter.trace("run_01J8R4H9S9J12V04CNH6F6JQ3M");
    const query = await adapter.inspector("span_4f24adb545b26d31", trace.run.id);
    const failedAttempt = await adapter.inspector("attempt_run_01J8R4NQX6K3PV4W0A1H2Z7M9C_1", trace.run.id);

    expect(trace.run).toMatchObject({
      id: "run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
      traceId: "fda8d9cf9d53e8845fd0738b8407731d",
      queueTarget: { connection: "redis", queue: "billing" },
      driverId: "redis",
      queueTimeSource: "framework_event",
    });
    expect(trace.attempts.map((attempt) => attempt.number)).toEqual([1, 2]);
    expect(trace.attempts[0]).toMatchObject({
      failure: { class: "Illuminate\\Database\\DeadlockException" },
    });
    expect(trace.relationships.children[0]).toMatchObject({
      id: "run_01J8R4H9S9J12V04CNH6F6JQ3M",
      parentRunId: "run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
    });
    expect(childTrace.run).toMatchObject({
      id: "run_01J8R4H9S9J12V04CNH6F6JQ3M",
      status: "completed",
      parentRunId: trace.run.id,
    });
    expect(trace.trace.nodes.map((node) => node.kind)).toContain("run");
    expect(trace.trace.nodes.map((node) => node.kind)).toContain("attempt");
    expect(trace.trace.nodes.map((node) => node.kind)).toContain("query");
    expect(query).toMatchObject({
      kind: "query",
      telemetryEventHref: "/skyline/api/runs/run_01J8R4NQX6K3PV4W0A1H2Z7M9C/nodes/span_4f24adb545b26d31",
      sql: { value: "insert into `invoices` (`customer_id`, `total`, `created_at`) values (?, ?, ?)" },
    });
    expect(failedAttempt).toMatchObject({
      kind: "attempt",
      exception: { class: "Illuminate\\Database\\DeadlockException" },
    });
  });
});
