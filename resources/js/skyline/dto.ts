export type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
export type AttemptStatus = "running" | "completed" | "released" | "failed";
export type NodeKind = "run" | "attempt" | "breadcrumb" | "query" | "request" | "cache" | "redis" | "custom" | "transaction" | "mail" | "notification" | "storage" | "process" | "span";

export type RunSummary = {
  id: string;
  traceId: string;
  parentRunId: string | null;
  isRoot: boolean;
  name: string;
  status: RunStatus;
  connection: string | null;
  queue: string | null;
  driverId: string | null;
  attemptCount: number;
  triggeredAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  queueDurationUs: number | null;
  queueTimeSource: string | null;
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
  isVendor: boolean;
  href: string | null;
  snippet: {
    code: string;
    startingLine: number;
    highlightedLine: number;
  } | null;
};

export type ExceptionDetails = {
  class: string;
  message: string;
  messageTruncated: boolean;
  messageOriginalBytes: number;
  code: string | null;
  location: { file: string; line: number | null; href: string | null } | null;
  frames: ExceptionFrame[];
  framesTruncated: boolean;
  markdown: string;
};

export type SqlBinding = {
  position: number;
  column: string | null;
  value: unknown;
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
  timelineEvents: Array<{ name: string; offsetUs: number; kind?: "event" }>;
  logLevel?: string;
  inspectorHref: string;
  telemetryEventHref: string | null;
};

export type AttemptDetail = {
  id: string;
  number: number;
  status: AttemptStatus;
  startedAt: string;
  finishedAt: string | null;
  queueDurationUs: number | null;
  queueTimeSource: string | null;
  failure: { class: string; message: string; messageTruncated: boolean } | null;
  inspectorHref: string;
};

export type RunRelationship = {
  id: string;
  runHref: string;
  parentRunId?: string;
  name?: string;
  status?: RunStatus;
  inspectorHref?: string;
};

export type RunsQuery = {
  search?: string;
  status?: RunStatus[];
  cursor?: string;
  job?: string;
  connection?: string;
  queue?: string;
  trace?: string;
  rootOnly?: boolean;
  triggeredFrom?: string;
  triggeredTo?: string;
};

export type JobsQuery = {
  search?: string;
  period?: "1h" | "24h" | "7d" | "30d" | "all";
  cursor?: string;
};

export type JobRunsQuery = {
  status?: RunStatus[];
  cursor?: string;
  period?: JobsQuery["period"];
};

export type JobStatusCounts = Record<RunStatus, number>;

export type JobSummary = {
  id: string;
  name: string;
  href: string;
  firstObservedAt: string;
  lastObservedAt: string;
  runCount: number;
  statusCounts: JobStatusCounts;
  activity: Array<{ timestamp: string; total: number; statusCounts: JobStatusCounts }>;
  latestRun: { id: string; status: RunStatus; triggeredAt: string; href: string };
};

export type TimeRangeOption = { value: NonNullable<JobsQuery["period"]>; label: string };
export type QueueTimeRangeOption = { value: "all" | "1h" | "24h" | "7d"; label: string; durationSeconds: number | null };

export type JobsPageDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  jobs: JobSummary[];
  pagination: { next: string | null; previous: string | null };
  filters: { search: string | null; period: NonNullable<JobsQuery["period"]> };
  options: { timeRanges: TimeRangeOption[] };
  hasAnyJobs: boolean;
};

export type JobDetailDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  job: JobSummary;
  queueTargets: Array<{ id: string; connection: string; queue: string; runCount: number; href: string }>;
  activity: Array<{ timestamp: string; total: number; statusCounts: JobStatusCounts }>;
  runs: RunSummary[];
  pagination: { next: string | null; previous: string | null };
  tableState: string;
  filters: { status: RunStatus[]; period: NonNullable<JobsQuery["period"]> };
  options: { statuses: RunStatus[]; timeRanges: TimeRangeOption[] };
  hasAnyRuns: boolean;
};

export type QueueTargetsQuery = {
  cursor?: string;
  connection?: string;
  search?: string;
  from?: string;
  to?: string;
};

