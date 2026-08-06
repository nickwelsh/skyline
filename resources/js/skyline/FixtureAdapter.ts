import { scenarios } from "./fixtures";
import type {
  ErrorGroupDetailDto,
  ErrorGroupOccurrence,
  ErrorGroupsPageDto,
  ErrorGroupsQuery,
  ErrorOccurrencesQuery,
  InspectorDto,
  JobDetailDto,
  JobRunsQuery,
  JobsPageDto,
  JobsQuery,
  QueueTargetDetailDto,
  QueueTargetRunsQuery,
  QueueTargetsPageDto,
  QueueTargetsQuery,
  RunsPageDto,
  RunsQuery,
  RunsUpdatesDto,
  Scenario,
  SkylineCapabilities,
  SkylineDtoAdapter,
  TelemetryEventDetailDto,
  TelemetryEventsPageDto,
  TelemetryEventsQuery,
  TraceNode,
  TracePageDto,
} from "./dto";

const triggeredAtByRun = new Map([
  ["run_01J8R4NQX6K3PV4W0A1H2Z7M9C", "2026-08-04T20:01:21.000000000Z"],
  ["run_01J8R4H9S9J12V04CNH6F6JQ3M", "2026-08-04T20:01:26.000000000Z"],
  ["run_01J8R47YYNA4GFVDMTQ9P59BJW", "2026-08-04T20:00:58.000000000Z"],
  ["run_01J8R3XK1YV76N3Q51RPXQ0VC2", "2026-08-04T19:59:42.000000000Z"],
  ["run_01J8R3RXZ6A7J19G4Y53CXF7F4", "2026-08-04T19:58:11.000000000Z"],
  ["run_fixture_repeated_deadlock", "2026-08-04T19:55:00.000000000Z"],
]);
const fixtureGeneratedAt = "2026-08-04T20:02:00.000000000Z";
const pageSize = 25;

export const fixtureCapabilities: SkylineCapabilities = {
  navigation: { jobs: true, runs: true, sessions: false, prompts: false, models: false, queues: true, errors: true, logs: true, query: false, dashboards: false, deployments: false, environmentVariables: false, previewBranches: false, regions: false, waitpointTokens: false, batches: false, bulkActions: false, apiKeys: false, concurrency: false, limits: false, integrations: false, schedules: false, waitpoints: false, alerts: false, settings: false },
  jobs: { view: true, testJob: false, configure: false, schedule: false },
  errors: { view: true, assign: false, ignore: false, resolve: false, alerts: false, replay: false, cancel: false, versions: false, bulkActions: false },
  runs: { view: true, cancel: false, replay: false, bulkCancel: false, bulkReplay: false },
  logs: { view: true },
  queues: { view: true, pause: false, concurrency: false, workers: false, rateLimits: false },
  shell: { appearance: true, sidebarCustomization: true, favorites: true, panelPersistence: true, shortcuts: true, account: false, notifications: false, jobGuidance: false, organizationSwitching: false, projectSwitching: false, environmentSwitching: false, accountOpening: false },
  help: { menu: true, shortcuts: true, askAi: false, documentation: false, status: false, suggestFeature: false, contact: false, changelog: false },
};

const capabilities = fixtureCapabilities;

export class FixtureAdapter implements SkylineDtoAdapter {
  async telemetryEvents(query: TelemetryEventsQuery = {}): Promise<TelemetryEventsPageDto> {
    const search = query.search?.trim().toLowerCase();
    const filtered = fixtureTelemetryEvents.filter((event) =>
      (!search || [event.runId, event.jobType, event.variant === "operation" ? event.name : event.message].some((value) => value.toLowerCase().includes(search)))
      && (!query.levels?.length || query.levels.includes(event.level))
      && (!query.jobType || event.jobType === query.jobType)
      && (!query.runId || event.runId === query.runId));

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: fixtureGeneratedAt,
      capabilities,
      telemetryEvents: filtered,
      pagination: { previous: null, next: null },
      filters: { search: query.search ?? null, levels: query.levels ?? [], jobType: query.jobType ?? null, runId: query.runId ?? null, period: query.period ?? "1h" },
      options: { levels: ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"], jobTypes: [...new Set(fixtureTelemetryEvents.map((event) => event.jobType))].sort(), timeRanges: fixtureTimeRanges },
      capture: fixtureTelemetryCapture,
      hasAnyTelemetryEvents: fixtureTelemetryEvents.length > 0,
    };
  }

