import { describe, expect, test } from "vitest";
import { FixtureAdapter } from "../../../resources/js/skyline/FixtureAdapter";
import { nw223InspectorState } from "./nw223";
import { triggerRunInspectorResources } from "./reference-run-inspectors";

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";
const failedAttemptId = `attempt_${runId}_1`;
const queryId = "span_4f24adb545b26d31";

describe("pinned Trigger Run inspector resources", () => {
  test("maps captured failed Attempt evidence into the original TaskRunError seam", async () => {
    const { detail, inspectors } = await fixture();
    const resources = triggerRunInspectorResources(detail, inspectors, baseRunResource(detail));
    const failed = resources[failedAttemptId] as any;

    expect(failed).toMatchObject({
      type: "run",
      run: {
        friendlyId: runId,
        status: "COMPLETED_WITH_ERRORS",
        isError: true,
        error: {
          type: "BUILT_IN_ERROR",
          name: "Illuminate\\Database\\DeadlockException",
          message: "Deadlock found when trying to get lock; retry transaction",
          stackTrace: expect.stringContaining("app/Jobs/GenerateMonthlyInvoices.php:58"),
        },
      },
    });
    expect(failed.run.error.stackTrace).toContain("vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php:124");
    expect(JSON.stringify(failed)).not.toMatch(/\/workspace|\/Users\//);
  });

  test("does not invent Run Context and keeps the selected root label", async () => {
    const { detail, inspectors } = await fixture();
    const resources = triggerRunInspectorResources(detail, inspectors, baseRunResource(detail));
    const root = resources[`run_${runId}`] as any;

    expect(root.run.taskIdentifier).toBe("GenerateMonthlyInvoices");
    expect(root.run).not.toHaveProperty("context");
  });

  test("maps query nodes into pinned span-detail resources", async () => {
    const { detail, inspectors } = await fixture();
    const resources = triggerRunInspectorResources(detail, inspectors, baseRunResource(detail));

    expect(resources[queryId]).toMatchObject({
      type: "span",
      span: {
        spanId: queryId,
        message: "insert into `invoices` (`customer_id`, `total`, `created_at`) values (?, ?, ?)",
        isError: false,
        entity: null,
        triggeredRuns: [],
      },
    });
  });

  test("maps raw metadata into the pinned Properties slot for operation spans", async () => {
    const { detail, inspectors } = await fixture();
    const operation = nw223InspectorState(inspectors[queryId], queryId, "inspectors-sql-parameterized");
    const resources = triggerRunInspectorResources(detail, { ...inspectors, [queryId]: operation }, baseRunResource(detail));
    const properties = (resources[queryId] as any).span.properties;

    expect(properties).toBe(JSON.stringify(operation.metadata.value, null, 2));
    expect(properties).toContain('"db.namespace": "testing"');
    expect(properties).not.toContain('"type": "sql"');
  });
});

async function fixture() {
  const adapter = new FixtureAdapter();
  const detail = await adapter.trace(runId);
  const inspectors = Object.fromEntries(await Promise.all(detail.trace.nodes.map(async (node) => [
    node.id,
    await adapter.inspector(node.id, runId),
  ])));
  return { detail, inspectors };
}

function baseRunResource(detail: Awaited<ReturnType<FixtureAdapter["trace"]>>) {
  return {
    type: "run" as const,
    run: {
      friendlyId: detail.run.id,
      taskIdentifier: "invented-label",
      context: "{}",
      status: "COMPLETED_SUCCESSFULLY",
      isFinished: true,
      isRunning: false,
      isError: false,
      createdAt: detail.run.triggeredAt,
      startedAt: detail.run.startedAt,
      executedAt: detail.run.startedAt,
      updatedAt: detail.run.finishedAt,
      completedAt: detail.run.finishedAt,
      error: undefined,
    },
    queueMetrics: null,
  };
}
