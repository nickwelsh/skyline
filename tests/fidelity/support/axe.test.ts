import { describe, expect, test } from "vitest";
import { additionalAxeViolations, normalizeRadixTargets } from "./axe";

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
});

function violation(id: string, selector: string) {
  return {
    id,
    impact: "serious",
    tags: ["best-practice"],
    nodes: [{ target: [selector], failureSummary: "Fix it" }],
  };
}
