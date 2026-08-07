import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { OperatingSystemContextProvider } from "~/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "~/components/primitives/ShortcutsProvider";
import { QueueTargetDetailPresenter, type QueueTargetDetailPresentation } from "./QueueTargetDetailPresenter";
import { QueueTargetsPresenter, type PresentedQueueTarget, type QueueTargetsPresentation } from "./QueueTargetsPresenter";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("Queue truthfulness", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("omits unsupported list administration while retaining recorded evidence", () => {
    const container = render(<QueueTargetsPresenter data={list()} loading={false} />);
    expect(container.querySelectorAll("[data-skyline-capability]")).toHaveLength(0);
    const boundaries = [...container.querySelectorAll<HTMLElement>("[data-skyline-capability-boundary]")];
    expect(boundaries).toHaveLength(16);
    expect(boundaries.every((boundary) => boundary.getAttribute("aria-hidden") === "true" && boundary.childElementCount === 0 && boundary.className.includes("absolute") && boundary.className.includes("pointer-events-none"))).toBe(true);
    expect(container.querySelectorAll("[data-skyline-protected]")).toHaveLength(6);
    expect(container.textContent).toContain("Recorded queued");
    expect(container.textContent).toContain("Recorded running");
    expect(container.textContent).toContain("redis / reports");
    for (const label of ["Recorded Runs", "Status counts", "Queue-time samples", "Median", "p95", "Max", "queued", "running", "retrying", "completed", "failed"]) expect(container.textContent).toContain(label);
    expect(container.textContent).not.toMatch(/Allocated|Environment limit|Limited by|Backlog|Pause\/resume/);
    expect(container.querySelectorAll('[data-skyline-anchor="queue-filter-controls"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-skyline-anchor="queue-period-filter"]')).toHaveLength(1);
    expect(container.querySelectorAll('label[data-skyline-extension="queue-connection-filter"]')).toHaveLength(1);
    expect(container.querySelector('label[data-skyline-extension="queue-connection-filter"] > select')?.hasAttribute("data-skyline-extension")).toBe(false);
  });

  it("does not reserve visible geometry for unavailable backlog data", () => {
    const container = render(<QueueTargetsPresenter data={list()} loading={false} />);
    expect(container.textContent).not.toMatch(/Env saturation|Backlog|Throttled/);
    expect(container.querySelector('[aria-label="Backlog unavailable"]')).toBeNull();
  });

  it("omits detail administration while retaining recorded activity and Queue time", () => {
    const container = render(<QueueTargetDetailPresenter data={detail()} loading={false} />);
    expect(container.querySelectorAll("[data-skyline-capability]")).toHaveLength(0);
    const boundaries = [...container.querySelectorAll<HTMLElement>("[data-skyline-capability-boundary]")];
    expect(boundaries.map((boundary) => boundary.dataset.skylineCapabilityBoundary)).toEqual([
      "queue-detail-concurrency",
      "queue-detail-concurrency-limit",
      "queue-detail-throttled",
    ]);
    expect(boundaries.every((boundary) => boundary.getAttribute("aria-hidden") === "true" && boundary.childElementCount === 0 && boundary.className.includes("absolute") && boundary.className.includes("pointer-events-none"))).toBe(true);
    expect(container.querySelectorAll("[data-skyline-protected]")).toHaveLength(9);
    for (const label of ["Recorded Runs", "Queue-time samples", "Median queue time", "Queue time p95", "Maximum queue time", "Recorded Run status counts"]) expect(container.textContent).toContain(label);
    for (const status of ["queued", "running", "retrying", "completed", "failed"]) expect(container.textContent).toContain(status);
    expect(container.textContent).not.toMatch(/Concurrency|Oldest wait|Queue depth|Throttled|No concurrency keys configured/);
    expect(container.querySelector('button[aria-label="Concurrency keys"]')).toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Recorded Run status activity chart"]')).not.toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Scheduling delay chart"]')).not.toBeNull();
    expect(container.querySelector("[aria-label='Queue-target activity']")?.lastElementChild?.className).toBe("relative h-52 sm:col-span-2");
    const extension = container.querySelector<HTMLElement>("[data-skyline-extension='queue-recorded-runs']")!;
    const period = container.querySelector<HTMLElement>("[data-skyline-anchor='queue-period-filter']")!;
    expect(extension.hasAttribute("data-skyline-capability")).toBe(false);
    expect(extension.nextElementSibling).toBe(period);
  });
});

function render(node: React.ReactNode) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  flushSync(() => root.render(
    <OperatingSystemContextProvider platform="mac">
      <ShortcutsProvider><MemoryRouter>{node}</MemoryRouter></ShortcutsProvider>
    </OperatingSystemContextProvider>,
  ));
  return container;
}

function list(): QueueTargetsPresentation {
  return {
    generatedAt: "2026-08-05T12:00:00Z",
    environment: { queued: 12, running: 14 },
    queueTargets: [target("reports"), target("billing"), target("default")],
    pagination: {}, connectionOptions: ["database", "redis", "sqs"], timeRanges: [], hasAnyQueueTargets: true, hasFilters: false,
  };
}

function detail(): QueueTargetDetailPresentation {
  return {
    generatedAt: "2026-08-05T12:00:00Z",
    queueTarget: target("default"),
    activity: [{ timestamp: "2026-08-05T12:00:00Z", recordedRuns: 1, recordedRunCounts: counts({ retrying: 1 }) }],
    queueTime: [{ timestamp: "2026-08-05T12:00:00Z", sampleCount: 1, medianUs: 1_000, p95Us: 2_000, maximumUs: 3_000 }],
    runs: [], pagination: {}, statusOptions: [], timeRanges: [], hasAnyRuns: false, hasFilters: false,
  };
}

function target(id: string): PresentedQueueTarget {
  const queued = id === "default" ? 1 : 0;
  return {
    id, path: `/queues/${id}`, connection: "redis", queue: id, destination: `redis / ${id}`,
    recordedRuns: String(4 + queued), recordedRunCounts: counts({ queued, running: 1, retrying: 1, completed: 1, failed: 1 }),
    queueTimeSampleCount: 3, medianQueueTime: "1ms", p95QueueTime: "2ms", maximumQueueTime: "3ms",
    firstObservedAt: null, lastObservedAt: null,
  };
}

function counts(overrides: Partial<Record<RunStatus, number>>): Record<RunStatus, number> {
  return { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0, ...overrides };
}
