import type { Page } from "@playwright/test";
import { FixtureAdapter } from "../../../resources/js/skyline/FixtureAdapter";
import { fixtureCatalog } from "./skyline";

export type ReferenceFixture = {
  loaders: Record<string, unknown>;
  context?: {
    root?: Record<string, unknown>;
    organization?: Record<string, unknown>;
  };
  canonicalUrls?: Record<string, string>;
};

export async function createReferenceFixture(adapter = new FixtureAdapter()): Promise<ReferenceFixture> {
  const catalog = await fixtureCatalog(adapter);
  const [jobs, runs, errors, logs, queues] = await Promise.all([
    adapter.jobs(), adapter.runs(), adapter.errorGroups(), adapter.telemetryEvents(), adapter.queueTargets(),
  ]);
  const [job, run, error, log, queue] = await Promise.all([
    adapter.job(catalog.job),
    adapter.trace(catalog.run),
    adapter.errorGroup(catalog.error),
    adapter.telemetryEvent(catalog.log),
    adapter.queueTarget(catalog.queue),
  ]);
  const runList = triggerRunList(runs);
  const errorLayout = {
    alertData: { channels: [], emailEnabled: false, slackEnabled: false },
    projectRef: "proj_fixture", projectId: "project", environmentType: "PRODUCTION",
    connectToSlackHref: "/errors", errorsPath: "/errors",
  };

  return {
    loaders: {
      jobs: triggerJobs(jobs),
      job: triggerJob(job),
      runs: { data: runList, rootOnlyDefault: false, filters: runList.filters, canCancelRuns: false, canReplayRuns: false },
      shell: { data: runList, rootOnlyDefault: false, filters: runList.filters, canCancelRuns: false, canReplayRuns: false },
      run: triggerRun(run),
      "errors:layout": errorLayout,
      errors: triggerErrors(errors, errorLayout),
      "error:layout": errorLayout,
      error: triggerError(error, errorLayout),
      logs: triggerLogs(logs),
      log: triggerLogs(logs, log),
      queues: triggerQueues(queues),
      queue: triggerQueue(queue),
    },
    canonicalUrls: {
      "jobs-populated": "/skyline/jobs", "job-found": `/skyline/jobs/${catalog.job}`,
      "runs-populated": "/skyline/runs", "run-found": `/skyline/runs/${catalog.run}`,
      "errors-populated": "/skyline/errors", "error-found": `/skyline/errors/${catalog.error}`,
      "logs-populated": "/skyline/logs", "log-found": `/skyline/logs?event=${catalog.log}`,
      "queues-populated": "/skyline/queues", "queue-found": `/skyline/queues/${catalog.queue}`,
    },
  };
}

