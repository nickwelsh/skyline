import { describe, expect, test } from "vitest";
import { expandedDialogCounts, expectedExpandedDialogTranscript } from "./dialog-lifecycle";

describe("expanded dialog lifecycle", () => {
  test("preserves the source-observed dialog baseline", () => {
    expect(expandedDialogCounts(0)).toEqual({ open: 1, closed: 0 });
    expect(expandedDialogCounts(1)).toEqual({ open: 2, closed: 1 });
  });

  test("fails closed on invalid baselines", () => {
    expect(() => expandedDialogCounts(-1)).toThrow(/baseline/i);
    expect(() => expandedDialogCounts(0.5)).toThrow(/baseline/i);
  });

  test("locks source and Skyline inspector-close transcripts", () => {
    expect(expectedExpandedDialogTranscript("trigger")).toEqual({
      dialogCountBefore: 0,
      dialogCountAfterEscape: 0,
      expand: { connected: false, focused: false },
      presenterCount: 0,
      selectedAnchorCount: 1,
      active: { tag: "body", role: "", name: "" },
    });
    expect(expectedExpandedDialogTranscript("skyline")).toEqual({
      dialogCountBefore: 0,
      dialogCountAfterEscape: 0,
      expand: { connected: false, focused: false },
      presenterCount: 0,
      selectedAnchorCount: 1,
      active: { tag: "body", role: "", name: "" },
    });
  });
});
