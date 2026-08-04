import { scenarios } from "./fixtures";
import type {
  InspectorDto,
  RunsPageDto,
  RunsQuery,
  Scenario,
  SkylineDtoAdapter,
  TracePageDto,
} from "./dto";

const queuedAtByRun = new Map([
  ["run_01J8R4NQX6K3PV4W0A1H2Z7M9C", "2026-08-04T20:01:21.000Z"],
  ["run_01J8R4H9S9J12V04CNH6F6JQ3M", "2026-08-04T20:01:26.000Z"],
  ["run_01J8R47YYNA4GFVDMTQ9P59BJW", "2026-08-04T20:00:58.000Z"],
  ["run_01J8R3XK1YV76N3Q51RPXQ0VC2", "2026-08-04T19:59:42.000Z"],
  ["run_01J8R3RXZ6A7J19G4Y53CXF7F4", "2026-08-04T19:58:11.000Z"],
]);

export class FixtureAdapter implements SkylineDtoAdapter {
  runs(query: RunsQuery = {}): RunsPageDto {
    const source = scenarios[0].runs;
    const search = query.search?.toLowerCase();
    const filtered = source.filter((run) => {
      const matchesSearch = !search || run.id.toLowerCase().includes(search) || run.name.toLowerCase().includes(search);
      return matchesSearch && (!query.status || query.status.includes(run.status));
    });

    const limit = query.limit ?? 25;
    const requestedOffset = Number.parseInt(query.cursor ?? "0", 10);
    const offset = Number.isFinite(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

    return {
      runs: filtered.slice(offset, offset + limit).map((run, index) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        connection: run.connection,
        queue: run.queue,
        attemptCount: run.attemptCount,
        queuedAt: queuedAtByRun.get(run.id) ?? generatedTimestamp(offset + index),
        startedAt: run.status === "queued" ? undefined : (queuedAtByRun.get(run.id) ?? generatedTimestamp(offset + index)),
        finishedAt: ["completed", "failed"].includes(run.status) ? (queuedAtByRun.get(run.id) ?? generatedTimestamp(offset + index)) : undefined,
        queueDurationMs: parseDuration(run.queueDuration),
        durationMs: parseDuration(run.duration),
      })),
      pagination: {
        next: offset + limit < filtered.length ? String(offset + limit) : undefined,
        previous: offset > 0 ? String(Math.max(0, offset - limit)) : undefined,
      },
      hasAnyRuns: source.length > 0,
    };
  }

  trace(runId: string): TracePageDto {
    const { nodes, parentRunId, rootRunId, run } = this.fixtureForRun(runId);
    const root = nodes[0];
    const children = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
    }

    return {
      run: {
        id: run.id,
        name: run.name,
        status: run.status,
        connection: run.connection,
        queue: run.queue,
        attemptCount: run.attemptCount,
        queuedAt: queuedAtByRun.get(run.id) ?? generatedTimestamp(0),
        startedAt: run.status === "queued" ? undefined : (queuedAtByRun.get(run.id) ?? generatedTimestamp(0)),
        finishedAt: ["completed", "failed"].includes(run.status) ? (queuedAtByRun.get(run.id) ?? generatedTimestamp(0)) : undefined,
        queueDurationMs: parseDuration(run.queueDuration),
        durationMs: parseDuration(run.duration),
        traceId: String(root.metadata.traceId ?? "fixture-trace"),
        rootRunId,
        parentRunId,
      },
      trace: {
        rootSpanStatus: root.status === "failed" ? "failed" : root.status === "running" ? "executing" : "completed",
        durationNs: Math.max(...nodes.map((node) => node.offsetMs + node.durationMs)) * 1_000_000,
        rootStartedAt: queuedAtByRun.get(run.id) ?? "2026-08-04T20:00:00.000Z",
        queuedDurationNs: parseDuration(run.queueDuration) * 1_000_000,
        events: nodes.map((node) => ({
          id: node.id,
          parentId: node.parentId,
          runId: node.runId,
          children: children.get(node.id) ?? [],
          hasChildren: children.has(node.id),
          level: node.level,
          data: {
            message: node.label,
            kind: node.kind,
            status: node.status,
            level: node.isError ? "ERROR" : "INFO",
            offsetNs: node.offsetMs * 1_000_000,
            durationNs: node.durationMs * 1_000_000,
            isError: node.isError ?? false,
            isPartial: node.isPartial ?? false,
            isCancelled: false,
            timelineEvents: [],
          },
        })),
      },
    };
  }

  inspector(nodeId: string, runId?: string): InspectorDto {
    const source = runId ? this.fixtureForRun(runId).nodes : scenarios.flatMap((scenario) => scenario.nodes);
    const node = source.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`Unknown fixture inspector node: ${nodeId}`);
    return node;
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

function generatedTimestamp(index: number): string {
  return new Date(Date.UTC(2026, 7, 4, 19, 57 - index)).toISOString();
}

function parseDuration(value: string): number {
  if (value === "—") return 0;
  const amount = Number.parseFloat(value);
  if (value.endsWith("ms")) return amount;
  return value.endsWith("s") ? amount * 1_000 : amount;
}
