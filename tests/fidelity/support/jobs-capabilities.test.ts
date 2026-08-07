import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import type { FidelityMatrix } from "../../../scripts/fidelity-oracle.mjs";
import matrix from "../matrix.json" with { type: "json" };
import { conditionJobDetailMarkers, conditionJobSegmentedControlMarker } from "../reference/capability-adapters";
import { jobsCapabilityDefinitions } from "./jobs-capabilities";

describe("NW-219 Job capability discovery definitions", () => {
  const definitions = jobsCapabilityDefinitions(matrix as unknown as FidelityMatrix);

  test("owns exact list omissions and unique surviving reflow boundaries", () => {
    const list = definitions[0];
    expect(list.id).toBe("jobs-list-source-definition");
    expect(list.captures).toHaveLength(16);
    expect(list.selectorPairs).toHaveLength(53);
    expect(list.selectorPairs.map(({ id }) => id).slice(0, 5)).toEqual(["task-type-filter", "type-header", "file-header", "type-row-1", "file-row-1"]);
    expect(list.selectorPairs.at(-1)?.id).toBe("file-row-25");
    expect(list.selectorPairs.every(({ skylineBoundary }) => skylineBoundary === true)).toBe(true);
    expect(new Set(list.selectorPairs.flatMap(({ triggerSelector, skylineSelector }) => [triggerSelector, skylineSelector])).size).toBe(106);
    expect(list.protectedSelectors).toHaveLength(106);
    expect(list.protectedSelectors?.map(({ id }) => id).slice(0, 6)).toEqual(["search", "pagination", "header-1", "header-2", "header-3", "header-4"]);
    expect(list.protectedSelectors?.filter(({ id }) => id.startsWith("row-")).every(({ allowBelowViewport, id }) => Number(id.split("-")[1]) >= 18 ? allowBelowViewport === true : allowBelowViewport === undefined)).toBe(true);
    expect(list.protectedSelectors?.filter(({ allowRightOfViewport }) => allowRightOfViewport).map(({ id }) => id)).toEqual([
      "pagination", "header-2", "header-3", "header-4",
      ...Array.from({ length: 25 }, (_, index) => index + 1).flatMap((row) => [2, 3, 4].map((column) => `row-${row}-column-${column}`)),
    ]);
    expect(list.selectorPairs.some(({ skylineSelector }) => /Task filters.*first-child/.test(skylineSelector))).toBe(false);
  });

  test("groups detail omissions around three source-faithful boundaries", () => {
    const detail = definitions[1];
    expect(detail.id).toBe("job-detail-unavailable-definition");
    expect(detail.captures).toHaveLength(19);
    expect(detail.selectorPairs.map(({ id }) => id)).toEqual(["source-definition", "queue-administration", "runtime-policy"]);
    expect(detail.selectorPairs.every(({ skylineBoundary }) => skylineBoundary === true)).toBe(true);
    expect(detail.protectedSelectors?.map(({ id }) => id)).toEqual(["identifier", "queue-links", "created"]);
    expect(detail.protectedSelectors?.every(({ allowRightOfViewport }) => allowRightOfViewport === true)).toBe(true);
    expect(detail.selectorPairs.every(({ skylineSelector }) => skylineSelector.includes("data-skyline-capability-boundary"))).toBe(true);
    expect(JSON.stringify(detail.selectorPairs)).not.toMatch(/test task|activity|pagination|recorded queue links/i);
  });

  test("pins source provenance and starts without inferred measurements", () => {
    for (const definition of definitions) {
      expect(definition.decision).toBe("NW-219");
      expect(definition.citations.every((citation) => citation.includes("ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0"))).toBe(true);
      expect(definition.measurements).toEqual({});
    }
  });

  test("instruments only exact pinned Trigger capability subtrees", () => {
    const vendor = resolve(import.meta.dirname, "../reference/vendor");
    const segmented = conditionJobSegmentedControlMarker(readFileSync(resolve(vendor, "components/primitives/SegmentedControl.tsx"), "utf8"));
    const detail = conditionJobDetailMarkers(readFileSync(resolve(vendor, "routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route.tsx"), "utf8"));
    expect(segmented).toContain('name === "task-type" ? "jobs-list-task-type-filter" : undefined');
    for (const marker of ["job-detail-source-definition", "job-detail-queue-administration", "job-detail-runtime-policy"]) expect(detail).toContain(`data-trigger-capability="${marker}"`);
  });
});