export async function installReferenceFixture(page: Page, fixture: ReferenceFixture) {
  await page.addInitScript((input) => {
    const fixtureStateKey = "trigger-fidelity-fixture-state";
    const detailByCapture: Record<string, string> = {
      "jobs-favorite": "job", "jobs-recent-runs": "job", "jobs-absent-optional-data": "job",
      "runs-successful": "run", "runs-active": "run", "runs-failed": "run", "runs-retried": "run",
      "runs-parent-child-trace": "run", "runs-multiple-attempts": "run", "runs-long-data": "run",
      "runs-exception": "run", "runs-inspectors": "run", "runs-timeline-extremes": "run",
      "errors-single-occurrence": "error", "errors-many-occurrences": "error", "errors-affected-job-types": "error",
      "errors-application-vendor-frames": "error", "errors-stack-expansion": "error", "errors-linked-runs": "error",
      "errors-long-exception": "error", "logs-selected-detail": "log", "queues-idle": "queue", "queues-busy": "queue",
      "queues-activity-wait-history": "queue", "queues-paginated-runs": "queue",
    };
    const storedPreferences = (() => {
      try { return JSON.parse(localStorage.getItem("skyline.ui-preferences.v1:/reference") ?? "{}"); }
      catch { return {}; }
    })();
    const defaultSideMenu = {
      isCollapsed: false, width: 224, sectionOrder: ["metrics"], collapsedSections: {},
      hiddenItems: { sessions: true, prompts: true, models: true, query: true, dashboards: true, deployments: true, "environment-variables": true, "preview-branches": true, regions: true, "waitpoint-tokens": true, batches: true, "bulk-actions": true, "api-keys": true, alerts: true, limits: true, integrations: true },
      sectionItemOrder: { metrics: ["logs", "errors", "queues"] }, favorites: [],
    };
    const storedSidebar = storedPreferences.sidebar ?? {};
    const sideMenu = {
      ...defaultSideMenu, ...storedSidebar,
      collapsedSections: { ...defaultSideMenu.collapsedSections, ...(storedSidebar.collapsedSections ?? {}) },
      hiddenItems: { ...defaultSideMenu.hiddenItems, ...(storedSidebar.hiddenItems ?? {}) },
      sectionItemOrder: { ...defaultSideMenu.sectionItemOrder, ...(storedSidebar.sectionItemOrder ?? {}) },
      favorites: storedPreferences.favorites ?? [],
    };
    const environment = { id: "environment", slug: "prod", type: "PRODUCTION", userName: "Production", shortcode: "prod" };
    const project = { id: "project", organizationId: "organization", name: "Fixture Project", slug: "fixture", version: "V3", engine: "V1", environments: [environment], createdAt: "2026-01-01T00:00:00.000Z" };
    const organization = { id: "organization", slug: "fixture", title: "Fixture Organization", avatar: { type: "letters", hex: "#4f46e5" }, projects: [project] };
    const root = {
      user: { id: "user", email: "fixture@trigger.dev", admin: false, isImpersonating: false, dashboardPreferences: { sideMenu } },
      isViewingAsUser: false,
      toastMessage: null,
      posthogProjectKey: undefined,
      posthogUiHost: undefined,
      features: { isManagedCloud: false },
      appEnv: "development",
      appOrigin: location.origin,
      apiOrigin: location.origin,
      triggerCliTag: "latest",
      kapa: { websiteId: "" },
      timezone: "UTC",
      showThemeSwitcher: true,
      themePreference: ["classic", "dark", "light", "system"].includes(storedPreferences.theme) ? storedPreferences.theme : "dark",
      themeContrast: Number.isFinite(storedPreferences.contrast) ? storedPreferences.contrast : 50,
      isFirefox: false,
      ...input.context?.root,
    };
    const organizationContext = {
      organizations: [organization], organization, project, environment, regions: [],
      isImpersonating: false,
      currentPlan: { v3Subscription: { isPaying: true, plan: { title: "Fixture", limits: { logRetentionDays: { number: 30 }, concurrentRuns: { canExceed: false } } } }, v3Usage: { hasExceededFreeTier: false, usagePercentage: 0 } },
      billingLimit: undefined,
      customDashboards: [], dashboardLimits: { used: 0, limit: 3 }, widgetLimitPerDashboard: 16,
      canManageBillingLimits: false, isUsingRbacPlugin: false, isUsingSsoPlugin: false,
      ...input.context?.organization,
    };
    const fidelityWindow = window as typeof window & {
      __TRIGGER_FIDELITY_REFERENCE__?: Record<string, unknown>;
      __oracleSetFixtureState?: (state: string) => void;
    };
    fidelityWindow.__oracleSetFixtureState = (state) => { sessionStorage.setItem(fixtureStateKey, state); };
    fidelityWindow.__TRIGGER_FIDELITY_REFERENCE__ = {
      fixtureVersion: "nw-227-v1",
      context: { root, organization: organizationContext },
      canonicalUrl: (captureId: string) => {
        if (input.canonicalUrls?.[captureId]) return input.canonicalUrls[captureId];
        const prefix = captureId.slice(0, captureId.indexOf("-"));
        const detail = detailByCapture[captureId];
        return detail ? input.canonicalUrls?.[`${detail}-found`] ?? `/skyline/${prefix}` : input.canonicalUrls?.[`${prefix}-populated`] ?? "/skyline/runs";
      },
      defaultSearch: (captureId: string) => detailByCapture[captureId] === "run" || captureId === "run-found" ? `span=${encodeURIComponent((input.loaders.run as any).run.spanId)}` : "",
      load: ({ captureId, surface, state, phase, route }: { captureId: string; surface: string; state: string; phase: string; route: "layout" | "page" }) => {
        state = sessionStorage.getItem(fixtureStateKey) ?? state;
        const routeKey = `${surface}:${route}`;
        const value = input.loaders[`${captureId}:${route}`] ?? input.loaders[routeKey] ?? input.loaders[captureId] ?? input.loaders[surface];
        if (value === undefined) throw new Error(`Missing Trigger reference loader fixture: ${captureId}:${route}`);
        if (route === "page" && state === "api-error") throw new Error("Deterministic telemetry error.");
        if (route === "page" && state === "not-found") throw new Response("Deterministic telemetry evidence was not found.", { status: 404, statusText: "Not Found" });
        if (route === "page" && (state === "loading" || state === "stale-refresh") && phase === "refresh") return new Promise(() => {});
        const cloned = structuredClone(value);
        return route === "page" ? stateFixture(cloned, surface, state) : cloned;
      },
    };
  }, fixture);
}

