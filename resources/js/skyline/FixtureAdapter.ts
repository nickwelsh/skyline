import { scenarios } from "./fixtures";
import type {
  InspectorDto,
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

export class FixtureAdapter implements SkylineDtoAdapter {
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
      observedAt: "2026-08-04T20:02:00.000000000Z",
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
      },
      hasAnyRuns: source.length > 0,
    };
  }

  async updates(query: RunsQuery, _since: string, runIds: string[] = []): Promise<RunsUpdatesDto> {
    const page = await this.runs(query);
    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      observedAt: page.observedAt,
      runs: runIds.length ? page.runs.filter((run) => runIds.includes(run.id)) : [],
      newRunCount: 0,
      pollCursor: "fixture-poll-next",
    };
  }

  async trace(runId: string, tableState?: string): Promise<TracePageDto> {
    const { nodes: rawNodes, parentRunId, rootRunId, run } = this.fixtureForRun(runId);
    const nodes = normalizeNodes(rawNodes);
    const summary = this.summary(run, 0);
    const runs = scenarios[0].runs;
    const index = runs.findIndex((candidate) => candidate.id === runId);

    return {
      schemaVersion: 1,
      packageVersion: "fixture",
      observedAt: "2026-08-04T20:02:00.000000000Z",
      run: {
        ...summary,
        traceId: String(rawNodes[0].metadata.traceId ?? "fixture-trace"),
        rootRunId,
        parentRunId: parentRunId ?? null,
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
    const nodes = normalizeNodes(raw);
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

function normalizeNodes(source: Scenario["nodes"]): TraceNode[] {
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
    timelineEvents: [],
  }));
}

function generatedTimestamp(index: number): string {
  return new Date(Date.UTC(2026, 7, 4, 19, 57 - index)).toISOString();
}

function parseDuration(value: string): number {
  if (value === "—") return 0;
  const amount = Number.parseFloat(value);
  if (value.endsWith("ms")) return amount;
  return value.endsWith("s") ? amount * 1_000 : amount;
}