  async telemetryEvent(eventId: string): Promise<TelemetryEventDetailDto> {
    const event = fixtureTelemetryEvents.find((candidate) => candidate.id === eventId);
    if (!event) throw new Error(`Unknown fixture Telemetry event: ${eventId}`);

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: fixtureGeneratedAt,
      capabilities,
      capture: fixtureTelemetryCapture,
      telemetryEvent: event.variant === "operation" ? {
        ...event,
        relationships: { traceId: event.traceId, spanId: event.spanId, parentSpanId: event.parentSpanId },
        attributes: { "db.namespace": "testing" },
        events: [{ name: "query.completed", timestamp: event.timestamp, attributes: {} }],
        links: [],
        resource: { "service.name": "fixture-worker" },
        instrumentation: { name: "nickwelsh/skyline", version: null },
        capture: { isTruncated: false, truncated: [] },
        errorHref: null,
      } : {
        ...event,
        relationships: { traceId: event.traceId, spanId: event.spanId, parentSpanId: event.parentSpanId },
        channel: "stack",
        attributes: { "log.level": event.level.toLowerCase(), "log.message": event.message, "log.context": event.context },
        capture: { isTruncated: false, truncated: [] },
        errorHref: null,
      },
    };
  }

  async errorGroups(query: ErrorGroupsQuery = {}): Promise<ErrorGroupsPageDto> {
    const source = fixtureErrorOccurrences();
    const groups = [...Map.groupBy(source, (occurrence) => fixtureErrorId(occurrence)).values()]
      .filter((occurrences) => (!query.jobType || occurrences[0].jobType === query.jobType)
        && (!query.exceptionClass || occurrences[0].exception.class === query.exceptionClass)
        && occurrences.some((occurrence) => withinErrorPeriod(occurrence, query.period)))
      .map(fixtureErrorSummary)
      .sort((left, right) => right.lastObservedAt.localeCompare(left.lastObservedAt));
    const offset = fixtureOffset(query.cursor);

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: fixtureGeneratedAt,
      capabilities,
      errorGroups: groups.slice(offset, offset + pageSize),
      pagination: {
        next: offset + pageSize < groups.length ? String(offset + pageSize) : null,
        previous: offset > 0 ? String(Math.max(0, offset - pageSize)) : null,
      },
      filters: { jobType: query.jobType ?? null, exceptionClass: query.exceptionClass ?? null, period: query.period ?? "all" },
      options: {
        jobTypes: [...new Set(source.map((occurrence) => occurrence.jobType))].sort(),
        exceptionClasses: [...new Set(source.map((occurrence) => occurrence.exception.class))].sort(),
        timeRanges: fixtureTimeRanges,
      },
      hasAnyErrorGroups: source.length > 0,
    };
  }

  async errorGroup(errorId: string, query: ErrorOccurrencesQuery = {}): Promise<ErrorGroupDetailDto> {
    const source = fixtureErrorOccurrences();
    const group = [...Map.groupBy(source, (occurrence) => fixtureErrorId(occurrence)).values()]
      .find((occurrences) => fixtureErrorId(occurrences[0]) === errorId);
    if (!group) throw new Error(`Unknown fixture Error group: ${errorId}`);
    const filtered = group.filter((occurrence) => withinErrorPeriod(occurrence, query.period));
    const offset = fixtureOffset(query.cursor);
    const failedAttempts = filtered.slice(offset, offset + pageSize);

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: fixtureGeneratedAt,
      capabilities,
      errorGroup: fixtureErrorSummary(group),
      representative: group[0].exception,
      activity: [...Map.groupBy(filtered, (occurrence) => occurrence.observedAt.slice(0, 10)).entries()]
        .map(([date, occurrences]) => ({ timestamp: `${date}T00:00:00Z`, occurrences: occurrences.length })),
      failedAttempts,
      pagination: {
        next: offset + pageSize < filtered.length ? String(offset + pageSize) : null,
        previous: offset > 0 ? String(Math.max(0, offset - pageSize)) : null,
      },
      filters: { period: query.period ?? "all" },
      options: { timeRanges: fixtureTimeRanges },
      hasAnyOccurrences: group.length > 0,
    };
  }

  async queueTargets(query: QueueTargetsQuery = {}): Promise<QueueTargetsPageDto> {
    const grouped = Map.groupBy(scenarios[0].runs, (run) => `${run.connection}\0${run.queue}`);
    const search = query.search?.toLowerCase();
    const allQueueTargets = [...grouped.values()]
      .map((runs) => fixtureQueueSummary(runs))
      .sort((left, right) => `${left.connection}\0${left.queue}`.localeCompare(`${right.connection}\0${right.queue}`));
    const queueTargets = allQueueTargets.filter((target) => (!query.connection || target.connection === query.connection)
      && (!search || `${target.connection} ${target.queue}`.toLowerCase().includes(search)));
    const connections = [...new Set(scenarios[0].runs.map((run) => run.connection))].sort();
    const environmentSummary = {
      queued: allQueueTargets.reduce((total, target) => total + target.recordedRunCounts.queued, 0),
      running: allQueueTargets.reduce((total, target) => total + target.recordedRunCounts.running, 0),
      allocated: null,
      limit: null,
    };

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T20:02:00.000000000Z",
      capabilities,
      environmentSummary,
      queueTargets,
      pagination: { next: null, previous: null },
      filters: { connection: query.connection ?? null, search: query.search ?? null, from: query.from ?? null, to: query.to ?? null, status: [] },
      options: { connections, timeRanges: fixtureQueueTimeRanges },
      hasAnyQueueTargets: grouped.size > 0,
    };
  }

  async queueTarget(queueId: string, query: QueueTargetRunsQuery = {}): Promise<QueueTargetDetailDto> {
    const grouped = Map.groupBy(scenarios[0].runs, (run) => `${run.connection}\0${run.queue}`);
    const source = [...grouped.values()].find((runs) => fixtureQueueId(runs[0].connection, runs[0].queue) === queueId);
    if (!source) throw new Error(`Unknown fixture Queue target: ${queueId}`);
    const runs = source.filter((run) => (!query.status || query.status.includes(run.status))
      && (!query.search || `${run.name} ${run.id}`.toLowerCase().includes(query.search.toLowerCase())));
    const queueTarget = fixtureQueueSummary(source);

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T20:02:00.000000000Z",
      capabilities,
      queueCapabilities: { pause: false, resume: false, concurrency: false, allocation: false, rateLimit: false, workers: false },
      queueTarget,
      series: {
        activity: source.map((run, index) => ({
          timestamp: triggeredAtByRun.get(run.id) ?? generatedTimestamp(index),
          recordedRuns: 1,
          recordedRunCounts: statusCounts([run]),
        })),
        queueTime: source.map((run, index) => {
          const durationUs = parseDuration(run.queueDuration) * 1_000;
          return { timestamp: triggeredAtByRun.get(run.id) ?? generatedTimestamp(index), sampleCount: 1, medianUs: durationUs, p95Us: durationUs, maximumUs: durationUs };
        }),
      },
      runs: runs.map((run, index) => {
        const summary = this.summary(run, index);
        return {
          id: summary.id,
          href: `/skyline/runs/${encodeURIComponent(summary.id)}`,
          traceId: summary.traceId,
          name: summary.name,
          status: summary.status,
          attemptCount: summary.attemptCount,
          triggeredAt: summary.triggeredAt,
          startedAt: summary.startedAt,
          finishedAt: summary.finishedAt,
          queueDurationUs: summary.queueDurationUs,
          durationUs: summary.durationUs,
          activeDurationUs: summary.activeDurationUs,
        };
      }),
      pagination: { next: null, previous: null },
      filters: { connection: null, search: query.search ?? null, from: query.from ?? null, to: query.to ?? null, status: query.status ?? [] },
      options: { statuses: ["queued", "running", "retrying", "completed", "failed"], timeRanges: fixtureQueueTimeRanges },
      hasAnyRuns: source.length > 0,
    };
  }

  async jobs(query: JobsQuery = {}): Promise<JobsPageDto> {
    const grouped = Map.groupBy(scenarios[0].runs.filter((run) => withinPeriod(run, query.period)), (run) => run.name);
    const search = query.search?.toLowerCase();
    const jobs = [...grouped.entries()]
      .filter(([name]) => !search || name.toLowerCase().includes(search))
      .map(([name, runs]) => this.jobSummary(name, runs))
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: fixtureGeneratedAt,
      capabilities,
      jobs,
      filters: { search: query.search ?? null, period: query.period ?? "all" },
      options: { timeRanges: fixtureTimeRanges },
      hasAnyJobs: scenarios[0].runs.length > 0,
    };
  }

  async job(jobId: string, query: JobRunsQuery = {}): Promise<JobDetailDto> {
    const grouped = Map.groupBy(scenarios[0].runs, (run) => run.name);
    const entry = [...grouped.entries()].find(([name]) => fixtureJobId(name) === jobId);
    if (!entry) throw new Error(`Unknown fixture Job: ${jobId}`);
    const [name, source] = entry;
    const filtered = source.filter((run) => (!query.status || query.status.includes(run.status)) && withinPeriod(run, query.period));
    const offset = fixtureOffset(query.cursor);
    const runs = filtered.slice(offset, offset + pageSize);

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: fixtureGeneratedAt,
      capabilities,
      job: this.jobSummary(name, source),
      queueTargets: [...new Map(source.map((run) => [`${run.connection}\0${run.queue}`, {
        id: fixtureQueueId(run.connection, run.queue),
        connection: run.connection,
        queue: run.queue,
        runCount: source.filter((candidate) => candidate.connection === run.connection && candidate.queue === run.queue).length,
        href: `/skyline/queues/${fixtureQueueId(run.connection, run.queue)}`,
      }])).values()],
      activity: filtered.length > 0 ? [{
        timestamp: "2026-08-04T00:00:00Z",
        total: filtered.length,
        statusCounts: statusCounts(filtered),
      }] : [],
      runs: runs.map((run) => this.summary(run, scenarios[0].runs.indexOf(run))),
      pagination: {
        next: offset + pageSize < filtered.length ? String(offset + pageSize) : null,
        previous: offset > 0 ? String(Math.max(0, offset - pageSize)) : null,
      },
      tableState: query.cursor ?? "fixture-job",
      filters: { status: query.status ?? [], period: query.period ?? "all" },
      options: {
        statuses: ["queued", "running", "retrying", "completed", "failed"],
        timeRanges: fixtureTimeRanges,
      },
      hasAnyRuns: source.length > 0,
    };
  }

  async runs(query: RunsQuery = {}): Promise<RunsPageDto> {
    const source = scenarios[0].runs;
    const search = query.search?.toLowerCase();
    const filtered = source.filter((run) => {
      const matchesSearch = !search || run.id.toLowerCase().includes(search) || run.name.toLowerCase().includes(search);
      return matchesSearch && (!query.status?.length || query.status.includes(run.status));
    });
    const requestedOffset = Number.parseInt(query.cursor ?? "0", 10);
    const offset = Number.isFinite(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T20:02:00.000000000Z",
      capabilities,
      runs: filtered.slice(offset, offset + 25).map((run, index) => this.summary(run, offset + index)),
      pagination: {
        next: offset + 25 < filtered.length ? String(offset + 25) : null,
        previous: offset > 0 ? String(Math.max(0, offset - 25)) : null,
      },
      pollCursor: "fixture-poll",
      polling: { activeRunsIntervalMs: 3_000, newRunsIntervalMs: 6_000 },
      tableState: query.cursor ?? "",
      filters: query,
      options: {
        statuses: ["queued", "running", "retrying", "completed", "failed"],
        jobNames: [...new Set(source.map((run) => run.name))].sort(),
        queueTargets: [...new Map(source.map((run) => [`${run.connection}:${run.queue}`, {
          connection: run.connection,
          queue: run.queue,
        }])).values()],
        traceIdentities: [...new Set(source.map((run) => `fixture-${run.id}`))],
      },
      hasAnyRuns: source.length > 0,
    };
  }

  async updates(query: RunsQuery, _since: string, runIds: string[] = []): Promise<RunsUpdatesDto> {
    const page = await this.runs(query);
    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: page.generatedAt,
      capabilities,
      runs: runIds.length ? page.runs.filter((run) => runIds.includes(run.id)) : [],
      newRunCount: 0,
      pollCursor: "fixture-poll-next",
    };
  }

  async trace(runId: string, tableState?: string): Promise<TracePageDto> {
    const { nodes: rawNodes, parentRunId, rootRunId, run } = this.fixtureForRun(runId);
    const nodes = normalizeNodes(rawNodes, runId);
    const summary = this.summary(run, 0);
    const runs = scenarios[0].runs;
    const index = runs.findIndex((candidate) => candidate.id === runId);

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T20:02:00.000000000Z",
      capabilities,
      run: {
        ...summary,
        traceId: String(rawNodes[0].metadata.traceId ?? "fixture-trace"),
        rootRunId,
        parentRunId: parentRunId ?? null,
        queueTarget: { connection: run.connection, queue: run.queue },
        driverId: run.connection,
        queueTimeSource: "framework_event",
      },
      attempts: rawNodes.filter((node) => node.kind === "attempt" && node.runId === runId).map((attempt) => ({
        id: attempt.id,
        number: Number(attempt.label.match(/\d+/)?.[0] ?? 1),
        status: attempt.status as "running" | "completed" | "released" | "failed",
        startedAt: addMilliseconds(summary.triggeredAt, attempt.offsetMs),
        finishedAt: ["completed", "released", "failed"].includes(attempt.status)
          ? addMilliseconds(summary.triggeredAt, attempt.offsetMs + attempt.durationMs)
          : null,
        queueDurationUs: null,
        queueTimeSource: null,
        failure: attempt.exception ? {
          class: attempt.exception.class,
          message: attempt.exception.message,
          messageTruncated: false,
        } : null,
        inspectorHref: inspectorHref(runId, attempt.id),
      })),
      relationships: {
        parent: parentRunId ? { id: parentRunId, runHref: runHref(parentRunId) } : null,
        children: rawNodes.filter((node) => node.kind === "run" && node.runId !== runId).map((child) => ({
          id: child.runId,
          parentRunId: runId,
          name: scenarios[0].runs.find((candidate) => candidate.id === child.runId)?.name ?? child.label,
          status: child.status as "queued" | "running" | "retrying" | "completed" | "failed",
          runHref: runHref(child.runId),
          inspectorHref: inspectorHref(runId, `run_${child.runId}`),
        })),
      },
      trace: {
        revision: 1,
        rootStatus: rawNodes[0].status === "failed" ? "failed" : rawNodes[0].status === "running" ? "executing" : "completed",
        durationUs: Math.max(...rawNodes.map((node) => node.offsetMs + node.durationMs)) * 1_000,
        activeDurationUs: null,
        rootStartedAt: summary.triggeredAt,
        queuedDurationUs: summary.queueDurationUs,
        nodes,
        nodeCount: nodes.length,
        isTruncated: false,
        polling: false,
        pollIntervalMs: 3_000,
        pollUntil: null,
      },
      navigation: {
        previousRunId: runs[index - 1]?.id ?? null,
        nextRunId: runs[index + 1]?.id ?? null,
        tableState: tableState ?? "",
        listCursor: tableState || null,
      },
    };
  }

  async inspector(nodeId: string, runId: string): Promise<InspectorDto> {
    const raw = this.fixtureForRun(runId).nodes;
    const nodes = normalizeNodes(raw, runId);
    const index = nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) throw new Error(`Unknown fixture inspector node: ${nodeId}`);
    const node = nodes[index];
    const fixture = raw[index];

    return {
      ...node,
      overview: { runId: node.runId, nodeId: node.id, kind: node.kind },
      source: node.kind === "run" ? {
        file: `app/Jobs/${node.label}.php`,
        line: 1,
        href: `vscode://file//workspace/app/Jobs/${node.label}.php:1`,
      } : undefined,
      exception: fixture.exception ? {
        class: fixture.exception.class,
        message: fixture.exception.message,
        messageTruncated: false,
        messageOriginalBytes: fixture.exception.message.length,
        code: null,
        location: {
          file: fixture.exception.frames[0]?.file ?? "unknown",
          line: fixture.exception.frames[0]?.line ?? null,
          href: null,
        },
        frames: fixture.exception.frames.map((frame) => ({
          file: frame.file,
          line: frame.line,
          class: null,
          type: null,
          function: frame.call,
          isVendor: frame.file.startsWith("vendor/"),
          href: null,
          snippet: frame.file.startsWith("vendor/") ? null : {
            code: "public function handle(): void\n{\n    throw new RuntimeException('Job failed');\n}\n",
            startingLine: Math.max(1, frame.line - 2),
            highlightedLine: frame.line,
          },
        })),
        framesTruncated: false,
        markdown: `# ${fixture.exception.class} - Job failed\n\n${fixture.exception.message}\n\n## Stack Trace\n`,
      } : null,
      sql: fixture.sql ? { value: fixture.sql, isTruncated: false, originalBytes: fixture.sql.length } : undefined,
      metadata: { value: fixture.metadata, isTruncated: false, truncated: [] },
    };
  }

  private summary(run: Scenario["runs"][number], index: number) {
    const triggeredAt = triggeredAtByRun.get(run.id) ?? generatedTimestamp(index);
    const queueDurationUs = parseDuration(run.queueDuration) * 1_000;
    const durationUs = parseDuration(run.duration) * 1_000;
    const started = !["queued"].includes(run.status);
    const terminal = ["completed", "failed"].includes(run.status);

    return {
      id: run.id,
      traceId: `fixture-${run.id}`,
      isRoot: index !== 1,
      name: run.name,
      status: run.status,
      connection: run.connection,
      queue: run.queue,
      attemptCount: run.attemptCount,
      triggeredAt,
      queuedAt: run.status === "queued" ? null : triggeredAt,
      startedAt: started ? triggeredAt : null,
      finishedAt: terminal ? triggeredAt : null,
      queueDurationUs: queueDurationUs || null,
      durationUs: durationUs || null,
      activeDurationUs: !terminal && started ? durationUs || null : null,
      revision: 1,
    };
  }

  private jobSummary(name: string, runs: Scenario["runs"]) {
    const sorted = [...runs].sort((left, right) => (triggeredAtByRun.get(right.id) ?? "").localeCompare(triggeredAtByRun.get(left.id) ?? ""));
    const latest = sorted[0];
    const observed = sorted.map((run, index) => triggeredAtByRun.get(run.id) ?? generatedTimestamp(index)).sort();
    const recent = sorted.filter((run, index) => {
      const triggeredAt = triggeredAtByRun.get(run.id) ?? generatedTimestamp(index);
      return new Date(triggeredAt).getTime() >= new Date(fixtureGeneratedAt).getTime() - 86_400_000;
    });
    const activity = [...Map.groupBy(recent, (run) => {
      const triggeredAt = triggeredAtByRun.get(run.id) ?? generatedTimestamp(sorted.indexOf(run));
      return `${triggeredAt.slice(0, 13)}:00:00Z`;
    }).entries()].map(([timestamp, entries]) => ({
      timestamp,
      total: entries.length,
      statusCounts: statusCounts(entries),
    })).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const id = fixtureJobId(name);
    return {
      id,
      name,
      href: `/skyline/jobs/${id}`,
      firstObservedAt: observed[0],
      lastObservedAt: observed.at(-1) ?? observed[0],
      runCount: runs.length,
      statusCounts: statusCounts(runs),
      activity,
      latestRun: {
        id: latest.id,
        status: latest.status,
        triggeredAt: triggeredAtByRun.get(latest.id) ?? generatedTimestamp(0),
        href: `/skyline/runs/${encodeURIComponent(latest.id)}`,
      },
    };
  }

  private fixtureForRun(runId: string): { run: Scenario["runs"][number]; nodes: Scenario["nodes"]; rootRunId: string; parentRunId?: string } {
    if (runId === repeatedDeadlockRun.id) {
      return { run: repeatedDeadlockRun, nodes: repeatedDeadlockNodes, rootRunId: repeatedDeadlockRun.id };
    }
    const source = scenarios[0].runs;
    const run = source.find((candidate) => candidate.id === runId);
    if (!run) throw new Error(`Unknown fixture Run: ${runId}`);

    if (runId === source[0].id) return { run, nodes: scenarios[0].nodes, rootRunId: run.id };
    if (runId === source[1].id) return { run, nodes: scenarios[1].nodes, rootRunId: source[0].id, parentRunId: source[0].id };
    if (runId === source[3].id) return { run, nodes: scenarios[2].nodes, rootRunId: run.id };

    return {
      run,
      rootRunId: run.id,
      nodes: [{
        id: run.id,
        runId: run.id,
        kind: "run",
        label: run.name.split("\\").at(-1) ?? run.name,
        level: 0,
        offsetMs: 0,
        durationMs: Math.max(1, parseDuration(run.duration)),
        status: run.status,
        isPartial: ["queued", "running", "retrying"].includes(run.status),
        metadata: { traceId: `fixture-${run.id}`, connection: run.connection, queue: run.queue },
      }],
    };
  }
}

