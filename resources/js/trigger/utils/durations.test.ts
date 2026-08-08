import { describe, expect, it } from "vitest";
import { formatDurationMilliseconds } from "./durations";

describe("pinned duration formatting", () => {
  it.each([
    [0, "0ms"], [59_999, "59.9s"], [60_000, "1m"], [60_001, "1m"],
    [3_600_000, "1h"], [86_400_000, "1d"], [88_200_000, "1d, 30m"],
  ])("formats %dms", (milliseconds, expected) => {
    expect(formatDurationMilliseconds(milliseconds, { style: "short" })).toBe(expected);
  });
});
