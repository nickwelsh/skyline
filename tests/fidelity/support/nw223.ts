import type { InspectorDto, InspectorPresentation, TracePageDto } from "../../../resources/js/skyline/dto";

export const nw223States = [
  "inspectors-sql-parameterized", "inspectors-sql-applied", "inspectors-sql-missing-bindings",
  "inspectors-sql-result", "inspectors-sql-source", "inspectors-sql-long", "inspectors-sql-failed",
  "inspectors-sql-capture-limited", "inspectors-transaction-nesting", "inspectors-transaction-failure",
  "inspectors-cache-success", "inspectors-cache-failure", "inspectors-cache-long", "inspectors-cache-unavailable",
  "inspectors-redis-success", "inspectors-redis-failure", "inspectors-redis-long", "inspectors-redis-unavailable",
] as const;

export type Nw223State = typeof nw223States[number];
export const nw223DiscoveryChunks: ReadonlyArray<ReadonlyArray<Nw223State>> = [
  ["inspectors-sql-parameterized"],
  ["inspectors-sql-applied", "inspectors-sql-missing-bindings"],
  ["inspectors-sql-result", "inspectors-sql-source"],
  ["inspectors-sql-long", "inspectors-sql-failed"],
  ["inspectors-sql-capture-limited", "inspectors-transaction-nesting"],
  ["inspectors-transaction-failure", "inspectors-cache-success"],
  ["inspectors-cache-failure", "inspectors-cache-long"],
  ["inspectors-cache-unavailable", "inspectors-redis-success"],
  ["inspectors-redis-failure", "inspectors-redis-long"],
  ["inspectors-redis-unavailable"],
];
export const nw223InteractionStates: ReadonlyArray<Nw223State> = [
  "inspectors-sql-applied", "inspectors-sql-result", "inspectors-sql-long",
  "inspectors-transaction-nesting", "inspectors-transaction-failure",
  "inspectors-cache-success", "inspectors-cache-failure", "inspectors-cache-long", "inspectors-cache-unavailable",
  "inspectors-redis-success", "inspectors-redis-failure", "inspectors-redis-long", "inspectors-redis-unavailable",
];
type Nw223Presentation = Extract<InspectorPresentation, { type: "sql" | "transaction" | "cache" | "redis" }>;
export const nw223NodeId = "span_4f24adb545b26d31";

export function isNw223State(state: string): state is Nw223State {
  return (nw223States as readonly string[]).includes(state);
}

export function nw223TraceState(value: TracePageDto, state: Nw223State): TracePageDto {
  const clone = structuredClone(value);
  const node = clone.trace.nodes.find(({ id }) => id === nw223NodeId);
  if (!node) throw new Error(`Missing NW-223 query node: ${nw223NodeId}`);
  const presentation = nw223Presentation(state);
  node.label = title(presentation.type);
  node.status = presentation.failure ? "failed" : "completed";
  node.isError = presentation.failure !== null;
  return clone;
}

export function nw223InspectorState(value: InspectorDto, nodeId: string, state: Nw223State): InspectorDto {
  if (nodeId !== nw223NodeId) return value;
  const clone = structuredClone(value);
  const presentation = nw223Presentation(state);
  clone.label = title(presentation.type);
  clone.status = presentation.failure ? "failed" : "completed";
  clone.isError = presentation.failure !== null;
  clone.presentation = presentation;
  clone.overview = {
    runId: clone.runId,
    attemptNumber: 2,
    traceId: "00000000000000000000000000000001",
    spanId: "4f24adb545b26d31",
    parentSpanId: "4f24adb545b26d30",
  };
  clone.source = {
    file: "app/Jobs/GenerateMonthlyInvoices.php",
    line: 42,
    href: "vscode://file//workspace/app/Jobs/GenerateMonthlyInvoices.php:42",
  };
  clone.metadata = {
    value: {
      attributes: { "db.namespace": "testing", "skyline.operation.type": presentation.type },
      events: [{ name: `${presentation.type}.completed`, timestamp: timing.endedAt }],
    },
    isTruncated: state.endsWith("capture-limited"),
    truncated: state.endsWith("capture-limited") ? [{ path: "presentation.sql", originalBytes: 16_384 }] : [],
  };
  return clone;
}