const repeatedDeadlockRun = {
  id: "run_fixture_repeated_deadlock",
  name: "App\\Jobs\\GenerateMonthlyInvoices",
  status: "failed" as const,
  connection: "redis",
  queue: "billing",
  attemptCount: 1,
  triggeredAt: "3:55:00 PM",
  queueDuration: "204ms",
  duration: "2.1s",
};

const repeatedDeadlockNodes: Scenario["nodes"] = [
  {
    id: repeatedDeadlockRun.id,
    runId: repeatedDeadlockRun.id,
    kind: "run",
    label: "GenerateMonthlyInvoices",
    level: 0,
    offsetMs: 0,
    durationMs: 2_100,
    status: "failed",
    isError: true,
    metadata: { traceId: "fixture-repeated-deadlock", connection: "redis", queue: "billing" },
  },
  {
    id: "attempt_run_fixture_repeated_deadlock_1",
    parentId: repeatedDeadlockRun.id,
    runId: repeatedDeadlockRun.id,
    kind: "attempt",
    label: "Attempt 1",
    level: 1,
    offsetMs: 204,
    durationMs: 1_896,
    status: "failed",
    isError: true,
    exception: {
      class: "Illuminate\\Database\\DeadlockException",
      message: "Deadlock victim selected for invoice batch 42",
      frames: [
        { file: "app/Jobs/GenerateMonthlyInvoices.php", line: 61, call: "GenerateMonthlyInvoices->handle()" },
        { file: "vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php", line: 124, call: "CallQueuedHandler->call()" },
      ],
    },
    metadata: { attempt: 1, spanId: "fixturedeadlock01" },
  },
];

