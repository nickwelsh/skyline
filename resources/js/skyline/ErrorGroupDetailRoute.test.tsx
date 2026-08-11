import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OperatingSystemContextProvider } from "../trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../trigger/components/primitives/ShortcutsProvider";
import ErrorGroupDetailRoute from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors.$fingerprint/route";
import { FixtureAdapter } from "./FixtureAdapter";
import { presentErrorGroupDetail } from "./ErrorGroupsAdapter";

beforeAll(() => {
  Object.assign(globalThis, {
    ResizeObserver: class ResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("Error-group detail source chrome", () => {
  it("shows source-friendly identity and seven-day occurrence filter without Versions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T12:02:00.000Z"));
    const adapter = new FixtureAdapter();
    const group = (await adapter.errorGroups()).errorGroups[0];
    const data = presentErrorGroupDetail(await adapter.errorGroup(group.id, { period: "7d" }));
    data.failedRuns.push(
      { ...data.failedRuns[0], id: "run_task_queue", queueTarget: "task/invoices", queue: { connection: "redis", name: "task/invoices", type: "task" } },
      { ...data.failedRuns[0], id: "run_unknown_queue", queueTarget: "—", queue: null },
    );
    const router = createMemoryRouter([
      { path: "/errors/:errorId", loader: () => data, element: <ErrorGroupDetailRoute /> },
    ], { initialEntries: [`/errors/${group.id}?period=7d`] });
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider><RouterProvider router={router} /></ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    expect(container.textContent).toContain(data.errorGroup.friendlyId);
    expect(Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("Errors"))?.getAttribute("href"))
      .toBe("/errors?period=7d");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Occurred time filter"]')?.textContent)
      .toContain("Occurred:7 days");
    expect(container.textContent).not.toContain("Versions");
    expect(Array.from(container.querySelectorAll("th"), (header) => header.textContent?.trim()))
      .toEqual(["ID", "Task", "Status", "Started", "Duration", "Queue"]);
    expect(Array.from(container.querySelectorAll("a")).find((link) => link.textContent?.includes("View all runs"))?.getAttribute("href"))
      .toBe("/runs");
    expect(container.textContent).not.toContain("Bulk replay");
    expect(container.textContent).not.toContain("Machine");
    expect(container.textContent).not.toContain("Queue target");
    expect(container.textContent).not.toContain("Trace");
    const queueCells = Array.from(container.querySelectorAll<HTMLTableCellElement>("tbody tr td:last-child"));
    const customQueue = queueCells[0].querySelector("button")!;
    expect(customQueue.textContent).toBe("billing");
    expect(customQueue.querySelector("svg")?.getAttribute("class")).toContain("text-purple-500");
    const taskQueue = queueCells.find((cell) => cell.querySelector("button")?.textContent === "task/invoices")!;
    expect(taskQueue.querySelector("svg")?.getAttribute("class")).toContain("text-blue-500");
    expect(queueCells.at(-1)?.textContent).toBe("–");
    expect(queueCells.some((cell) => cell.querySelector("a button"))).toBe(false);
    const sidebar = container.querySelector<HTMLElement>('aside[aria-label="Error group details"]')!;
    expect(sidebar.textContent).toContain(data.errorGroup.friendlyId);
    const jobLink = sidebar.querySelector<HTMLAnchorElement>(`a[href="${data.errorGroup.jobPath}"]`)!;
    expect(jobLink.textContent).toContain(data.errorGroup.jobType);
    expect(jobLink.querySelector("svg")?.getAttribute("class")).toContain("text-tasks");
    expect(jobLink.querySelector("[class*='clipboard']")).toBeNull();
    const idItem = [...sidebar.querySelectorAll<HTMLElement>("div.flex.flex-col.gap-0.text-sm")].find((item) => item.firstElementChild?.textContent === "ID")!;
    expect(idItem.lastElementChild?.className).toContain("truncate");
    expect(idItem.querySelector('[data-state="closed"]')?.textContent).toBe(data.errorGroup.friendlyId);
    expect(sidebar.querySelector(".tabular-nums")?.textContent).toBe("2");
    expect(sidebar.textContent).toContain("About 16 hours ago");
    expect(sidebar.querySelector('[aria-label="Code"]')).toBeNull();
    expect(sidebar.querySelector('[translate="no"]')).not.toBeNull();
    expect(sidebar.querySelector('[aria-label="Error"]')).toBeNull();

    await act(async () => root.unmount());
  });
});
