import { describe, expect, it } from "vitest";
import { FixtureAdapter } from "../../../resources/js/skyline/FixtureAdapter";
import matrix from "../matrix.json" with { type: "json" };
import { createReferenceFixture } from "./reference";
import { isNw223State, nw223InspectorState, nw223Presentation, nw223States, nw223TraceState } from "./nw223";

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
const queryNodeId = "span_4f24adb545b26d31";

describe("NW-223 database and state inspector states", () => {
  it("owns every accepted inspector state", () => {
    expect(nw223States).toEqual([
      "inspectors-sql-parameterized", "inspectors-sql-applied", "inspectors-sql-missing-bindings",
      "inspectors-sql-result", "inspectors-sql-source", "inspectors-sql-long", "inspectors-sql-failed",
      "inspectors-sql-capture-limited", "inspectors-transaction-nesting", "inspectors-transaction-failure",
      "inspectors-cache-success", "inspectors-cache-failure", "inspectors-cache-long", "inspectors-cache-unavailable",
      "inspectors-redis-success", "inspectors-redis-failure", "inspectors-redis-long", "inspectors-redis-unavailable",
    ]);
    expect(nw223States.every(isNw223State)).toBe(true);
    expect(isNw223State("inspectors")).toBe(false);
  });

  it("projects each state only onto the owned query node", async () => {
    const adapter = new FixtureAdapter();
    const source = await adapter.inspector(queryNodeId, runId);
    const root = await adapter.inspector(`run_${runId}`, runId);

    for (const state of nw223States) {
      const inspector = nw223InspectorState(source, queryNodeId, state);
      expect(inspector.presentation?.type).toBe(state.split("-")[1] === "transaction" ? "transaction" : state.split("-")[1]);
      expect(inspector.source).toEqual({
        file: "app/Jobs/GenerateMonthlyInvoices.php",
        line: 42,
        href: "vscode://file//workspace/app/Jobs/GenerateMonthlyInvoices.php:42",
      });
      expect(nw223InspectorState(root, root.id, state)).toEqual(root);
    }
  });

  it("keeps unavailable, failure, long, and capture-limited evidence truthful", async () => {
    const adapter = new FixtureAdapter();
    const source = await adapter.inspector(queryNodeId, runId);
    const missing = nw223InspectorState(source, queryNodeId, "inspectors-sql-missing-bindings");
    const limited = nw223InspectorState(source, queryNodeId, "inspectors-sql-capture-limited");
    const failed = nw223InspectorState(source, queryNodeId, "inspectors-redis-failure");
    const cacheUnavailable = nw223InspectorState(source, queryNodeId, "inspectors-cache-unavailable");

    expect(missing.presentation?.type === "sql" && missing.presentation.sql.bindings).toBeNull();
    expect(limited.presentation?.type === "sql" && limited.presentation.sql.statement.isTruncated).toBe(true);
    expect(failed.presentation && "failure" in failed.presentation ? failed.presentation.failure : null).toEqual({ type: "RedisException", message: "Connection lost" });
    expect(cacheUnavailable.presentation?.type === "cache" && cacheUnavailable.presentation.cache.value).toBeNull();
    expect(cacheUnavailable.presentation?.type === "cache" && cacheUnavailable.presentation.cache.keyCaptured).toBe(false);
  });

  it("preserves exact recorded transaction, cache, and Redis evidence", () => {
    const transaction = nw223Presentation("inspectors-transaction-nesting");
    const cache = nw223Presentation("inspectors-cache-success");
    const redis = nw223Presentation("inspectors-redis-success");

    expect(transaction).toMatchObject({
      type: "transaction",
      timing: { durationUs: 125_000 },
      transaction: { connection: "testing", driver: "sqlite", depth: 2, outcome: "committed", queryTimeMs: 12.5 },
    });
    expect(cache).toMatchObject({
      type: "cache",
      timing: { durationUs: 125_000 },
      cache: { operation: "PUT", store: "redis", key: "customer:42", keyCaptured: true, outcome: "stored", ttlSeconds: 60, value: { value: { invoiceId: 42 } } },
    });
    expect(redis).toMatchObject({
      type: "redis",
      timing: { durationUs: 125_000 },
      redis: { command: "MSET", connection: "default", outcome: "completed", arguments: { value: ["invoice:42", "paid"] } },
    });
  });

  it("selects the same query identity in the trace", async () => {
    const detail = nw223TraceState(await new FixtureAdapter().trace(runId), "inspectors-transaction-nesting");
    const query = detail.trace.nodes.find(({ id }) => id === queryNodeId);

    expect(query).toMatchObject({ id: queryNodeId, kind: "query", label: "Database transaction", isError: false });
  });

  it("wires every state into paired Skyline and pinned Trigger fixtures", async () => {
    expect(matrix.ownedStates.runs).toEqual(expect.arrayContaining([...nw223States]));
    const fixture = await createReferenceFixture();

    for (const state of nw223States) {
      expect(fixture.loaders[`runs-${state}`]).toBeDefined();
      const resource = fixture.resources?.spanStates?.[state]?.[queryNodeId] as { type?: string; span?: { properties?: string } };
      expect(resource.type).toBe("span");
      expect(JSON.parse(resource.span?.properties ?? "null").type).toBe(state.split("-")[1] === "transaction" ? "transaction" : state.split("-")[1]);
    }
  });
});
