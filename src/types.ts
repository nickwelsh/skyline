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
