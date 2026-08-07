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
    expect(container.textContent).toContain("Recorded queued");
    expect(container.textContent).toContain("Recorded running");
    expect(container.textContent).toContain("redis / reports");
    expect(container.textContent).toContain("Queued");
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
    expect(container.textContent).toContain("Recorded queued");
    expect(container.textContent).toContain("Recorded running");
    expect(container.textContent).toContain("Maximum queue time");
    expect(container.textContent).not.toMatch(/Concurrency|Oldest wait|Queue depth|Throttled|No concurrency keys configured/);
    expect(container.querySelector('button[aria-label="Concurrency keys"]')).toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Throughput chart"]')).not.toBeNull();
    expect(container.querySelector('[role="img"][aria-label="Scheduling delay chart"]')).not.toBeNull();
    expect(container.querySelector("[aria-label='Queue-target activity']")?.lastElementChild?.className).toBe("h-52 sm:col-span-2");
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
    queueTargets: [target("reports", "Active"), target("billing", "Idle"), target("default", "Queued")],
    pagination: {}, connectionOptions: ["database", "redis", "sqs"], timeRanges: [], hasAnyQueueTargets: true, hasFilters: false,
  };
}

function detail(): QueueTargetDetailPresentation {
  return {
    generatedAt: "2026-08-05T12:00:00Z",
    queueTarget: target("default", "Queued"),
    stats: { running: 13, queued: 12, peakQueued: 12, maximumQueueTime: "3ms" },
    activity: [{ timestamp: "2026-08-05T12:00:00Z", recordedRuns: 1, recordedRunCounts: counts({ running: 1 }) }],
    queueTime: [{ timestamp: "2026-08-05T12:00:00Z", sampleCount: 1, medianUs: 1_000, p95Us: 2_000, maximumUs: 3_000 }],
    runs: [], pagination: {}, statusOptions: [], timeRanges: [], hasAnyRuns: false, hasFilters: false,
  };
}

function target(id: string, health: PresentedQueueTarget["health"]): PresentedQueueTarget {
  return {
    id, path: `/queues/${id}`, connection: "redis", queue: id, destination: `redis / ${id}`,
    queued: health === "Queued" ? 12 : 0,
    running: health === "Queued" ? 13 : health === "Active" ? 1 : 0,
    health, delayP95: "–", recordedRuns: "1", recordedRunCounts: counts({}),
    queueTimeSampleCount: 0, medianQueueTime: "–", p95QueueTime: "–", maximumQueueTime: "–",
    firstObservedAt: null, lastObservedAt: null,
  };
}

function counts(overrides: Partial<Record<RunStatus, number>>): Record<RunStatus, number> {
  return { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0, ...overrides };
}