function triggerJobs(page: any) {
  const statuses = ["DELAYED", "PENDING", "PENDING_VERSION", "EXECUTING", "RETRYING_AFTER_FAILURE", "WAITING_TO_RESUME", "COMPLETED_SUCCESSFULLY", "CANCELED", "COMPLETED_WITH_ERRORS", "INTERRUPTED", "SYSTEM_FAILURE", "PAUSED", "CRASHED", "EXPIRED", "TIMED_OUT"];
  return {
    items: page.jobs.map((job: any) => ({ slug: job.name, filePath: job.name.replaceAll("\\", "/") + ".php", exportName: job.name, triggerSource: "STANDARD", kind: "STANDARD", agentType: null })),
    hourlyActivity: Object.fromEntries(page.jobs.map((job: any) => [job.name, [{ date: "2026-08-04T20:00:00.000Z", total: job.runCount, ...Object.fromEntries(statuses.map((status) => [status, status === "COMPLETED_SUCCESSFULLY" ? job.runCount : 0])) }]])),
    runningStates: Object.fromEntries(page.jobs.map((job: any) => [job.name, { running: job.statusCounts.running ?? 0 }])),
    usefulLinksPreference: false,
  };
}

function triggerJob(detail: any) {
  const list = triggerRunList({ runs: detail.runs, pagination: detail.pagination, hasAnyRuns: detail.hasAnyRuns });
  return {
    task: { slug: detail.job.name, filePath: detail.job.name.replaceAll("\\", "/") + ".php", exportName: detail.job.name, description: null, workerVersion: "20260804.1", machinePreset: "small-1x", maxDurationInSeconds: 300, ttl: null, hasPayloadSchema: false, retry: null, createdAt: detail.job.firstObservedAt, queue: detail.queueTargets[0] ? { friendlyId: detail.queueTargets[0].id, name: detail.queueTargets[0].queue } : null },
    activity: detail.activity.map((point: any) => ({ date: point.timestamp, total: point.total, COMPLETED_SUCCESSFULLY: point.statusCounts.completed ?? 0, COMPLETED_WITH_ERRORS: point.statusCounts.failed ?? 0, EXECUTING: point.statusCounts.running ?? 0, PENDING: point.statusCounts.queued ?? 0, RETRYING_AFTER_FAILURE: point.statusCounts.retrying ?? 0 })),
    runList: list,
    queueMetrics: null,
  };
}

function triggerRunList(page: any) {
  const runs = page.runs.map(triggerRunSummary);
  const possibleTasks = [...new Set(runs.map((run: any) => run.taskIdentifier))].map((slug) => ({ slug }));
  return { runs, pagination: { next: page.pagination?.next ?? undefined, previous: page.pagination?.previous ?? undefined }, possibleTasks, bulkActions: [], filters: { tasks: [], versions: [], statuses: [], tags: [], from: "2026-07-05T20:02:00.000Z", to: "2026-08-05T20:02:00.000Z" }, hasFilters: false, hasAnyRuns: page.hasAnyRuns ?? runs.length > 0 };
}

