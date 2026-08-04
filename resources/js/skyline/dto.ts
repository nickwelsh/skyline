export type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
export type AttemptStatus = "running" | "completed" | "released" | "failed";
export type NodeKind = "run" | "attempt" | "query";

export type RunSummary = {
  id: string;
  name: string;
  status: RunStatus;
  connection: string | null;
  queue: string | null;
  attemptCount: number;
  triggeredAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  queueDurationUs: number | null;
  durationUs: number | null;
  activeDurationUs?: number | null;
  revision: number;
};

export type ExceptionFrame = {
  file: string;
  line: number | null;
  class: string | null;
  type: string | null;
  function: string;
};

export type TraceNode = {
  id: string;
  parentId: string | null;
  runId: string;
  kind: NodeKind;
  label: string;
  level: number;
  offsetUs: number;
  durationUs: number | null;
  status: RunStatus | AttemptStatus;
  isError: boolean;
  isPartial: boolean;
  hasErrorDescendant: boolean;
  children: string[];
  hasChildren: boolean;
  timelineEvents: Array<{ name: string; offsetUs: number }>;
};

export type RunsQuery = {
  search?: string;
  status?: RunStatus[];
  cursor?: string;
  job?: string;
  connection?: string;
  queue?: string;
  triggeredFrom?: string;
  triggeredTo?: string;
};

export type RunsPageDto = {
  schemaVersion: 1;
  packageVersion: string;
  observedAt: string;
  runs: RunSummary[];
  pagination: { next: string | null; previous: string | null };
  pollCursor: string;
  polling: { activeRunsIntervalMs: number; newRunsIntervalMs: number };
  tableState: string;
  filters: Record<string, unknown>;
  options: {
    statuses: RunStatus[];
    jobNames: string[];
    queueTargets: Array<{ connection: string; queue: string }>;
  };
  hasAnyRuns: boolean;
};

export type RunsUpdatesDto = {
  schemaVersion: 1;
  packageVersion: string;
  observedAt: string;
  runs: RunSummary[];
  newRunCount: number;
  pollCursor: string;
};

export type TracePageDto = {
  schemaVersion: 1;
  packageVersion: string;
  observedAt: string;
  run: Omit<RunSummary, "activeDurationUs" | "revision"> & {
    traceId: string;
    rootRunId: string | null;
    parentRunId: string | null;
  };
  trace: {
    revision: number;
    rootStatus: "executing" | "completed" | "failed";
    rootStartedAt: string;
    durationUs: number | null;
    activeDurationUs: number | null;
    queuedDurationUs: number | null;
    nodes: TraceNode[];
    nodeCount: number;
    isTruncated: boolean;
    polling: boolean;
    pollIntervalMs: number;
    pollUntil: string | null;
  };
  navigation: {
    previousRunId: string | null;
    nextRunId: string | null;
    tableState: string;
    listCursor: string | null;
  };
};

export type InspectorDto = TraceNode & {
  overview: Record<string, string | number | null>;
  exception?: {
    class: string;
    message: string;
    messageTruncated: boolean;
    messageOriginalBytes: number;
    code: string | null;
    location: { file: string; line: number | null };
    frames: ExceptionFrame[];
    framesTruncated: boolean;
  } | null;
  sql?: { value: string; isTruncated: boolean; originalBytes: number };
  metadata: {
    value: Record<string, unknown>;
    isTruncated: boolean;
    truncated: Array<{ path: string; originalBytes: number }>;
  };
};

export type Scenario = {
  key: string;
  label: string;
  selectedRunId: string;
  runs: Array<{
    id: string;
    name: string;
    status: RunStatus;
    connection: string;
    queue: string;
    attemptCount: number;
    triggeredAt: string;
    queueDuration: string;
    duration: string;
  }>;
  nodes: Array<{
    id: string;
    parentId?: string;
    runId: string;
    kind: NodeKind;
    label: string;
    level: number;
    offsetMs: number;
    durationMs: number;
    status: RunStatus | AttemptStatus;
    isError?: boolean;
    isPartial?: boolean;
    sql?: string;
    exception?: {
      class: string;
      message: string;
      frames: Array<{ file: string; line: number; call: string }>;
    };
    metadata: Record<string, string | number | boolean>;
  }>;
};

export interface SkylineDtoAdapter {
  runs(query?: RunsQuery, signal?: AbortSignal): Promise<RunsPageDto>;
  updates(query: RunsQuery, since: string, runIds?: string[], signal?: AbortSignal): Promise<RunsUpdatesDto>;
  trace(runId: string, tableState?: string, signal?: AbortSignal): Promise<TracePageDto>;
  inspector(nodeId: string, runId: string, signal?: AbortSignal): Promise<InspectorDto>;
}