export type QueueTargetRunsQuery = QueueTargetsQuery & { status?: RunStatus[] };
export type QueueTimeStats = { sampleCount: number; medianUs: number | null; p95Us: number | null; maximumUs: number | null };
export type QueueTargetSummary = {
  id: string;
  connection: string;
  queue: string;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  recordedRunCount: number;
  recordedRunCounts: Record<RunStatus, number>;
  queueTime: QueueTimeStats;
};
export type QueueTargetFilters = {
  connection: string | null;
  search: string | null;
  from: string | null;
  to: string | null;
  status: RunStatus[];
};
export type QueueEnvironmentSummary = {
  queued: number;
  running: number;
  allocated: number | null;
  limit: number | null;
};
export type QueueTargetsPageDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  environmentSummary: QueueEnvironmentSummary;
  queueTargets: QueueTargetSummary[];
  pagination: { next: string | null; previous: string | null };
  filters: QueueTargetFilters;
  options: { connections: string[]; timeRanges: QueueTimeRangeOption[] };
  hasAnyQueueTargets: boolean;
};
export type QueueTargetRunSummary = {
  id: string;
  href: string;
  traceId: string;
  name: string;
  status: RunStatus;
  attemptCount: number;
  triggeredAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  queueDurationUs: number | null;
  durationUs: number | null;
  activeDurationUs: number | null;
};
export type QueueTargetDetailDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  queueCapabilities: Record<string, boolean>;
  queueTarget: QueueTargetSummary;
  series: {
    activity: Array<{ timestamp: string; recordedRuns: number; recordedRunCounts: Record<RunStatus, number> }>;
    queueTime: Array<{ timestamp: string } & QueueTimeStats>;
  };
  runs: QueueTargetRunSummary[];
  pagination: { next: string | null; previous: string | null };
  filters: QueueTargetFilters;
  options: { statuses: RunStatus[]; timeRanges: QueueTimeRangeOption[] };
  hasAnyRuns: boolean;
};

export type ErrorGroupsQuery = {
  search?: string;
  jobType?: string;
  exceptionClass?: string;
  period?: JobsQuery["period"];
  cursor?: string;
};
export type ErrorOccurrencesQuery = Pick<ErrorGroupsQuery, "period" | "cursor">;
export type ErrorGroupSummary = {
  id: string;
  fingerprint: string;
  href: string;
  jobType: string;
  jobId: string;
  jobHref: string;
  exceptionClass: string;
  representativeMessage: string;
  firstObservedAt: string;
  lastObservedAt: string;
  occurrenceCount: number;
  activity: Array<{ timestamp: string; occurrences: number }>;
  latest: {
    runId: string;
    attemptNumber: number;
    observedAt: string;
    runHref: string;
    attemptHref: string;
  };
};
export type ErrorGroupsPageDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  errorGroups: ErrorGroupSummary[];
  pagination: { next: string | null; previous: string | null };
  filters: { search: string | null; jobType: string | null; exceptionClass: string | null; period: NonNullable<JobsQuery["period"]> };
  options: { jobTypes: string[]; exceptionClasses: string[]; timeRanges: TimeRangeOption[] };
  hasAnyErrorGroups: boolean;
};
export type ErrorGroupOccurrence = {
  id: string;
  runId: string;
  attemptNumber: number;
  jobType: string;
  connection: string | null;
  queue: string | null;
  triggeredAt: string;
  startedAt: string;
  finishedAt: string | null;
  observedAt: string;
  runHref: string;
  attemptHref: string;
  exception: ExceptionDetails;
};
export type ErrorGroupDetailDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  errorGroup: ErrorGroupSummary;
  representative: ExceptionDetails;
  activity: Array<{ timestamp: string; occurrences: number }>;
  failedAttempts: ErrorGroupOccurrence[];
  pagination: { next: string | null; previous: string | null };
  filters: { period: NonNullable<JobsQuery["period"]> };
  options: { timeRanges: TimeRangeOption[] };
  hasAnyOccurrences: boolean;
};