function triggerRunSummary(run: any) {
  const status = triggerStatus(run.status);
  return { id: run.id, number: 1, friendlyId: run.id, createdAt: run.triggeredAt, updatedAt: run.finishedAt ?? run.startedAt ?? run.triggeredAt, startedAt: run.startedAt ?? undefined, delayUntil: undefined, hasFinished: ["COMPLETED_SUCCESSFULLY", "COMPLETED_WITH_ERRORS", "CANCELED", "SYSTEM_FAILURE", "CRASHED", "TIMED_OUT"].includes(status), finishedAt: run.finishedAt ?? undefined, isTest: false, status, version: "20260804.1", taskIdentifier: run.name, spanId: `span_${run.id}`, isReplayable: false, isCancellable: false, isPending: ["PENDING", "PENDING_VERSION", "DELAYED"].includes(status), environment: { id: "environment", organizationId: "organization", type: "PRODUCTION", slug: "prod" }, ttl: undefined, costInCents: 0, baseCostInCents: 0, usageDurationMs: Math.round((run.activeDurationUs ?? run.durationUs ?? 0) / 1_000), tags: [], depth: run.isRoot === false ? 1 : 0, rootTaskRunId: run.isRoot === false ? "run_root" : null, metadata: null, metadataType: null, machinePreset: "small-1x", queue: { name: run.queue ?? "default", type: run.queue?.startsWith("task/") ? "task" : "custom" }, region: "us-east-1", taskKind: "STANDARD" };
}

function triggerRun(detail: any) {
  const summary = triggerRunSummary(detail.run);
  const startedAt = Date.parse(detail.trace.rootStartedAt ?? detail.run.startedAt ?? detail.run.triggeredAt);
  const events = detail.trace.nodes.map((node: any) => ({
    id: node.id,
    parentId: node.parentId ?? undefined,
    runId: node.runId,
    data: {
      message: node.label,
      style: { icon: "task", variant: node.isError ? "failed" : "primary" },
      startTime: new Date(startedAt + node.offsetUs / 1_000),
      duration: node.isPartial ? null : (node.durationUs ?? 0) * 1_000,
      isError: node.isError,
      isPartial: node.isPartial,
      isCancelled: node.status === "canceled",
      isDebug: node.logLevel === "DEBUG",
      level: node.logLevel ?? "TRACE",
      attemptNumber: node.kind === "attempt" ? Number(node.label.match(/\d+/)?.[0] ?? 1) : undefined,
      timelineEvents: node.timelineEvents.map((event: any, index: number) => ({
        name: event.name,
        offset: event.offsetUs * 1_000,
        timestamp: new Date(startedAt + event.offsetUs / 1_000),
        markerVariant: index === 0 ? "start-cap" : "dot-hollow",
        lineVariant: "light",
      })),
      offset: node.offsetUs * 1_000,
      isRoot: node.parentId === null,
      isAgentRun: false,
    },
  }));
  return {
    run: { ...summary, traceId: detail.run.traceId, completedAt: detail.run.finishedAt, isFinished: summary.hasFinished, parentTaskRun: null, rootTaskRun: null },
    trace: {
      rootSpanStatus: detail.trace.rootStatus,
      events,
      duration: Math.max((detail.trace.durationUs ?? 1_000) * 1_000, 1_000_000),
      rootStartedAt: new Date(startedAt),
      startedAt: detail.run.startedAt ? new Date(detail.run.startedAt) : undefined,
      queuedDuration: detail.trace.queuedDurationUs == null ? undefined : detail.trace.queuedDurationUs * 1_000,
      overridesBySpanId: {}, linkedRunIdBySpanId: {}, isTruncated: detail.trace.isTruncated, missingAnchor: false,
    },
    maximumLiveReloadingSetting: 1_000, resizable: { parent: undefined, tree: undefined }, runsList: null,
    canReplayRun: false, canCancelRun: false,
  };
}

