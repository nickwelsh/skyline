import { describe, expect, test } from "vitest";
import { additionalAxeViolations, normalizedPartitionLedger, normalizeRadixTargets, pairedPresenterAxeDifferences, partitionAxeEvidence } from "./axe";

const violations = [
  violation("aria-dialog-name", "#radix-\\:r9\\:"),
  violation("empty-heading", "#radix-\\:ra\\:"),
  violation("color-contrast", "#radix-static > span"),
];

describe("Axe fidelity evidence", () => {
  test("normalizes generated Radix targets to DOM-order ordinals only", () => {
    expect(normalizeRadixTargets(violations, ["radix-:r9:", "radix-:ra:"])).toEqual([
      violation("aria-dialog-name", "#radix-generated-0"),
      violation("empty-heading", "#radix-generated-1"),
      violation("color-contrast", "#radix-static > span"),
    ]);
  });

  test("fails closed on Radix ID collisions and preserves reorder drift", () => {
    expect(() => normalizeRadixTargets(violations, ["radix-:r9:", "radix-:r9:"])).toThrow(/collision/i);
    expect(normalizeRadixTargets(violations, ["radix-:r9:", "radix-:ra:"]))
      .not.toEqual(normalizeRadixTargets(violations, ["radix-:ra:", "radix-:r9:"]));
  });

  test("requires identical rule, target structure, count, and impact", () => {
    expect(additionalAxeViolations(violations, violations)).toEqual([]);
    expect(additionalAxeViolations(violations, [{ ...violations[0], impact: "critical" }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [...violations[0].nodes, violations[0].nodes[0]] }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: ["[role='dialog']"] }] }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], id: "aria-input-name" }])).toHaveLength(1);
  });

  test("partitions nodes without weakening normalized evidence", () => {
    const mixed = [{ ...violations[0], nodes: [violations[0].nodes[0], { ...violations[0].nodes[0], target: ["main > span"] }] }];
    expect(partitionAxeEvidence(mixed, new Set([JSON.stringify(["main > span"])]))).toEqual({
      outside: [{ ...violations[0], nodes: [violations[0].nodes[0]] }],
      inside: [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: ["main > span"] }] }],
    });
  });

  test("requires exact outside rule and target signatures", () => {
    const trigger = { outside: violations, inside: [] };
    const expected = { trigger: normalizedPartitionLedger(trigger), skyline: normalizedPartitionLedger(trigger) };
    expect(pairedPresenterAxeDifferences(trigger, trigger, expected)).toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [{ ...violations[0], impact: "critical" }, ...violations.slice(1)], inside: [] }, expected)).not.toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [{ ...violations[0], tags: ["wcag2aa"] }, ...violations.slice(1)], inside: [] }, expected)).not.toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: ["main > span"] }] }, ...violations.slice(1)], inside: [] }, expected)).not.toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [...violations, violation("label", "label")], inside: [] }, expected)).not.toEqual([]);
    expect(pairedPresenterAxeDifferences({ outside: violations.slice(1), inside: [] }, trigger, expected)).not.toEqual([]);
  });

  test("allows only removal of existing inside targets", () => {
    const trigger = { outside: [], inside: [{ ...violations[0], nodes: [violations[0].nodes[0], { ...violations[0].nodes[0], target: ["main > span"] }] }] };
    expect(pairedPresenterAxeDifferences(trigger, { outside: [], inside: [{ ...violations[0], nodes: [violations[0].nodes[0]] }] })).toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [], inside: [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: ["aside > span"] }] }] })).not.toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [], inside: [{ ...violations[0], nodes: [...trigger.inside[0].nodes, trigger.inside[0].nodes[0]] }] })).not.toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [], inside: [{ ...violations[0], impact: "critical" }] })).not.toEqual([]);
    expect(pairedPresenterAxeDifferences(trigger, { outside: [], inside: [violation("label", "label")] })).not.toEqual([]);
  });
});

function violation(id: string, selector: string) {
  return {
    id,
    impact: "serious",
    tags: ["best-practice"],
    nodes: [{ target: [selector], failureSummary: "Fix it" }],
  };
}