export type TelemetryEventLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
export type TelemetryEventsQuery = {
  search?: string;
  levels?: TelemetryEventLevel[];
  jobType?: string;
  runId?: string;
  period?: JobsQuery["period"];
  cursor?: string;
};
type TelemetryEventShared = {
  id: string;
  href: string;
  runId: string;
  runHref: string;
  attemptNumber: number | null;
  attemptHref: string | null;
  jobType: string;
  jobHref: string;
  timestamp: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  level: TelemetryEventLevel;
};
export type OperationTelemetryEvent = TelemetryEventShared & {
  variant: "operation";
  name: string;
  role: string | null;
  kind: number;
  status: "completed" | "failed";
  durationUs: number;
  operationHref: string;
};
export type LogTelemetryEvent = TelemetryEventShared & {
  variant: "log";
  message: string;
  context: Record<string, unknown>;
};
export type TelemetryEventSummary = OperationTelemetryEvent | LogTelemetryEvent;
export type TelemetryCapture = { enabled: boolean; supportedLevels: string[]; perAttemptLimit: number };
export type TelemetryEventsPageDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  telemetryEvents: TelemetryEventSummary[];
  pagination: { next: string | null; previous: string | null };
  filters: { search: string | null; levels: TelemetryEventLevel[]; jobType: string | null; runId: string | null; period: NonNullable<JobsQuery["period"]> };
  options: { levels: TelemetryEventLevel[]; jobTypes: string[]; timeRanges: TimeRangeOption[] };
  capture: TelemetryCapture;
  hasAnyTelemetryEvents: boolean;
};
type TelemetryEventDetailShared = {
  relationships: { traceId: string; spanId: string; parentSpanId: string | null };
  attributes: Record<string, unknown>;
  capture: { isTruncated: boolean; truncated: Array<{ path: string; originalBytes: number }> };
  errorHref: string | null;
};
export type OperationTelemetryEventDetail = OperationTelemetryEvent & TelemetryEventDetailShared & {
  events: Array<{ name: string; timestamp: string | null; attributes: Record<string, unknown> }>;
  links: Array<{ traceId: string | null; spanId: string | null; traceFlags: number | null; remote: boolean | null; attributes: Record<string, unknown> }>;
  resource: Record<string, unknown>;
  instrumentation: Record<string, unknown>;
};
export type LogTelemetryEventDetail = LogTelemetryEvent & TelemetryEventDetailShared & { channel: string | null };
export type TelemetryEventDetail = OperationTelemetryEventDetail | LogTelemetryEventDetail;
export type TelemetryEventDetailDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  telemetryEvent: TelemetryEventDetail;
  capture: TelemetryCapture;
};

type CapabilityMap<K extends string> = { [P in K]: boolean };

export type SkylineCapabilities = {
  navigation: CapabilityMap<"jobs" | "runs" | "sessions" | "prompts" | "models" | "errors" | "logs" | "queues" | "query" | "dashboards" | "deployments" | "environmentVariables" | "previewBranches" | "regions" | "waitpointTokens" | "batches" | "bulkActions" | "apiKeys" | "concurrency" | "limits" | "integrations" | "schedules" | "waitpoints" | "alerts" | "settings">;
  runs: CapabilityMap<"view" | "cancel" | "replay" | "bulkCancel" | "bulkReplay">;
  jobs: CapabilityMap<"view" | "testJob" | "configure" | "schedule">;
  errors: CapabilityMap<"view" | "assign" | "ignore" | "resolve" | "alerts" | "replay" | "cancel" | "versions" | "bulkActions">;
  logs: CapabilityMap<"view">;
  queues: CapabilityMap<"view" | "pause" | "concurrency" | "workers" | "rateLimits">;
  shell: CapabilityMap<"appearance" | "sidebarCustomization" | "favorites" | "panelPersistence" | "shortcuts" | "account" | "notifications" | "jobGuidance" | "organizationSwitching" | "projectSwitching" | "environmentSwitching" | "accountOpening">;
  help: CapabilityMap<"menu" | "shortcuts" | "askAi" | "documentation" | "status" | "suggestFeature" | "contact" | "changelog">;
};