function triggerErrors(page: any, layout: any) {
  return { ...layout, data: { errorGroups: page.errorGroups.map((group: any) => ({ errorType: group.exceptionClass ?? "RuntimeException", errorMessage: group.message ?? group.errorMessage, fingerprint: group.fingerprint ?? group.id, taskIdentifier: group.jobType ?? group.taskIdentifier, firstSeen: group.firstObservedAt ?? group.firstSeen, lastSeen: group.lastObservedAt ?? group.lastSeen, count: group.occurrenceCount ?? group.count, status: group.status ?? "UNRESOLVED", resolvedAt: null, ignoredUntil: null })), pagination: { next: page.pagination.next ?? undefined, previous: page.pagination.previous ?? undefined }, filters: { tasks: [], versions: [], statuses: [], search: null, period: { period: "1d" }, from: "2026-08-04T20:02:00.000Z", to: "2026-08-05T20:02:00.000Z", hasFilters: false, possibleTasks: [], wasClampedByRetention: false } }, occurrences: { data: {} }, defaultPeriod: "1d", retentionLimitDays: 30, organizationSlug: "fixture", projectParam: "fixture", envParam: "prod" };
}

function triggerError(detail: any, layout: any) {
  const group = detail.errorGroup;
  return { ...layout, data: { errorGroup: group ? { errorType: detail.representative.class, errorMessage: detail.representative.message, fingerprint: group.fingerprint ?? group.id, taskIdentifier: group.jobType, firstSeen: group.firstObservedAt, lastSeen: group.lastObservedAt, count: group.occurrenceCount, status: group.status ?? "UNRESOLVED", resolvedAt: null, ignoredUntil: null } : undefined, runList: undefined }, activity: { data: detail.activity ?? [], versions: [] }, organizationSlug: "fixture", projectParam: "fixture", envParam: "prod", fingerprint: group?.fingerprint ?? group?.id ?? "fixture-error", canCancelRuns: false, canReplayRuns: false };
}

function triggerLogs(page: any, selected?: any) {
  const logs = page.telemetryEvents.map((event: any) => ({ id: event.id, runId: event.runId, taskIdentifier: event.jobType, startTime: event.timestamp, triggeredTimestamp: event.timestamp, traceId: event.traceId, spanId: event.spanId, parentSpanId: event.parentSpanId ?? null, message: event.message ?? event.name, kind: event.variant === "log" ? `LOG_${event.level}` : "SPAN", status: event.level === "ERROR" ? "ERROR" : "OK", duration: event.durationUs ?? 0, level: event.level ?? "INFO" }));
  return { data: { logs, pagination: { next: page.pagination.next ?? undefined, previous: page.pagination.previous ?? undefined }, possibleTasks: [...new Set(logs.map((log: any) => log.taskIdentifier))], bulkActions: [], filters: { tasks: [], levels: [], from: "2026-08-04T20:02:00.000Z", to: "2026-08-05T20:02:00.000Z" }, hasFilters: false, hasAnyLogs: logs.length > 0 }, defaultPeriod: "1h", retentionLimitDays: 30, selectedLog: selected?.telemetryEvent };
}

function triggerQueues(page: any) {
  const queues = page.queueTargets.map((queue: any) => ({ id: queue.id, name: queue.queue, type: "custom", running: queue.recordedRunCounts.running, queued: queue.recordedRunCounts.queued, paused: false, concurrencyLimit: null, concurrency: { current: null, base: null, override: null, overriddenBy: null, overriddenAt: null }, concurrencyLimitOverridePercent: null, releaseConcurrencyOnWaitpoint: true }));
  return { success: true, queues, pagination: { mode: "unfiltered", currentPage: 1, totalPages: 1, count: queues.length }, totalQueues: queues.length, hasFilters: false, environment: { running: queues.reduce((sum: number, queue: any) => sum + queue.running, 0), queued: queues.reduce((sum: number, queue: any) => sum + queue.queued, 0), concurrencyLimit: 10, burstFactor: 1, runsEnabled: true, queueSizeLimit: 1_000 }, autoReloadPollIntervalMs: 60_000, metrics: null, allocation: null, queueMetricsUiEnabled: false, defaultPeriod: "1h", maxPeriodDays: 30 };
}