function fixtureErrorOccurrences(): ErrorGroupOccurrence[] {
  const deadlock = fixtureException(
    "Illuminate\\Database\\DeadlockException",
    "Deadlock found when trying to get lock; retry transaction",
    [
      ["app/Jobs/GenerateMonthlyInvoices.php", 58, "GenerateMonthlyInvoices->handle()"],
      ["vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php", 124, "CallQueuedHandler->call()"],
    ],
  );
  const repeated = fixtureException(
    "Illuminate\\Database\\DeadlockException",
    "Deadlock victim selected for invoice batch 42",
    [
      ["app/Jobs/GenerateMonthlyInvoices.php", 61, "GenerateMonthlyInvoices->handle()"],
      ["vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php", 124, "CallQueuedHandler->call()"],
    ],
  );
  const importFailure = fixtureException(
    "UnexpectedValueException",
    "Order currency GBP does not match the import account currency USD",
    [
      ["app/Jobs/ImportLegacyOrders.php", 91, "ImportLegacyOrders->mapOrder()"],
      ["app/Jobs/ImportLegacyOrders.php", 47, "ImportLegacyOrders->handle()"],
    ],
  );

  return [
    fixtureOccurrence("run_01J8R4NQX6K3PV4W0A1H2Z7M9C", 1, "App\\Jobs\\GenerateMonthlyInvoices", "redis", "billing", "2026-08-04T20:01:23.000000000Z", deadlock),
    fixtureOccurrence(repeatedDeadlockRun.id, 1, repeatedDeadlockRun.name, repeatedDeadlockRun.connection, repeatedDeadlockRun.queue, "2026-08-04T19:55:02.000000000Z", repeated),
    fixtureOccurrence("run_01J8R3XK1YV76N3Q51RPXQ0VC2", 3, "App\\Jobs\\ImportLegacyOrders", "sqs", "imports", "2026-08-04T20:00:23.000000000Z", importFailure),
  ];
}

