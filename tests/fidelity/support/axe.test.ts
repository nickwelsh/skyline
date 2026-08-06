import { describe, expect, test } from "vitest";
import { additionalAxeViolations, normalizedPartitionLedger, normalizeAxeHtml, normalizeRadixTargets, normalizeTargetPath, pairedPresenterAxeDifferences, partitionAxeEvidence, resolveUniqueAxeTarget } from "./axe";

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

  test("preserves semantic iframe and shadow target segment order", () => {
    const path = normalizeTargetPath(["iframe#oracle", "#radix-\\:r9\\:"]);
    const nested = [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: path }] }];
    expect(normalizeRadixTargets(nested, ["radix-:r9:"])[0].nodes[0].target).toEqual(["iframe#oracle", "#radix-generated-0"]);
  });

  test("fails closed when a target segment is not unique", () => {
    document.body.innerHTML = '<div id="host"></div>';
    const shadow = document.querySelector("#host")!.attachShadow({ mode: "open" });
    shadow.innerHTML = "<button>one</button><button>two</button>";
    expect(() => resolveUniqueAxeTarget(document, ["#host", "button"])).toThrow(/unique/i);
    expect(resolveUniqueAxeTarget(document, ["#host", "button:first-child"])?.textContent).toBe("one");
  });

  test("matches cross-app nodes by semantic evidence instead of generated selector", () => {
    expect(additionalAxeViolations(violations, violations)).toEqual([]);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], html: "<button>App-owned attributes differ</button>" }] }])).toEqual([]);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: ["[role='dialog']"] }] }])).toEqual([]);
    expect(additionalAxeViolations(violations, [{ ...violations[0], impact: "critical" }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [...violations[0].nodes, violations[0].nodes[0]] }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], id: "aria-input-name" }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], tags: ["wcag2aa"] }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: ["[role='dialog']"], html: "<button>Changed</button>" }] }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], failureSummary: "Different failure" }] }])).toHaveLength(1);
    expect(additionalAxeViolations(violations, [{ ...violations[0], nodes: [{ ...violations[0].nodes[0], target: ["[role='dialog']"], failureSummary: "Different failure" }] }])).toHaveLength(1);
  });

  test("normalizes Axe node HTML whitespace without weakening markup identity", () => {
    expect(normalizeAxeHtml("  <div>\n  1 hr\n</div>  ")).toBe("<div> 1 hr </div>");
    expect(normalizeAxeHtml("<div>1 hr</div>")).not.toBe(normalizeAxeHtml("<span>1 hr</span>"));
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
    nodes: [{ target: [selector], html: `<button data-rule="${id}">Fix it</button>`, failureSummary: "Fix it" }],
  };
}
