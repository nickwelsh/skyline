import { describe, expect, test } from "vitest";
import { getRunTimelineHelpText } from "./RunTimeline";

describe("RunTimeline", () => {
  test("retains the pinned event help text", () => {
    expect(["Triggered", "Dequeued", "Started", "Finished", "Expired"].map(getRunTimelineHelpText)).toEqual([
      "The run was triggered",
      "The run was dequeued from the queue",
      "The run began executing",
      "The run completed execution",
      "The run expired before it could be started",
    ]);
  });
});
