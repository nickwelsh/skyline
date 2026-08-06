import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import matrix from "../matrix.json" with { type: "json" };
import { queueCapabilityDefinitions } from "./queue-capabilities";

describe("NW-221 Queue capability discovery definitions", () => {
  const definitions = queueCapabilityDefinitions(matrix as unknown as FidelityMatrix);

  test("locks exact semantic markers without broad chrome or Recorded Runs", () => {
    expect(definitions.map(({ id }) => id)).toEqual([
      "queue-root-capabilities",
      "queue-root-filtering-capabilities",
      "queue-detail-capabilities",
      "queue-detail-paginated-capabilities",
    ]);

    const pairs = definitions.flatMap(({ selectorPairs }) => selectorPairs);
    const uniquePairs = [...new Map(pairs.map((pair) => [pair.id, pair])).values()];
    expect(uniquePairs.map(({ id }) => id)).toEqual([
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
    for (const [index, definition] of definitions.entries()) for (const other of definitions.slice(index + 1)) {
      const reused = definition.selectorPairs.some(({ id }) => other.selectorPairs.some((pair) => pair.id === id));
      if (reused) expect(definition.captures.some((capture) => other.captures.includes(capture))).toBe(false);
    }
    expect(JSON.stringify(definitions)).not.toMatch(/information|shell|recorded.runs/i);
  });

  test("locks capture families around present capability nodes", () => {
    expect(definitions.map(({ captures }) => captures.length)).toEqual([16, 3, 16, 3]);
    expect(definitions[0].captures).not.toContain("queues-filtering@1440x960-classic");
    expect(definitions[1].captures).toContain("queues-filtering@1440x960-classic");
    expect(definitions[2].captures).not.toContain("queues-paginated-runs@1440x960-classic");
    expect(definitions[3].captures).toContain("queues-paginated-runs@1440x960-classic");
  });

  test("pins provenance and starts without inferred measurements", () => {
    for (const definition of definitions) {
      expect(definition.decision).toBe("NW-221");
      expect(definition.citations).not.toHaveLength(0);
      expect(definition.citations.every((citation) => citation.includes("ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0"))).toBe(true);
      expect(definition.measurements).toEqual({});
    }
  });

  test("allows the source and Skyline filtering navigations to settle", () => {
    const discovery = readFileSync(resolve(import.meta.dirname, "../queue-capability.discovery.ts"), "utf8");
    for (const phase of ["count", "visible", "options", "select", "value"]) expect(discovery).toContain(`filter:\${application}:${phase}`);
    expect(discovery).not.toContain("10_000");
  });
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
