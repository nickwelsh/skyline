import { describe, expect, it } from "vitest";
import { queueMetricSeriesData } from "./QueueMetricSeries";

describe("queueMetricSeriesData", () => {
  it("adapts captured timestamps without inventing missing values", () => {
    expect(queueMetricSeriesData([
      { timestamp: "2026-08-05T12:00:00.000Z", running: 2, limit: null },
      { timestamp: "not-a-date", running: 3, limit: null },
    ])).toEqual([{
      bucket: Date.parse("2026-08-05T12:00:00.000Z"),
      running: 2,
      limit: null,
    }]);
  });
});