export type SkylineBootstrap = {
  schemaVersion: 1;
  basePath: string;
  applicationName: string;
  environmentLabel: string;
  capabilities: SkylineCapabilities;
};

export type RunsPageDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
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
    traceIdentities: string[];
  };
  hasAnyRuns: boolean;
};

export type RunsUpdatesDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  runs: RunSummary[];
  newRunCount: number;
  pollCursor: string;
};

export type TracePageDto = {
  schemaVersion: 1;
  packageVersion: string;
  generatedAt: string;
  capabilities: SkylineCapabilities;
  run: Omit<RunSummary, "activeDurationUs" | "revision"> & {
    traceId: string;
    rootRunId: string | null;
    parentRunId: string | null;
    queueTarget: { connection: string | null; queue: string | null };
    driverId: string | null;
    queueTimeSource: string | null;
  };
  attempts: AttemptDetail[];
  relationships: { parent: RunRelationship | null; children: RunRelationship[] };
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
  presentation?: InspectorPresentation;
  overview: Record<string, string | number | null>;
  exception?: ExceptionDetails | null;
  sql?: { value: string; isTruncated: boolean; originalBytes: number };
  source?: { file: string; line: number; href: string | null } | null;
  bindings?: {
    items: SqlBinding[];
    truncated: boolean;
    originalBytes: number;
  } | null;
  result?: {
    kind: "rows";
    rows: unknown[];
    rowCount: number;
    truncated: boolean;
    originalBytes: number;
  } | {
    kind: "affected";
    affectedRows: number;
    truncated: boolean;
    originalBytes: number;
  } | null;
  http?: {
    method: string;
    url: string;
    statusCode: number | null;
    request: HttpMessageCapture;
    response: HttpMessageCapture;
  };
  cache?: {
    operation: string | null;
    store: string | null;
    key: string | null;
    keyCaptured: boolean;
    keyCount: number | null;
    strategy: string | null;
    outcome: string | null;
    hit: boolean | null;
    ttlSeconds: number | null;
    freshTtlSeconds: number | null;
    forever: boolean | null;
    value: CapturedValue | null;
  };
  redis?: { command: string | null; connection: string | null; outcome: string | null; arguments: CapturedValue | null };
  storage?: {
    operation: string | null;
    disk: string | null;
    driver: string | null;
    path: string | null;
    pathCaptured: boolean;
    destination: string | null;
    destinationCaptured: boolean;
    bytes: number | null;
    outcome: string | null;
    url: string | null;
    destinationUrl: string | null;
    localFile: { path: string; href: string | null } | null;
    destinationLocalFile: { path: string; href: string | null } | null;
    content: CapturedValue | null;
    result: { exists: boolean | null; lastModified: number | null; mimeType: string | null; visibility: string | null };
  };
  delivery?: {
    kind: "mail" | "notification";
    messageType: string | null;
    transportOrChannel: string | null;
    recipientCount: number | null;
    outcome: string | null;
    recipients: Array<{ kind: string; address: string; name?: string }> | null;
    recipientIdentity: CapturedValue | null;
    subject: TextCapture | null;
    text: TextCapture | null;
    html: TextCapture | null;
    messageData: CapturedValue | null;
    operationData: CapturedValue | null;
  };
  process?: {
    executable: string | null;
    async: boolean | null;
    timeoutSeconds: number | null;
    exitCode: number | null;
    timedOut: boolean | null;
    outcome: string | null;
    command: CapturedValue | null;
    environment: CapturedValue | null;
    input: CapturedValue | null;
    stdout: CapturedValue | null;
    stderr: CapturedValue | null;
  };
  transaction?: { connection: string | null; driver: string | null; depth: number | null; outcome: string | null; queryTimeMs: number | null };
  custom?: { name: string; attributes: Record<string, unknown> };
  summary?: {
    resources: { peakMemoryBytes: number; memoryDeltaBytes: number; cpuTimeUs: number };
    operations: Record<string, { count: number; durationMs: number }>;
  } | null;
  breadcrumb?: {
    timestamp: string;
    level: string;
    channel: string;
    message: string;
    context: Record<string, unknown>;
  };
  metadata: {
    value: Record<string, unknown>;
    isTruncated: boolean;
    truncated: Array<{ path: string; originalBytes: number }>;
  };
};

