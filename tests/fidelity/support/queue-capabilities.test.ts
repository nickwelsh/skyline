import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import matrix from "../matrix.json" with { type: "json" };
import { queueCapabilityDefinitions } from "./queue-capabilities";

describe("NW-221 Queue capability discovery definitions", () => {
  const definitions = queueCapabilityDefinitions(matrix as unknown as FidelityMatrix);

  test("locks exact semantic markers without broad chrome or Recorded Runs", () => {
    expect(definitions.map(({ id }) => id)).toEqual([
      "queue-root-stats",
      "queue-target-database-reports",
      "queue-target-redis-billing",
      "queue-target-redis-default",
      "queue-target-redis-mail",
      "queue-target-sqs-imports",
      "queue-detail-concurrency",
      "queue-detail-throttled",
    ]);

    const pairs = definitions.flatMap(({ selectorPairs }) => selectorPairs);
    expect(new Set(pairs.map(({ id }) => id)).size).toBe(pairs.length);
    expect(new Set(pairs.flatMap(({ triggerSelector, skylineSelector }) => [triggerSelector, skylineSelector])).size).toBe(pairs.length * 2);
    expect(pairs.map(({ id }) => id)).toEqual([
      "queue-root-running",
      "queue-root-environment-limit",
      "queue-target-queue_3ac9ae5d-limit",
      "queue-target-queue_3ac9ae5d-limited-by",
      "queue-target-queue_3ac9ae5d-backlog",
      "queue-target-queue_3ac9ae5d-pause-resume",
      "queue-target-queue_c3203647-limit",
      "queue-target-queue_c3203647-limited-by",
      "queue-target-queue_c3203647-backlog",
      "queue-target-queue_c3203647-pause-resume",
      "queue-target-queue_3b6b7027-limit",
      "queue-target-queue_3b6b7027-limited-by",
      "queue-target-queue_3b6b7027-backlog",
      "queue-target-queue_3b6b7027-pause-resume",
      "queue-target-queue_3b6b7027-warning",
      "queue-target-queue_3b6b7027-health",
      "queue-target-queue_04e3fa05-limit",
      "queue-target-queue_04e3fa05-limited-by",
      "queue-target-queue_04e3fa05-backlog",
      "queue-target-queue_04e3fa05-pause-resume",
      "queue-target-queue_6f8f521a-limit",
      "queue-target-queue_6f8f521a-limited-by",
      "queue-target-queue_6f8f521a-backlog",
      "queue-target-queue_6f8f521a-pause-resume",
      "queue-detail-concurrency",
      "queue-detail-concurrency-limit",
      "queue-detail-throttled",
    ]);
    expect(JSON.stringify(definitions)).not.toMatch(/information|shell|recorded.runs/i);
  });

  test("locks capture families around present capability nodes", () => {
    expect(definitions.map(({ captures }) => captures.length)).toEqual([19, 19, 16, 16, 16, 16, 19, 16]);
    expect(definitions[1].captures).toContain("queues-filtering@1440x960-classic");
    expect(definitions[2].captures).not.toContain("queues-filtering@1440x960-classic");
    expect(definitions[6].captures).toContain("queues-paginated-runs@1440x960-classic");
    expect(definitions[7].captures).not.toContain("queues-paginated-runs@1440x960-classic");
  });

  test("pins provenance and starts without inferred measurements", () => {
    for (const definition of definitions) {
      expect(definition.decision).toBe("NW-221");
      expect(definition.citations).not.toHaveLength(0);
      expect(definition.citations.every((citation) => citation.includes("ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0"))).toBe(true);
      expect(definition.measurements).toEqual({});
    }
  });
});
