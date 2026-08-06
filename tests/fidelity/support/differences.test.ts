import { describe, expect, it } from "vitest";
import { assertNoFidelityDifferences, collectFidelityDifferences } from "./differences";

describe("fidelity difference aggregation", () => {
  it("reports every failed evidence axis before throwing", () => {
    const differences = collectFidelityDifferences({
      differingPixels: 12,
      triggerTree: { role: "main", name: "Trigger" },
      skylineTree: { role: "main", name: "Skyline" },
      additionalAxeViolations: [{ id: "label" }],
      triggerInteractions: [
        observation("initial", "/runs", "Search", { theme: "dark" }, ["dialog"]),
        observation("2:history", "/jobs", "Tasks", { theme: "dark" }, []),
      ],
      skylineInteractions: [
        observation("initial", "/skyline/jobs", "Filter", { theme: "light" }, []),
        observation("2:history", "/runs", "Runs", { theme: "light" }, []),
      ],
    });

    expect(new Set(differences.map(({ axis }) => axis))).toEqual(new Set(["pixels", "accessibility", "axe", "url", "history", "focus", "persistence", "action"]));
    expect(() => assertNoFidelityDifferences(differences)).toThrow(/\[pixels\][\s\S]*\[accessibility\][\s\S]*\[axe\][\s\S]*\[url\][\s\S]*\[focus\][\s\S]*\[persistence\][\s\S]*\[action\][\s\S]*\[history\]/);
  });
});

function observation(step: string, url: string, name: string, storage: Record<string, string>, visible: string[]) {
  return { step, url, activeElement: { tag: "BUTTON", role: "button", name }, visible, storage, clipboard: null };
}
