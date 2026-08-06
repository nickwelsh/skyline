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

  it("normalizes semantic Attempt routes and panel persistence across history", () => {
    const triggerStorage = nativeStorage();
    const skylineStorage = adapterStorage();
    const trigger = [
      observation("initial", "/runs/run_1?span=attempt_run_1_1", "Copy", triggerStorage, []),
      observation("2:history-back", "/runs/run_1?span=attempt_run_1_1", "Copy", triggerStorage, []),
      observation("3:history-forward", "/runs/run_1?span=attempt_run_1_2", "Copy", triggerStorage, []),
      observation("4:reload", "/runs/run_1?span=attempt_run_1_2", "Copy", triggerStorage, []),
    ];
    const skyline = [
      observation("initial", "/skyline/runs/run_1?node=attempt_run_1_1", "Copy", skylineStorage, []),
      observation("2:history-back", "/skyline/runs/run_1?node=attempt_run_1_1", "Copy", skylineStorage, []),
      observation("3:history-forward", "/skyline/runs/run_1?node=attempt_run_1_2", "Copy", skylineStorage, []),
      observation("4:reload", "/skyline/runs/run_1?node=attempt_run_1_2", "Copy", skylineStorage, []),
    ];

    expect(collectFidelityDifferences({ triggerInteractions: trigger, skylineInteractions: skyline })).toEqual([]);
    const modalStorage = { ...skylineStorage, "exception-modal": "open" };
    expect(collectFidelityDifferences({ triggerInteractions: trigger, skylineInteractions: skyline.map((entry) => ({ ...entry, storage: modalStorage })) })).toEqual([
      expect.objectContaining({ axis: "persistence" }),
      expect.objectContaining({ axis: "persistence" }),
      expect.objectContaining({ axis: "persistence" }),
      expect.objectContaining({ axis: "persistence" }),
    ]);
  });
});

function observation(step: string, url: string, name: string, storage: Record<string, string>, visible: string[]) {
  return { step, url, activeElement: { tag: "BUTTON", role: "button", name }, visible, storage, clipboard: null };
}

function nativeStorage() {
  return {
    "skyline.ui-preferences.v1:/reference": JSON.stringify({ version: 1, theme: "classic", contrast: 70 }),
    "panel-run-parent-v3": JSON.stringify({ orientation: "horizontal", items: [
      { type: "panel", id: "run", currentValue: { type: "percent", value: "0.5877988458367683366" } },
      { type: "handle", id: "parent-handle" },
      { type: "panel", id: "inspector", currentValue: { type: "percent", value: "0.4122011541632316634" } },
    ] }),
    "panel-run-tree": JSON.stringify({ orientation: "horizontal", items: [
      { type: "panel", id: "tree", default: { type: "percent", value: "0.5" }, currentValue: { type: "pixel", value: "-1" } },
      { type: "handle", id: "tree-handle" },
      { type: "panel", id: "timeline", default: { type: "percent", value: "0.5" }, currentValue: { type: "pixel", value: "-1" } },
    ] }),
  };
}

function adapterStorage() {
  return {
    "skyline.ui-preferences.v1:/skyline": JSON.stringify({
      version: 1,
      theme: "classic",
      contrast: 70,
      sidebar: { isCollapsed: false },
      panels: {
        "panel-run-parent-v3": { orientation: "horizontal", itemIds: ["run", "inspector"], sizes: [0.5877988458367684, 0.41220115416323166] },
        "panel-run-tree": { orientation: "horizontal", itemIds: ["tree", "timeline"], sizes: [0.497887323943662, 0.502112676056338] },
      },
    }),
  };
}
