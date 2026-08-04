export type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
export type NodeKind = "run" | "attempt" | "query";

export type RunSummary = {
  id: string;
  name: string;
  status: RunStatus;
  connection: string;
  queue: string;
  attemptCount: number;
  triggeredAt: string;
  queueDuration: string;
  duration: string;
};

export type TraceNode = {
  id: string;
  parentId?: string;
  runId: string;
  kind: NodeKind;
  label: string;
  level: number;
  offsetMs: number;
  durationMs: number;
  status: RunStatus | "released";
  isError?: boolean;
  isPartial?: boolean;
  sql?: string;
  exception?: {
    class: string;
    message: string;
    frames: Array<{ file: string; line: number; call: string }>;
  };
  metadata: Record<string, string | number | boolean>;
};

export type Scenario = {
  key: string;
  label: string;
  selectedRunId: string;
  runs: RunSummary[];
  nodes: TraceNode[];
};

export type RunsQuery = {
  search?: string;
  status?: RunStatus[];
  cursor?: string;
  limit?: 25;
};

export type RunsPageDto = {
  runs: Array<{
    id: string;
    name: string;
    status: RunStatus;
    connection: string;
    queue: string;
    attemptCount: number;
    queuedAt: string;
    startedAt?: string;
    finishedAt?: string;
    queueDurationMs?: number;
    durationMs?: number;
  }>;
  pagination: { next?: string; previous?: string };
  hasAnyRuns: boolean;
};

export type TracePageDto = {
  run: {
    id: string;
    name: string;
    status: RunStatus;
    connection: string;
    queue: string;
    attemptCount: number;
    queuedAt: string;
    startedAt?: string;
    finishedAt?: string;
    queueDurationMs?: number;
    durationMs?: number;
    traceId: string;
    rootRunId?: string;
    parentRunId?: string;
  };
  trace: {
    rootSpanStatus: "executing" | "completed" | "failed";
    durationNs: number;
    rootStartedAt: string;
    queuedDurationNs?: number;
    events: Array<{
      id: string;
      parentId?: string;
      runId?: string;
      children: string[];
      hasChildren: boolean;
      level: number;
      data: {
        message: string;
        kind: "run" | "attempt" | "query";
        status: RunStatus | "released";
        level: "INFO" | "ERROR";
        offsetNs: number;
        durationNs: number | null;
        isError: boolean;
        isPartial: boolean;
        isCancelled: boolean;
        timelineEvents: Array<{ name: string; offsetNs: number }>;
      };
    }>;
  };
};

export type InspectorDto = TraceNode;

export interface SkylineDtoAdapter {
  runs(query?: RunsQuery): RunsPageDto;
  trace(runId: string): TracePageDto;
  inspector(nodeId: string, runId?: string): InspectorDto;
}
