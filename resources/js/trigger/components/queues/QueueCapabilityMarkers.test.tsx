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

describe("Queue capability markers", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("marks only unavailable list values and exact per-target cells", () => {
    const container = render(<QueueTargetsPresenter data={list()} loading={false} />);
    const markers = [...container.querySelectorAll<HTMLElement>("[data-skyline-capability]")].map((node) => node.dataset.skylineCapability);

    expect(markers).toEqual([
      "queue-root-running",
      "queue-root-environment-limit",
      ...["reports", "billing", "default"].flatMap((id) => [
        ...(id === "default" ? [`queue-target-${id}-warning`] : []),
        `queue-target-${id}-limit`,
        `queue-target-${id}-limited-by`,
        ...(id === "default" ? [`queue-target-${id}-health`] : []),
        `queue-target-${id}-backlog`,
        `queue-target-${id}-pause-resume`,
      ]),
    ]);
    expect(new Set(markers).size).toBe(markers.length);
    expect(container.querySelectorAll('[data-skyline-anchor="queue-filter-controls"]')).toHaveLength(1);
    expect(container.querySelectorAll('select[data-skyline-extension="queue-connection-filter"]')).toHaveLength(1);
  });

  it("reserves source chart geometry for unavailable backlog data", () => {
    const container = render(<QueueTargetsPresenter data={list()} loading={false} />);
    const placeholder = container.querySelector<HTMLElement>('[data-skyline-capability="queue-target-reports-backlog"]')!;

    expect(placeholder.className).toBe("inline-flex h-[27px] w-[134px] items-center justify-end text-text-dimmed");
    expect(placeholder.getAttribute("aria-label")).toBe("Backlog unavailable");
    expect(placeholder.querySelector('[aria-hidden="true"]')?.textContent).toBe("–");
  });

  it("marks unavailable detail concurrency and chart series without owning Recorded Runs", () => {
    const container = render(<QueueTargetDetailPresenter data={detail()} loading={false} />);
    const markers = [...container.querySelectorAll<HTMLElement>("[data-skyline-capability]")].map((node) => node.dataset.skylineCapability);

    expect(markers).toEqual([
      "queue-detail-concurrency",
      "queue-detail-concurrency-limit",
      "queue-detail-throttled",
    ]);
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
    environment: { queued: 12, running: 14, allocated: null, limit: null },
    queueTargets: [target("reports", "Active"), target("billing", "Idle"), target("default", "Backlogged")],
    pagination: {}, connectionOptions: ["database", "redis", "sqs"], timeRanges: [], hasAnyQueueTargets: true, hasFilters: false,
  };
}

function detail(): QueueTargetDetailPresentation {
  return {
    generatedAt: "2026-08-05T12:00:00Z",
    queueTarget: target("default", "Backlogged"),
    stats: { running: 13, limit: null, queued: 12, peakQueued: 12, oldestWait: "0", worstWait: "0" },
    activity: [{ timestamp: "2026-08-05T12:00:00Z", recordedRuns: 1, recordedRunCounts: counts({ running: 1 }) }],
    queueTime: [{ timestamp: "2026-08-05T12:00:00Z", sampleCount: 1, medianUs: 1_000, p95Us: 2_000, maximumUs: 3_000 }],
    runs: [], pagination: {}, statusOptions: [], timeRanges: [], hasAnyRuns: false, hasFilters: false,
  };
}

function target(id: string, health: PresentedQueueTarget["health"]): PresentedQueueTarget {
  return {
    id, path: `/queues/${id}`, connection: "redis", queue: id, destination: `redis / ${id}`,
    state: health === "Idle" ? "Idle" : "Busy", queued: health === "Backlogged" ? 12 : 0,
    running: health === "Backlogged" ? 13 : health === "Active" ? 1 : 0, limit: null, limitedBy: null,
    health, delayP95: "–", backlog: [], recordedRuns: "1", recordedRunCounts: counts({}),
    queueTimeSampleCount: 0, medianQueueTime: "–", p95QueueTime: "–", maximumQueueTime: "–",
    firstObservedAt: null, lastObservedAt: null,
  };
}

function counts(overrides: Partial<Record<RunStatus, number>>): Record<RunStatus, number> {
  return { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0, ...overrides };
}