export type InspectorTiming = { startedAt: string | null; endedAt: string | null; durationUs: number | null };
export type InspectorFailure = { type: string | null; message: string | null } | null;
type TimedPresentation = { timing: InspectorTiming; failure: InspectorFailure };
export type InspectorPresentation =
  | ({
    type: "sql";
    sql: {
      statement: NonNullable<InspectorDto["sql"]>;
      bindings: InspectorDto["bindings"];
      result: InspectorDto["result"];
    };
  } & TimedPresentation)
  | ({ type: "transaction"; transaction: NonNullable<InspectorDto["transaction"]> } & TimedPresentation)
  | ({ type: "cache"; cache: NonNullable<InspectorDto["cache"]> } & TimedPresentation)
  | ({ type: "redis"; redis: NonNullable<InspectorDto["redis"]> } & TimedPresentation)
  | ({ type: "http"; http: NonNullable<InspectorDto["http"]> } & TimedPresentation)
  | ({ type: "delivery"; delivery: NonNullable<InspectorDto["delivery"]> } & TimedPresentation)
  | ({ type: "storage"; storage: NonNullable<InspectorDto["storage"]> } & TimedPresentation)
  | ({ type: "process"; process: NonNullable<InspectorDto["process"]> } & TimedPresentation)
  | ({ type: "custom"; custom: NonNullable<InspectorDto["custom"]> } & TimedPresentation)
  | { type: "breadcrumb"; breadcrumb: NonNullable<InspectorDto["breadcrumb"]> }
  | { type: "summary"; summary: NonNullable<InspectorDto["summary"]> }
  | ({ type: "generic" } & Partial<TimedPresentation>);

export type CapturedValue = { type: string; value: unknown; originalBytes: number; truncated: boolean };
export type TextCapture = { value: string; truncated: boolean };

export type HttpMessageCapture = {
  headers: { items: Record<string, string[]>; truncated: boolean } | null;
  body: {
    value: string;
    contentType: string | null;
    originalBytes: number;
    truncated: boolean;
    isJson: boolean;
    json: unknown;
  } | null;
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
    timelineEvents?: Array<{ name: string; offsetMs: number }>;
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
  telemetryEvents(query?: TelemetryEventsQuery, signal?: AbortSignal): Promise<TelemetryEventsPageDto>;
  telemetryEvent(eventId: string, signal?: AbortSignal): Promise<TelemetryEventDetailDto>;
  errorGroups(query?: ErrorGroupsQuery, signal?: AbortSignal): Promise<ErrorGroupsPageDto>;
  errorGroup(errorId: string, query?: ErrorOccurrencesQuery, signal?: AbortSignal): Promise<ErrorGroupDetailDto>;
  queueTargets(query?: QueueTargetsQuery, signal?: AbortSignal): Promise<QueueTargetsPageDto>;
  queueTarget(queueId: string, query?: QueueTargetRunsQuery, signal?: AbortSignal): Promise<QueueTargetDetailDto>;
  jobs(query?: JobsQuery, signal?: AbortSignal): Promise<JobsPageDto>;
  job(jobId: string, query?: JobRunsQuery, signal?: AbortSignal): Promise<JobDetailDto>;
  runs(query?: RunsQuery, signal?: AbortSignal): Promise<RunsPageDto>;
  updates(query: RunsQuery, since: string, runIds?: string[], signal?: AbortSignal): Promise<RunsUpdatesDto>;
  trace(runId: string, tableState?: string, signal?: AbortSignal): Promise<TracePageDto>;
  inspector(nodeId: string, runId: string, signal?: AbortSignal): Promise<InspectorDto>;
}
