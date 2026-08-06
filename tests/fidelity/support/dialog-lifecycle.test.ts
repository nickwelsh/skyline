import { describe, expect, test } from "vitest";
import { expandedDialogCounts } from "./dialog-lifecycle";

describe("expanded dialog lifecycle", () => {
  test("preserves the source-observed dialog baseline", () => {
    expect(expandedDialogCounts(0)).toEqual({ open: 1, closed: 0 });
    expect(expandedDialogCounts(1)).toEqual({ open: 2, closed: 1 });
  });

  test("fails closed on invalid baselines", () => {
    expect(() => expandedDialogCounts(-1)).toThrow(/baseline/i);
    expect(() => expandedDialogCounts(0.5)).toThrow(/baseline/i);
  });
});
