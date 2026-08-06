import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { conditionErrorDetailCapabilities, conditionErrorRunTableCapabilities } from "../reference/capability-adapters";
import { createReferenceFixture, referenceQueueMetricKey } from "./reference";

describe("pinned Trigger Errors fixture", () => {
  test("conditions unavailable detail versions and bulk replay without editing pinned source", () => {
    const root = resolve(import.meta.dirname, "../reference/vendor");
    const detail = conditionErrorDetailCapabilities(
      readFileSync(resolve(root, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx"), "utf8"),
      { hiddenMutableRegions: ["detail-status"], detailVersions: false, detailBulkReplay: false },
    );
    const table = conditionErrorRunTableCapabilities(
      readFileSync(resolve(root, "components/runs/v3/TaskRunsTable.tsx"), "utf8"),
      { detailVersions: false },
    );

    expect(detail).toContain("errorCapabilityPolicy.detailVersions ? <LogsVersionFilter /> : null");
    expect(detail).toContain("errorCapabilityPolicy.detailBulkReplay ? (");
    expect(table).toContain("showErrorVersions ? <TableHeaderCell>Version</TableHeaderCell> : null");
    expect(table).toContain("showErrorVersions ? <TableCell to={path}>{run.version ?? \"–\"}</TableCell> : null");
    expect(table).toContain("showErrorTaskKind ? (");
  });

  test("maps Skyline occurrences into the reached presenter seams", async () => {
    const fixture = await createReferenceFixture();
    const list = fixture.loaders.errors as any;
    const detail = fixture.loaders.error as any;
    const group = list.data.errorGroups[0];

    expect(list.occurrences.data[group.fingerprint]).toEqual([
      expect.objectContaining({ date: expect.any(String), count: expect.any(Number) }),
    ]);
    expect(list.data.filters.possibleTasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: expect.any(String) })]),
    );
    expect(detail.activity.versions).toEqual(["20260804.1"]);
    expect(detail.activity.data).toEqual([
      expect.objectContaining({ date: expect.any(String), "20260804.1": expect.any(Number) }),
    ]);
    expect(detail.data.runList.runs).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "COMPLETED_WITH_ERRORS", taskIdentifier: expect.any(String) }),
    ]));
  });
});

describe("pinned Trigger Logs fixture", () => {
  test("maps task filters and selected log into Trigger presenter contracts", async () => {
    const fixture = await createReferenceFixture();
    const list = fixture.loaders.logs as any;
    const detail = fixture.loaders.log as any;

    expect(list.data.possibleTasks).toEqual([
      { slug: "App\\Jobs\\GenerateMonthlyInvoices" },
    ]);
    expect(detail.selectedLog).toEqual(expect.objectContaining({
      id: expect.any(String),
      runId: expect.any(String),
      taskIdentifier: "App\\Jobs\\GenerateMonthlyInvoices",
      spanId: expect.any(String),
      triggeredTimestamp: expect.any(String),
      level: "WARN",
      message: "Invoice import delayed",
      attributes: expect.objectContaining({ "log.context": { code: 429 } }),
    }));
  });
});

describe("pinned Trigger failed-Attempt fixture", () => {
  test("maps exact Attempt and query resources for every exception state", async () => {
    const fixture = await createReferenceFixture();
    const resources = fixture.resources as any;
    const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
    const rootSpan = `span_${runId}`;
    const failedAttempt = `attempt_${runId}_1`;
    const retryAttempt = `attempt_${runId}_2`;

    expect(resources.spans[rootSpan]).toMatchObject({ type: "run", run: { friendlyId: runId } });
    expect(resources.spans[failedAttempt]).toMatchObject({
      type: "run",
      run: { error: { type: "BUILT_IN_ERROR", name: "Illuminate\\Database\\DeadlockException" } },
    });
    expect(resources.spans.span_4f24adb545b26d31).toMatchObject({ type: "span" });
    expect(resources.spanStates["exception-long"][failedAttempt].run.error.stackTrace.split("\n").length).toBeGreaterThan(20);
    expect(resources.spanStates["exception-retry"][retryAttempt]).toMatchObject({
      type: "run",
      run: { error: { name: "LogicException", message: "Retry failed differently.", stackTrace: expect.stringContaining("app/Jobs/FinalizeInvoices.php:73") } },
    });
    expect(resources.spanStates["exception-retry"][retryAttempt].run.error.stackTrace).toContain("vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php:124");
    expect(resources.spanStates["exception-unavailable"][failedAttempt]).toMatchObject({ type: "span" });
  });
});

describe("pinned Trigger Queues fixture", () => {
  test("classifies exact environment live query separately from broker-only live data", () => {
    expect(referenceQueueMetricKey("SELECT timeBucket() AS t, max(max_env_queued) AS env_queued, max(max_env_running) AS env_running FROM env_metrics GROUP BY t ORDER BY t")).toBe("environmentLive");
    expect(referenceQueueMetricKey("SELECT q_limit FROM queue_metrics")).toBe("live");
    expect(referenceQueueMetricKey("SELECT unknown FROM queue_metrics")).toBeUndefined();
  });

  test("preserves observed list and detail evidence behind source presenter seams", async () => {
    const fixture = await createReferenceFixture();
    const list = fixture.loaders.queues as any;
    const detail = fixture.loaders.queue as any;
    const queue = list.queues.find(({ name }: { name: string }) => name === "default");

    expect(queue).toEqual(expect.objectContaining({
      id: "queue_3b6b7027",
      connection: "redis",
      name: "default",
      firstObservedAt: expect.any(String),
      lastObservedAt: expect.any(String),
      recordedRunCounts: expect.objectContaining({ completed: expect.any(Number) }),
      queueTime: expect.objectContaining({ sampleCount: expect.any(Number), p95Us: expect.any(Number) }),
    }));
    expect(list.observed).toEqual(expect.objectContaining({
      pagination: { previous: null, next: null },
      filters: expect.objectContaining({ connection: null, search: null }),
      options: expect.objectContaining({ connections: expect.arrayContaining(["redis"]) }),
    }));
    expect(detail.observed.activity).toEqual(expect.arrayContaining([
      expect.objectContaining({ timestamp: expect.any(String), recordedRuns: 1 }),
    ]));
    expect(detail.observed.queueTime).toEqual(expect.arrayContaining([
      expect.objectContaining({ timestamp: expect.any(String), sampleCount: 1, p95Us: expect.any(Number) }),
    ]));
    expect(detail.runList).toEqual(expect.objectContaining({
      runs: expect.arrayContaining([expect.objectContaining({
        friendlyId: expect.any(String),
        taskIdentifier: expect.any(String),
        startedAt: expect.any(String),
      })]),
      pagination: { previous: undefined, next: undefined },
    }));
    expect(fixture.resources?.queueMetrics).toEqual(expect.objectContaining({
      concurrency: expect.arrayContaining([expect.objectContaining({ t: expect.any(String), running: expect.any(Number), limit: null })]),
      queueDepth: expect.arrayContaining([expect.objectContaining({ t: expect.any(String), queued: expect.any(Number) })]),
      schedulingDelay: expect.arrayContaining([expect.objectContaining({ t: expect.any(String), p50: expect.any(Number), p95: expect.any(Number), samples: 1 })]),
      environmentSaturation: [],
      environmentBacklog: [],
      environmentSchedulingDelay: [],
      environmentThrottled: [],
      environmentLive: [{
        t: "2026-08-05T20:02:00.000Z",
        env_queued: list.environment.queued,
        env_running: list.environment.running,
      }],
      live: [],
    }));
  });
});
