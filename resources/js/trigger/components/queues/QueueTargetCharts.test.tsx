import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { QueueTargetCharts } from "./QueueTargetCharts";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("QueueTargetCharts", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("shows only recorded activity and queue-time history", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(<QueueTargetCharts
      activity={[{ timestamp: "2026-08-05T12:00:00Z", recordedRuns: 1, recordedRunCounts: { queued: 0, running: 0, retrying: 0, completed: 1, failed: 0 } }]}
      queueTime={[{ timestamp: "2026-08-05T12:00:00Z", sampleCount: 1, medianUs: 1_000, p95Us: 2_000, maximumUs: 3_000 }]}
    />));

    expect(container.querySelectorAll('[role="img"]')).toHaveLength(2);
    expect(container.querySelector('[role="img"][aria-label="Throughput chart"]')).not.toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Scheduling delay chart"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/Concurrency|Queue depth|Throttled|Backlog/);
    expect(container.querySelector("[aria-label='Queue-target activity']")?.lastElementChild?.className).toBe("h-52 sm:col-span-2");
    expect(Array.from(container.querySelectorAll("h3")).every((header) => header.querySelector(":scope > div > .min-h-6"))).toBe(true);

    flushSync(() => root.unmount());
  });
});