function fixtureOccurrence(runId: string, attemptNumber: number, jobType: string, connection: string, queue: string, observedAt: string, exception: ErrorGroupOccurrence["exception"]): ErrorGroupOccurrence {
  const id = `attempt_${runId}_${attemptNumber}`;
  return {
    id,
    runId,
    attemptNumber,
    jobType,
    connection,
    queue,
    startedAt: observedAt,
    finishedAt: observedAt,
    observedAt,
    runHref: `/skyline/runs/${runId}`,
    attemptHref: `/skyline/runs/${runId}?node=${id}`,
    exception,
  };
}

function fixtureException(className: string, message: string, frames: Array<[string, number, string]>): ErrorGroupOccurrence["exception"] {
  return {
    class: className,
    message,
    messageTruncated: false,
    messageOriginalBytes: message.length,
    code: null,
    location: { file: frames[0][0], line: frames[0][1], href: null },
    frames: frames.map(([file, line, callable]) => ({
      file,
      line,
      class: null,
      type: null,
      function: callable,
      isVendor: file.startsWith("vendor/"),
      href: null,
      snippet: file.startsWith("vendor/") ? null : {
        code: "public function handle(): void\n{\n    throw new RuntimeException('Job failed');\n}\n",
        startingLine: Math.max(1, line - 2),
        highlightedLine: line,
      },
    })),
    framesTruncated: false,
    markdown: `# ${className} - Job failed\n\n${message}\n\n## Stack Trace\n`,
  };
}