const timing = {
  startedAt: "2026-08-05T12:00:00.000000000Z",
  endedAt: "2026-08-05T12:00:00.125000000Z",
  durationUs: 125_000,
};
const sql = "select * from invoices where customer_id = ?";
const bindings = { items: [{ position: 0, column: "customer_id", value: "[REDACTED]" }], truncated: false, originalBytes: 88 };
const result = { kind: "rows" as const, rows: [{ id: 42, total: "125.00" }], rowCount: 1, truncated: false, originalBytes: 128 };

export function nw223Presentation(state: Nw223State): Nw223Presentation {
  if (state.startsWith("inspectors-sql-")) {
    const long = state === "inspectors-sql-long";
    const limited = state === "inspectors-sql-capture-limited";
    const statement = long || limited ? `${sql}\n/* ${"captured-query ".repeat(120)}*/` : sql;
    return {
      type: "sql",
      timing,
      failure: state === "inspectors-sql-failed" ? { type: "QueryException", message: "Deadlock while updating invoices" } : null,
      sql: {
        statement: { value: statement, isTruncated: limited, originalBytes: limited ? 16_384 : statement.length },
        bindings: state === "inspectors-sql-missing-bindings" ? null : { ...bindings, truncated: limited, originalBytes: limited ? 8_192 : bindings.originalBytes },
        result: state === "inspectors-sql-missing-bindings" ? null : {
          ...result,
          rows: long || limited ? [{ id: 42, diagnostic: "result-value ".repeat(100) }] : result.rows,
          rowCount: long || limited ? 20 : result.rowCount,
          truncated: limited,
          originalBytes: limited ? 32_768 : result.originalBytes,
        },
      },
    };
  }

  if (state.startsWith("inspectors-transaction-")) return {
    type: "transaction",
    timing,
    failure: state === "inspectors-transaction-failure" ? { type: null, message: null } : null,
    transaction: { connection: "testing", driver: "sqlite", depth: 2, outcome: state.endsWith("failure") ? "rolled_back" : "committed", queryTimeMs: 12.5 },
  };

  if (state.startsWith("inspectors-cache-")) {
    const unavailable = state.endsWith("unavailable");
    const failed = state.endsWith("failure");
    const long = state.endsWith("long");
    return {
      type: "cache",
      timing,
      failure: failed ? { type: "CacheException", message: "Lock flush failed" } : null,
      cache: {
        operation: failed ? "LOCK FLUSH" : unavailable ? "GET" : "PUT",
        store: "redis",
        key: failed ? null : unavailable ? "sha256:0123456789abcdef" : "customer:42",
        keyCaptured: !failed && !unavailable,
        keyCount: failed ? null : 1,
        strategy: unavailable || failed ? null : "remember",
        outcome: failed ? "failed" : unavailable ? "miss" : "stored",
        hit: unavailable ? false : null,
        ttlSeconds: unavailable || failed ? null : 60,
        freshTtlSeconds: null,
        forever: null,
        value: unavailable || failed ? null : capture(long ? "cache-value ".repeat(120) : { invoiceId: 42 }),
      },
    };
  }

  const unavailable = state.endsWith("unavailable");
  const failed = state.endsWith("failure");
  const long = state.endsWith("long");
  return {
    type: "redis",
    timing,
    failure: failed ? { type: "RedisException", message: "Connection lost" } : null,
    redis: {
      command: failed ? "SET" : unavailable ? "GET" : "MSET",
      connection: "default",
      outcome: failed ? "failed" : "completed",
      arguments: unavailable ? null : capture(long ? ["redis-key-".repeat(80), "redis-value-".repeat(80)] : ["invoice:42", "paid"]),
    },
  };
}

function capture(value: unknown) {
  const serialized = JSON.stringify(value);
  return { type: Array.isArray(value) ? "array" : typeof value, value, originalBytes: serialized.length, truncated: false };
}

function title(type: InspectorPresentation["type"]) {
  return ({ sql: "SQL query", transaction: "Database transaction", cache: "Cache operation", redis: "Redis command" } as Record<string, string>)[type] ?? "Recorded operation";
}
