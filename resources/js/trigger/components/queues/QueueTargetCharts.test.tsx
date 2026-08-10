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

  it("keeps source chart geometry while presenting only recorded evidence", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    flushSync(() => root.render(<QueueTargetCharts
      activity={[{ timestamp: "2026-08-05T12:00:00Z", recordedRuns: 1, recordedRunCounts: { queued: 0, running: 0, retrying: 1, completed: 0, failed: 0 } }]}
      queueTime={[{ timestamp: "2026-08-05T12:00:00Z", sampleCount: 1, medianUs: 1_000, p95Us: 2_000, maximumUs: 3_000 }]}
    />));

    expect(container.querySelectorAll('[role="img"]')).toHaveLength(5);
    expect(container.querySelector('[role="img"][aria-label="Concurrency unavailable"]')?.textContent).toBe("Unavailable");
    expect(container.querySelector('[role="img"][aria-label="Throttled unavailable"]')?.textContent).toBe("Unavailable");
    expect(container.querySelector('button[aria-label="Concurrency information"]')?.getAttribute("title")).toBe("Concurrency is unavailable from captured Queue activity.");
    expect(container.querySelector('button[aria-label="Recorded queued activity information"]')?.getAttribute("title")).toBe("Recorded queued activity from captured Queue activity.");
    expect(container.querySelector('[role="img"][aria-label="Recorded queued activity chart"]')).not.toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Recorded Run status activity chart"]')).not.toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Scheduling delay chart"]')).not.toBeNull();
    for (const label of ["Queued", "Running", "Retrying", "Completed", "Failed", "p50", "p95", "Max"]) expect(container.textContent).toContain(label);
    expect(container.textContent).not.toMatch(/Queue depth|Backlog|Throughput|Started|Falling behind|p99/);
    expect(container.querySelector("[aria-label='Queue-target activity']")?.lastElementChild?.className).toContain("aspect-[2/1] sm:col-span-2 sm:aspect-[4/1]");
    expect(container.querySelectorAll("[data-skyline-capability-boundary]")).toHaveLength(2);
    expect([...container.querySelectorAll<HTMLElement>("[data-skyline-protected]")].map((element) => element.dataset.skylineProtected)).toEqual([
      "queue-detail-recorded-queued-activity",
      "queue-detail-activity",
      "queue-detail-scheduling-delay",
    ]);
    expect(Array.from(container.querySelectorAll("h3")).every((header) => header.querySelector(":scope > div > .min-h-6"))).toBe(true);

    flushSync(() => root.unmount());
  });
});
