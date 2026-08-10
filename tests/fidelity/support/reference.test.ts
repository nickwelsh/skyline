import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import ts from "typescript";
import {
  conditionErrorDetailCapabilities,
  conditionErrorRunQueueSemantics,
  conditionErrorRunTableCapabilities,
  conditionRunsFilterCapabilities,
  conditionRunDetailCapabilities,
  conditionRunInspectorCapabilities,
  conditionRunsRouteCapabilities,
  conditionRunsTableCapabilities,
} from "../reference/capability-adapters";
import { createReferenceFixture, referenceDetailLifecyclePolicy, referenceQueueMetricKey, triggerJobs } from "./reference";

describe("pinned Trigger Errors fixture", () => {
  test("conditions unavailable detail versions and bulk replay without editing pinned source", () => {
    const root = resolve(import.meta.dirname, "../reference/vendor");
    const detail = conditionErrorDetailCapabilities(
      readFileSync(resolve(root, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route.tsx"), "utf8"),
      { hiddenMutableRegions: ["detail-status"], detailVersions: false, detailMachines: false, detailPlatformColumns: false, detailPagination: true, detailBulkReplay: false },
    );
    const sourceTable = readFileSync(resolve(root, "components/runs/v3/TaskRunsTable.tsx"), "utf8");
    const table = conditionErrorRunQueueSemantics(conditionRunsTableCapabilities(conditionErrorRunTableCapabilities(
      sourceTable,
      { detailVersions: false, detailMachines: false, detailPlatformColumns: false },
    )));

    expect(detail).toContain("errorCapabilityPolicy.detailVersions ? <LogsVersionFilter /> : null");
    expect(detail).toContain("errorCapabilityPolicy.detailVersions && errorGroup.affectedVersions.length > 0");
    expect(detail).toContain("<ListPagination list={runList} />");
    expect(detail).not.toContain("errorCapabilityPolicy.detailPagination ?");
    expect(detail).toContain("errorCapabilityPolicy.detailBulkReplay ? (");
    expect(table).toContain("showErrorVersions ? <TableHeaderCell>Version</TableHeaderCell> : null");
    expect(table).toContain("showErrorVersions ? <TableCell to={path}>{run.version ?? \"–\"}</TableCell> : null");
    expect(table).toContain("showErrorTaskKind ? (");
    expect(table).toContain("showErrorMachines ? (");
    expect(table).toContain("showErrorPlatformColumns ? (");
    expect(table).toContain("colSpan={visibleColumnCount}");
    expect(table).toContain("isErrorRunTable ? (");
    expect(table).toContain("<TableCell to={path} leadingContent={");
    expect(table).toContain('<span className="sr-only">{(run as NextRunListItem & { queueTarget: string }).queueTarget}</span>');
    expect(table).not.toContain("resources/js/");
    expect(ts.transpileModule(table, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true }).diagnostics?.filter(({ category }) => category === ts.DiagnosticCategory.Error)).toEqual([]);
    expect(() => conditionErrorRunQueueSemantics(conditionRunsTableCapabilities(conditionErrorRunTableCapabilities(
      sourceTable.replace('<TableCell to={path}>\n                  {run.queue.type === "task" ? (', '<TableCell to={path}>\n                  {changed ? ('),
      { detailVersions: false, detailMachines: false, detailPlatformColumns: false },
    )))).toThrow(/must be reviewed/i);
  });

  test("enables every source-owned supported shell item", async () => {
    const fixture = await createReferenceFixture();

    expect(fixture.sourceFeatureFlags).toEqual({ hasQueryAccess: true, hasLogsPageAccess: true });
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
      expect.objectContaining({
        status: "COMPLETED_WITH_ERRORS",
        taskIdentifier: expect.any(String),
        queue: expect.objectContaining({ name: "billing" }),
      }),
    ]));
  });
});