function fixtureErrorSummary(occurrences: ErrorGroupOccurrence[]) {
  const latest = occurrences[0];
  const id = fixtureErrorId(latest);
  const jobId = fixtureJobId(latest.jobType);
  return {
    id,
    fingerprint: id.slice("error_".length),
    href: `/skyline/errors/${id}`,
    jobType: latest.jobType,
    jobId,
    jobHref: `/skyline/jobs/${jobId}`,
    exceptionClass: latest.exception.class,
    representativeMessage: latest.exception.message,
    firstObservedAt: occurrences.at(-1)?.observedAt ?? latest.observedAt,
    lastObservedAt: latest.observedAt,
    occurrenceCount: occurrences.length,
    activity: [...Map.groupBy(occurrences, (occurrence) => occurrence.observedAt.slice(0, 10)).entries()]
      .map(([date, entries]) => ({ timestamp: `${date}T00:00:00Z`, occurrences: entries.length })),
    latest: {
      runId: latest.runId,
      attemptNumber: latest.attemptNumber,
      observedAt: latest.observedAt,
      runHref: latest.runHref,
      attemptHref: latest.attemptHref,
    },
  };
}

function fixtureErrorId(occurrence: ErrorGroupOccurrence) {
  const frame = occurrence.exception.frames.find((candidate) => !candidate.isVendor);
  const material = [occurrence.jobType, occurrence.exception.class, frame?.file ?? occurrence.exception.location?.file ?? "", frame?.function ?? ""].join("\0");
  return `error_${fixtureHash(material).repeat(8)}`;
}