function triggerQueue(detail: any) {
  const queue = { id: detail.queueTarget.id, name: detail.queueTarget.queue, type: "custom", running: detail.queueTarget.recordedRunCounts.running, queued: detail.queueTarget.recordedRunCounts.queued, paused: false, concurrencyLimit: null, concurrency: { current: null, base: null, override: null, overriddenBy: null, overriddenAt: null }, releaseConcurrencyOnWaitpoint: true };
  return { queue, fullName: detail.queueTarget.queue, queuedRunsPath: "/runs", environmentConcurrencyLimit: 10, ckBreakdown: { keys: [], totalCurrent: 0, totalLimit: 0 }, oldestQueuedAt: null, loadedAt: Date.parse("2026-08-05T20:02:00.000Z"), backPath: "/queues", defaultPeriod: "1h", maxPeriodDays: 30, ids: { organizationId: "organization", projectId: "project", environmentId: "environment" } };
}

function triggerStatus(status: string) {
  return ({ completed: "COMPLETED_SUCCESSFULLY", failed: "COMPLETED_WITH_ERRORS", running: "EXECUTING", queued: "PENDING", retrying: "RETRYING_AFTER_FAILURE" } as Record<string, string>)[status] ?? status;
}

function stateFixture(value: any, surface: string, state: string) {
  if (state === "mixed-pagination" && value.data?.pagination) value.data.pagination.next = "fixture-next";
  if (state === "pagination" && value.data?.pagination) value.data.pagination.next = "fixture-next";
  if (state === "paginated-runs" && value.pagination) value.pagination.next = "fixture-next";
  if (surface === "run") setTriggerRunState(value, state);
  if (surface === "queue" && (state === "idle" || state === "busy")) {
    const counts = state === "idle" ? { running: 0, queued: 0 } : { running: 3, queued: 2 };
    Object.assign(value.queue, counts);
  }
  if (surface === "logs" && state === "capture-disabled") value.capture = { ...(value.capture ?? {}), enabled: false };
  if ((surface === "logs" || surface === "log") && state === "long-content") {
    const log = value.selectedLog ?? value.data?.logs?.[0];
    if (log) log.message = `${log.message ?? "Fixture log"} ${"long-value ".repeat(80)}`;
  }
  if (state !== "initial-empty" && state !== "filtered-empty") return value;
  const filtered = state === "filtered-empty";
  if (surface === "jobs") value.items = [];
  if (surface === "runs" || surface === "shell") { value.data.runs = []; value.data.hasAnyRuns = filtered; value.data.hasFilters = filtered; }
  if (surface === "errors") { value.data.errorGroups = []; value.data.filters.hasFilters = filtered; }
  if (surface === "logs") { value.data.logs = []; value.data.hasAnyLogs = filtered; value.data.hasFilters = filtered; }
  if (surface === "queues") { value.queues = []; value.totalQueues = 0; value.hasFilters = filtered; }
  return value;
}

function setTriggerRunState(value: any, state: string) {
  const status = ({ successful: "COMPLETED_SUCCESSFULLY", active: "EXECUTING", failed: "COMPLETED_WITH_ERRORS" } as Record<string, string>)[state];
  if (status) {
    value.run.status = status;
    value.run.hasFinished = state !== "active";
    value.run.isFinished = state !== "active";
    value.trace.rootSpanStatus = state === "active" ? "executing" : state === "failed" ? "failed" : "completed";
    const root = value.trace.events[0]?.data;
    if (root) { root.isPartial = state === "active"; root.isError = state === "failed"; }
  }
  if (state === "retried" && value.trace.events.filter((event: any) => event.data.attemptNumber).length < 2) {
    const root = value.trace.events[0];
    if (root) value.trace.events.push({ ...structuredClone(root), id: `${root.id}_retry`, parentId: root.id, data: { ...structuredClone(root.data), message: "Attempt 2", attemptNumber: 2, isRoot: false, offset: Math.max(1_000_000, root.data.duration ?? 1_000_000) } });
  }
}
