import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { OperatingSystemContextProvider } from "../trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../trigger/components/primitives/ShortcutsProvider";
import JobsRoute from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route";
import JobDetailRoute from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.tasks.standard.$taskParam/route";
import { FixtureAdapter } from "./FixtureAdapter";
import { presentJobDetail, presentJobs } from "./JobsAdapter";

beforeAll(() => {
  Object.assign(globalThis, {
    ResizeObserver: class ResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  });
});

afterEach(() => document.body.replaceChildren());

describe("Job detail source chrome", () => {
  it("omits unobserved task-definition claims", async () => {
    const adapter = new FixtureAdapter();
    const page = await adapter.jobs();
    const data = presentJobDetail(await adapter.job(page.jobs[0].id));
    data.queueTargets = [
      { id: "queue_redis", connection: "redis", queue: "default", runCount: 2, path: "/queues/queue_redis" },
      { id: "queue_database", connection: "database", queue: "default", runCount: 1, path: "/queues/queue_database" },
    ];
    const router = createMemoryRouter([
      { path: "/jobs/:jobId", loader: () => data, element: <JobDetailRoute /> },
    ], { initialEntries: [`/jobs/${data.job.id}`] });
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider><RouterProvider router={router} /></ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    const detail = container.querySelector<HTMLElement>('aside[aria-label="Job details"]')!;
    expect(detail.textContent).toContain("Identifier");
    expect(detail.textContent).toContain("Queue");
    expect(detail.textContent).toContain("Created");
    expect(detail.querySelector('a[href="/queues/queue_redis"]')?.textContent).toBe("redis / default");
    expect(detail.querySelector('a[href="/queues/queue_database"]')?.textContent).toBe("database / default");
    const boundaries = Array.from(detail.querySelectorAll<HTMLElement>("[data-skyline-capability-boundary]"));
    expect(boundaries.map((boundary) => boundary.dataset.skylineCapabilityBoundary)).toEqual([
      "job-detail-source-definition",
      "job-detail-queue-administration",
      "job-detail-runtime-policy",
    ]);
    expect(boundaries.every((boundary) => boundary.getAttribute("aria-hidden") === "true" && boundary.className.includes("absolute") && boundary.className.includes("pointer-events-none") && boundary.childElementCount === 0)).toBe(true);
    expect(boundaries.every((boundary) => !boundary.querySelector("a"))).toBe(true);
    expect(detail.querySelector('[data-skyline-protected="job-detail-queue-links"]')?.querySelectorAll("a")).toHaveLength(2);
    expect(detail.textContent).not.toContain("File path");
    expect(detail.textContent).not.toContain("Type");
    expect(detail.textContent).not.toContain("Version");
    expect(detail.textContent).not.toContain("Concurrency");
    expect(detail.textContent).not.toContain("Machine");
    expect(detail.textContent).not.toContain("Max duration");
    expect(detail.textContent).not.toContain("TTL");
    expect(detail.textContent).not.toContain("Retry");
    expect(detail.textContent).not.toContain("Payload schema");

    await act(async () => root.unmount());
  });
});

describe("Jobs list source chrome", () => {
  it("uses Laravel Job language, identifiers, and an all-time list", async () => {
    const adapter = new FixtureAdapter();
    const data = {
      ...presentJobs(await adapter.jobs()),
      showJobGuidance: false,
      onJobGuidanceChange: () => {},
    };
    data.jobs[0].activity = [{
      timestamp: "2026-08-05T11:00:00Z",
      total: 2,
      statusCounts: { queued: 0, running: 1, retrying: 0, completed: 0, failed: 1 },
    }];
    const router = createMemoryRouter([
      { path: "/jobs", loader: () => data, element: <JobsRoute /> },
    ], { initialEntries: ["/jobs"] });
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider><RouterProvider router={router} /></ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    expect(container.querySelector("h2")?.textContent).toBe("Jobs");
    expect(Array.from(container.querySelectorAll("th"), (header) => header.textContent?.trim()))
      .toEqual(["ID", "Identifier", "Running", "Activity (24h)", "Go to page"]);
    expect(container.querySelector('[role="group"][aria-label="Task type"]')).toBeNull();
    const boundaries = Array.from(container.querySelectorAll<HTMLElement>("[data-skyline-capability-boundary]"));
    expect(boundaries).toHaveLength(53);
    expect(boundaries.every((boundary) => boundary.getAttribute("aria-hidden") === "true" && boundary.className.includes("absolute") && boundary.className.includes("pointer-events-none") && boundary.childElementCount === 0)).toBe(true);
    expect(boundaries.every((boundary) => !boundary.querySelector("input, button, a, svg"))).toBe(true);
    expect(container.querySelector('[data-skyline-protected="jobs-list-search"]')?.querySelector('input[placeholder="Search jobs…"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Time range"]')).toBeNull();
    expect(container.querySelector("tbody tr td:nth-child(1)")?.textContent).toBe(data.jobs[0].displayName);
    expect(container.querySelector("tbody tr td:nth-child(2)")?.textContent).toBe(data.jobs[0].identifier);
    expect(container.querySelector('[data-skyline-protected="jobs-list-pagination"]')?.querySelectorAll("a")).toHaveLength(1);
    expect(container.textContent).not.toContain("Standard");
    expect(container.textContent).not.toContain("New task…");
    expect(container.querySelector('[data-status="running"]')?.getAttribute("fill"))
      .toBe("var(--color-run-executing)");
    expect(container.querySelector('[data-status="failed"]')?.getAttribute("fill"))
      .toBe("var(--color-run-completed-with-errors)");

    await act(async () => root.unmount());
  });
});