function withinErrorPeriod(occurrence: ErrorGroupOccurrence, period: ErrorGroupsQuery["period"]): boolean {
  if (!period) return true;
  const durationMs = fixtureJobPeriods[period].durationMs;
  if (durationMs === null) return true;
  return new Date(occurrence.observedAt).getTime() >= new Date(fixtureGeneratedAt).getTime() - durationMs;
}

function normalizeNodes(source: Scenario["nodes"], selectedRunId: string): TraceNode[] {
  const runNodeIds = new Set(source.filter((node) => node.kind === "run").map((node) => node.id));
  return source.map((node) => ({
    id: node.kind === "run" ? `run_${node.id}` : node.id,
    parentId: node.parentId ? (runNodeIds.has(node.parentId) ? `run_${node.parentId}` : node.parentId) : null,
    runId: node.runId,
    kind: node.kind,
    label: node.label,
    level: node.level,
    offsetUs: node.offsetMs * 1_000,
    durationUs: node.durationMs * 1_000,
    status: node.status,
    isError: node.isError ?? false,
    isPartial: node.isPartial ?? false,
    hasErrorDescendant: node.isPartial ?? false,
    children: source.filter((candidate) => candidate.parentId === node.id).map((candidate) => candidate.kind === "run" ? `run_${candidate.id}` : candidate.id),
    hasChildren: source.some((candidate) => candidate.parentId === node.id),
    timelineEvents: (node.timelineEvents ?? []).map((event) => ({
      name: event.name,
      offsetUs: event.offsetMs * 1_000,
      kind: "event",
    })),
    inspectorHref: inspectorHref(selectedRunId, node.kind === "run" ? `run_${node.id}` : node.id),
    telemetryEventHref: ["run", "attempt"].includes(node.kind)
      ? null
      : inspectorHref(selectedRunId, node.kind === "run" ? `run_${node.id}` : node.id),
  }));
}

function runHref(runId: string): string {
  return `/skyline/api/runs/${encodeURIComponent(runId)}`;
}

function inspectorHref(runId: string, nodeId: string): string {
  return `${runHref(runId)}/nodes/${encodeURIComponent(nodeId)}`;
}

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(new Date(timestamp).getTime() + milliseconds).toISOString();
}

function generatedTimestamp(index: number): string {
  return new Date(Date.UTC(2026, 7, 4, 19, 57 - index)).toISOString();
}

function fixtureTimestamp(run: Scenario["runs"][number]): string {
  return triggeredAtByRun.get(run.id) ?? generatedTimestamp(scenarios[0].runs.indexOf(run));
}

function withinPeriod(run: Scenario["runs"][number], period: JobsQuery["period"]): boolean {
  if (!period) return true;
  const durationMs = fixtureJobPeriods[period].durationMs;
  if (durationMs === null) return true;
  return new Date(fixtureTimestamp(run)).getTime() >= new Date(fixtureGeneratedAt).getTime() - durationMs;
}