describe("pinned Trigger Runs fixture", () => {
  test("fail-closes unsupported Run mutations, export, and Context at exact source seams", () => {
    const root = resolve(import.meta.dirname, "../reference/vendor");
    const detail = conditionRunDetailCapabilities(
      readFileSync(resolve(root, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx"), "utf8"),
      { replay: false, cancel: false },
    );
    const inspector = conditionRunInspectorCapabilities(
      readFileSync(resolve(root, "routes/resources.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam.spans.$spanParam/route.tsx"), "utf8"),
      { context: false, export: false },
    );

    expect(detail).toContain("runDetailCapabilityPolicy.replay ? (");
    expect(detail).toContain("runDetailCapabilityPolicy.cancel && !run.isFinished && (");
    expect(inspector).toContain('if (!runInspectorCapabilityPolicy.context && tab === "context") tab = undefined;');
    expect(inspector).toContain("runInspectorCapabilityPolicy.context ? (");
    expect(inspector).toContain("runInspectorCapabilityPolicy.export && run.logsDeletedAt === null ? (");
  });

  test("projects the captured trace into a valid source FlatTree with truthful units and icons", async () => {
    const fixture = await createReferenceFixture();
    const detail = fixture.loaders.run as any;
    const events = detail.trace.events;
    const byId = new Map<string, any>(events.map((event: any) => [event.id, event]));

    expect(events[0]).toMatchObject({
      parentId: undefined,
      level: 0,
      hasChildren: true,
      data: { style: { icon: "task" }, offset: 0 },
    });
    expect(events.find((event: any) => event.data.attemptNumber === 1)).toMatchObject({
      level: 1,
      data: { style: { icon: "attempt" } },
    });
    expect(events.find((event: any) => event.data.message.startsWith("insert into"))).toMatchObject({
      data: { style: { icon: "database" } },
    });
    for (const event of events) {
      expect(event.children).toEqual(events.filter((candidate: any) => candidate.parentId === event.id).map((candidate: any) => candidate.id));
      expect(event.hasChildren).toBe(event.children.length > 0);
      expect(event.level).toBe(event.parentId ? byId.get(event.parentId)?.level + 1 : 0);
      expect(event.data.offset % 1_000).toBe(0);
      if (event.data.duration !== null) expect(event.data.duration % 1_000).toBe(0);
      for (const marker of event.data.timelineEvents) expect(marker.offset % 1_000).toBe(0);
    }
  });

  test("conditions unsupported route, filters, and table branches without editing pinned source", () => {
    const root = resolve(import.meta.dirname, "../reference/vendor");
    const route = conditionRunsRouteCapabilities(
      readFileSync(resolve(root, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs._index/route.tsx"), "utf8"),
    );
    const filters = conditionRunsFilterCapabilities(
      readFileSync(resolve(root, "components/runs/v3/RunFilters.tsx"), "utf8"),
    );
    const sourceTable = readFileSync(resolve(root, "components/runs/v3/TaskRunsTable.tsx"), "utf8");
    const table = conditionRunsTableCapabilities(
      conditionErrorRunTableCapabilities(sourceTable, { detailVersions: false, detailMachines: false, detailPlatformColumns: false }),
    );

    expect(route).toContain("hideSearch");
    expect(route).not.toContain("allowSelection\n");
    expect(route).not.toContain('<ResizableHandle\n        id="runs-handle"');
    expect(filters).toContain('const filterTypes = [\n  { name: "queues"');
    expect(filters).toContain('<SearchInput placeholder="Search Runs" />');
    expect(filters).toContain("<span>Jobs</span>");
    expect(table).toContain('formatDuration(new Date(run.createdAt), new Date(run.startedAt)');
    expect(table).toContain('run.queue ? (');
    expect(table).toContain("formatDurationMilliseconds(run.usageDurationMs");
    expect(table).not.toContain("runsCapabilityCore ? run.duration");
    expect(table).toContain("run.queueTarget");
    expect(table).toContain("The amount of compute time used in the run.");
    expect(table).not.toContain("CapabilityRunsTable");
    expect(table).not.toContain("SourceTaskRunsTable");
    const fixtureSource = readFileSync(resolve(import.meta.dirname, "reference.ts"), "utf8");
    expect(fixtureSource).not.toContain("RunListAdapter");
    expect(fixtureSource).not.toContain("formatReferenceDuration");
    expect(fixtureSource).toContain("queue: attempt.queue,");
    expect(fixtureSource).not.toContain('queue: attempt.queue ?? "default"');
  });

  test("maps observed Runs into the capability-conditioned source row seam", async () => {
    const fixture = await createReferenceFixture();
    const list = fixture.loaders.runs as any;

    expect(list.data.runs[0]).toEqual(expect.objectContaining({
      friendlyId: expect.any(String),
      taskIdentifier: expect.any(String),
      queueTarget: expect.stringContaining(" / "),
    }));
    expect(list.data.runs[0]).not.toHaveProperty("activeDuration");
  });
});

describe("pinned Trigger Logs fixture", () => {
  test("uses the literal source Logs filters in source order", () => {
    const referenceRoot = resolve(import.meta.dirname, "../reference/vendor");
    const productRoot = resolve(import.meta.dirname, "../../../resources/js/trigger");
    const route = readFileSync(resolve(productRoot, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.logs/route.tsx"), "utf8");

    for (const name of ["LogsTaskFilter", "LogsRunIdFilter", "LogsLevelFilter"]) {
      const source = readFileSync(resolve(referenceRoot, `components/logs/${name}.tsx`), "utf8");
      const product = readFileSync(resolve(productRoot, `components/logs/${name}.tsx`), "utf8");
      expect(product).toContain("SelectProvider");
      expect(product).toContain("AppliedFilter");
      expect(source).toContain("SelectProvider");
      expect(source).toContain("AppliedFilter");
    }
    expect(readFileSync(resolve(productRoot, "components/logs/LogsTaskFilter.tsx"), "utf8")).toContain("TaskIconSmall");
    const filters = [
      "<LogsTaskFilter possibleTasks={data.possibleTasks} />",
      "<LogsRunIdFilter />",
      "<TimeFilter",
      "<LogsLevelFilter availableLevels={data.filterOptions.levels} />",
    ];
    expect(filters.map((filter) => route.indexOf(filter))).toEqual([...filters.map((filter) => route.indexOf(filter))].sort((a, b) => a - b));
    expect(filters.every((filter) => route.includes(filter))).toBe(true);
    expect(route).not.toContain("function FilterMenu(");
    expect(route).not.toContain("function RunIdFilter(");
    expect(route).toContain("periodOptions={data.filterOptions.timeRanges}");
    expect(route).toContain("allowCustomValues={false}");

    const taskFilter = readFileSync(resolve(productRoot, "components/logs/LogsTaskFilter.tsx"), "utf8");
    expect(taskFilter).toContain('value("tasks")');
    expect(taskFilter).not.toContain('values("tasks")');

    const runIdFilter = readFileSync(resolve(productRoot, "components/logs/LogsRunIdFilter.tsx"), "utf8");
    expect(runIdFilter).not.toContain("makeFriendlyIdValidator");
    expect(runIdFilter).not.toContain("validateRunId");
  });

  test("keeps the list resolved while the selected log resource owns detail lifecycle", () => {
    expect(referenceDetailLifecyclePolicy.log).toEqual({
      defaultSelectionStates: ["loading", "found", "stale-refresh", "api-error", "not-found"],
      pageStates: {
        loading: "resolved",
        "stale-refresh": "resolved",
        "api-error": "resolved",
        "not-found": "resolved",
      },
      resourceStates: {
        loading: "pending",
        "stale-refresh": "stale",
        "api-error": "error",
        "not-found": "not-found",
      },
    });
  });

  test("selects log detail through the source query and resource route", () => {
    const fixtureSource = readFileSync(resolve(import.meta.dirname, "reference.ts"), "utf8");
    const hostSource = readFileSync(resolve(import.meta.dirname, "../reference/main.ts"), "utf8");

    expect(fixtureSource).toContain("return `log=${encodeURIComponent((input.loaders.log as any).selectedLog.id)}`");
    expect(fixtureSource).not.toContain("return `event=${encodeURIComponent((input.loaders.log as any).selectedLog.id)}`");
    expect(hostSource).toContain('logs/:logParam"');
    expect(hostSource).toContain('resource?.("log", params)');
  });

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
      attributes: {
        "log.level": "warn",
        "log.message": "Invoice import delayed",
        "log.context": { code: 429 },
        "skyline.context": { code: 429 },
        "skyline.channel": "stack",
        "skyline.trace_id": "fda8d9cf9d53e8845fd0738b8407731d",
        "skyline.span_id": "9adb4c77c49de9aa",
        "skyline.parent_span_id": null,
      },
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
  test("keeps Queue detail resolved while observed metric resources own stale refresh", () => {
    expect(referenceDetailLifecyclePolicy.queue).toEqual({
      defaultSelectionStates: [],
      pageStates: {
        loading: "pending",
        "stale-refresh": "resolved",
        "api-error": "error",
        "not-found": "not-found",
      },
      resourceStates: {
        "stale-refresh": "stale",
      },
    });
  });

  test("keeps Queue activity and scheduling-delay resource evidence distinct", async () => {
    const fixture = await createReferenceFixture();
    const metrics = fixture.resources?.queueMetricStates?.activityWaitHistory;

    expect(metrics?.activity).toEqual(expect.arrayContaining([
      expect.objectContaining({ t: expect.any(String), queued: expect.any(Number), running: expect.any(Number) }),
    ]));
    expect(metrics?.schedulingDelay).toEqual(expect.arrayContaining([
      expect.objectContaining({ t: expect.any(String), p50: expect.any(Number), p95: expect.any(Number), samples: 1 }),
    ]));
    expect(metrics?.activity).not.toEqual(metrics?.schedulingDelay);
    expect(metrics?.activity?.map((point) => [point.queued, point.running])).toEqual([[3, 0], [0, 2], [1, 1]]);
    expect(metrics?.schedulingDelay?.map((point) => point.p95)).toEqual([15, 80, 35]);
    expect(metrics?.queueDepth).toBeUndefined();
    expect(metrics?.throughput).toBeUndefined();
  });

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
      activity: expect.arrayContaining([expect.objectContaining({ t: expect.any(String), queued: expect.any(Number), enqueued: expect.any(Number), started: expect.any(Number) })]),
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

describe("Trigger Jobs reference fixture", () => {
  test("maps observed hourly status activity without fabricating successes", () => {
    const fixture = triggerJobs({
      jobs: [{
        name: "App\\Jobs\\Invoice",
        runCount: 7,
        statusCounts: { queued: 1, running: 1, retrying: 1, completed: 2, failed: 2 },
        activity: [{
          timestamp: "2026-08-05T12:00:00Z",
          total: 5,
          statusCounts: { queued: 1, running: 1, retrying: 1, completed: 0, failed: 2 },
        }],
      }],
    });

    expect(fixture.hourlyActivity["App\\Jobs\\Invoice"]).toEqual([expect.objectContaining({
      date: "2026-08-05T12:00:00Z",
      total: 5,
      PENDING: 1,
      EXECUTING: 1,
      RETRYING_AFTER_FAILURE: 1,
      COMPLETED_SUCCESSFULLY: 0,
      COMPLETED_WITH_ERRORS: 2,
      CANCELED: 0,
    })]);
  });

  test("groups Job detail activity through the pinned TaskDetailPresenter contract", async () => {
    const fixture = await createReferenceFixture();
    const activity = (fixture.loaders.job as any).activity;

    expect(activity.statuses).toEqual(["COMPLETED", "FAILED", "CANCELED", "RUNNING"]);
    expect(activity.data[0]).toEqual(expect.objectContaining({
      bucket: expect.any(Number),
      COMPLETED: expect.any(Number),
      FAILED: expect.any(Number),
      CANCELED: 0,
      RUNNING: expect.any(Number),
    }));
    expect(activity.data[0]).not.toHaveProperty("COMPLETED_SUCCESSFULLY");
    expect(activity.data[0]).not.toHaveProperty("EXECUTING");
  });
});
