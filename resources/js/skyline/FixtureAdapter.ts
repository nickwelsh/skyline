import { scenarios } from "./fixtures";
import type {
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
  SkylineDtoAdapter,
  TraceNode,
  TracePageDto,
} from "./dto";

const triggeredAtByRun = new Map([
  ["run_01J8R4NQX6K3PV4W0A1H2Z7M9C", "2026-08-04T20:01:21.000000000Z"],
  ["run_01J8R4H9S9J12V04CNH6F6JQ3M", "2026-08-04T20:01:26.000000000Z"],
  ["run_01J8R47YYNA4GFVDMTQ9P59BJW", "2026-08-04T20:00:58.000000000Z"],
  ["run_01J8R3XK1YV76N3Q51RPXQ0VC2", "2026-08-04T19:59:42.000000000Z"],
  ["run_01J8R3RXZ6A7J19G4Y53CXF7F4", "2026-08-04T19:58:11.000000000Z"],
]);
const fixtureGeneratedAt = "2026-08-04T20:02:00.000000000Z";
const pageSize = 25;

const capabilities = {
  navigation: { jobs: true, runs: true, queues: true },
  jobs: { view: true, testJob: false },
  runs: { view: true, cancel: false, replay: false },
  shell: { shortcuts: true },
};

export class FixtureAdapter implements SkylineDtoAdapter {
  async queueTargets(query: QueueTargetsQuery = {}): Promise<QueueTargetsPageDto> {
    const grouped = Map.groupBy(scenarios[0].runs, (run) => `${run.connection}\0${run.queue}`);
    const search = query.search?.toLowerCase();
    const queueTargets = [...grouped.values()]
      .filter((runs) => (!query.connection || runs[0].connection === query.connection)
        && (!search || `${runs[0].connection} ${runs[0].queue}`.toLowerCase().includes(search)))
      .map((runs) => fixtureQueueSummary(runs))
      .sort((left, right) => `${left.connection}\0${left.queue}`.localeCompare(`${right.connection}\0${right.queue}`));
    const connections = [...new Set(scenarios[0].runs.map((run) => run.connection))].sort();

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T20:02:00.000000000Z",
      capabilities,
      queueTargets,
      pagination: { next: null, previous: null },
      filters: { connection: query.connection ?? null, search: query.search ?? null, from: query.from ?? null, to: query.to ?? null, status: [] },
      options: { connections },
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
      options: { statuses: ["queued", "running", "retrying", "completed", "failed"] },
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
      return matchesSearch && (!query.status || query.status.includes(run.status));
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
        runtime: { php: "8.4.8", laravel: "12.42.0" },
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
    const id = fixtureJobId(name);
    return {
      id,
      name,
      href: `/skyline/jobs/${id}`,
      firstObservedAt: observed[0],
      lastObservedAt: observed.at(-1) ?? observed[0],
      runCount: runs.length,
      statusCounts: statusCounts(runs),
      latestRun: {
        id: latest.id,
        status: latest.status,
        triggeredAt: triggeredAtByRun.get(latest.id) ?? generatedTimestamp(0),
        href: `/skyline/runs/${encodeURIComponent(latest.id)}`,
      },
    };
  }

  private fixtureForRun(runId: string): { run: Scenario["runs"][number]; nodes: Scenario["nodes"]; rootRunId: string; parentRunId?: string } {
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
  const durations = { "1h": 3_600_000, "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 };
  if (!period || period === "all") return true;
  return new Date(fixtureTimestamp(run)).getTime() >= new Date(fixtureGeneratedAt).getTime() - durations[period];
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

const fixtureTimeRanges = [
  { value: "1h" as const, label: "Last hour" },
  { value: "24h" as const, label: "Last 24 hours" },
  { value: "7d" as const, label: "Last 7 days" },
  { value: "30d" as const, label: "Last 30 days" },
  { value: "all" as const, label: "All time" },
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