function fixtureOffset(cursor: string | undefined): number {
  const offset = Number.parseInt(cursor ?? "0", 10);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

function parseDuration(value: string): number {
  if (value === "—") return 0;
  const amount = Number.parseFloat(value);
  if (value.endsWith("ms")) return amount;
  return value.endsWith("s") ? amount * 1_000 : amount;
}

type FixtureJobPeriod = NonNullable<JobsQuery["period"]>;

const fixtureJobPeriods = {
  "1h": { label: "Last hour", durationMs: 3_600_000 },
  "24h": { label: "Last 24 hours", durationMs: 86_400_000 },
  "7d": { label: "Last 7 days", durationMs: 604_800_000 },
  "30d": { label: "Last 30 days", durationMs: 2_592_000_000 },
  all: { label: "All time", durationMs: null },
} satisfies Record<FixtureJobPeriod, { label: string; durationMs: number | null }>;

const fixtureTimeRanges = Object.entries(fixtureJobPeriods).map(([value, definition]) => ({
  value: value as FixtureJobPeriod,
  label: definition.label,
}));

const fixtureQueueTimeRanges = [
  { value: "all" as const, label: "All time", durationSeconds: null },
  { value: "1h" as const, label: "Last hour", durationSeconds: 3_600 },
  { value: "24h" as const, label: "Last 24 hours", durationSeconds: 86_400 },
  { value: "7d" as const, label: "Last 7 days", durationSeconds: 604_800 },
];

const fixtureTelemetryCapture = { enabled: true, supportedLevels: ["warning", "error"], perAttemptLimit: 100 };
const fixtureTelemetryEvents: TelemetryEventsPageDto["telemetryEvents"] = [
  {
    id: "event_fixture_operation",
    href: "/skyline/logs?event=event_fixture_operation",
    variant: "operation",
    runId: "run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
    runHref: "/skyline/runs/run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
    attemptNumber: 2,
    attemptHref: "/skyline/runs/run_01J8R4NQX6K3PV4W0A1H2Z7M9C?node=attempt_run_01J8R4NQX6K3PV4W0A1H2Z7M9C_2",
    jobType: "App\\Jobs\\GenerateMonthlyInvoices",
    jobHref: `/skyline/jobs/${fixtureJobId("App\\Jobs\\GenerateMonthlyInvoices")}`,
    timestamp: "2026-08-04T20:01:24.100000000Z",
    traceId: "fda8d9cf9d53e8845fd0738b8407731d",
    spanId: "4f24adb545b26d31",
    parentSpanId: "9adb4c77c49de9aa",
    level: "TRACE",
    name: "insert into invoices",
    role: "sql",
    kind: 3,
    status: "completed",
    durationUs: 82_000,
    operationHref: "/skyline/runs/run_01J8R4NQX6K3PV4W0A1H2Z7M9C?node=span_4f24adb545b26d31",
  },
  {
    id: "event_fixture_log",
    href: "/skyline/logs?event=event_fixture_log",
    variant: "log",
    runId: "run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
    runHref: "/skyline/runs/run_01J8R4NQX6K3PV4W0A1H2Z7M9C",
    attemptNumber: 2,
    attemptHref: "/skyline/runs/run_01J8R4NQX6K3PV4W0A1H2Z7M9C?node=attempt_run_01J8R4NQX6K3PV4W0A1H2Z7M9C_2",
    jobType: "App\\Jobs\\GenerateMonthlyInvoices",
    jobHref: `/skyline/jobs/${fixtureJobId("App\\Jobs\\GenerateMonthlyInvoices")}`,
    timestamp: "2026-08-04T20:01:23.000000000Z",
    traceId: "fda8d9cf9d53e8845fd0738b8407731d",
    spanId: "9adb4c77c49de9aa",
    parentSpanId: null,
    level: "WARN",
    message: "Invoice import delayed",
    context: { code: 429 },
  },
];

function fixtureJobId(name: string) {
  return `job_${fixtureHash(name)}`;
}

function fixtureQueueId(connection: string, queue: string) {
  return `queue_${fixtureHash(`${connection}\0${queue}`)}`;
}

function fixtureHash(value: string) {
  let hash = 5381;
  for (const character of value) hash = ((hash * 33) ^ character.charCodeAt(0)) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

function statusCounts(runs: Scenario["runs"]) {
  const counts = { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0 };
  for (const run of runs) counts[run.status] += 1;
  return counts;
}

function fixtureQueueSummary(runs: Scenario["runs"]) {
  const first = runs[0];
  const timestamps = runs.map((run, index) => triggeredAtByRun.get(run.id) ?? generatedTimestamp(index)).sort();
  const queueTimes = runs.map((run) => parseDuration(run.queueDuration) * 1_000).filter((value) => value > 0).sort((left, right) => left - right);
  return {
    id: fixtureQueueId(first.connection, first.queue),
    connection: first.connection,
    queue: first.queue,
    firstObservedAt: timestamps[0] ?? null,
    lastObservedAt: timestamps.at(-1) ?? null,
    recordedRunCount: runs.length,
    recordedRunCounts: statusCounts(runs),
    queueTime: {
      sampleCount: queueTimes.length,
      medianUs: queueTimes[Math.floor((queueTimes.length - 1) * 0.5)] ?? null,
      p95Us: queueTimes[Math.floor((queueTimes.length - 1) * 0.95)] ?? null,
      maximumUs: queueTimes.at(-1) ?? null,
    },
  };
}
