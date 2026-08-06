import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
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

afterEach(() => document.body.replaceChildren());

describe("Error-group detail source chrome", () => {
  it("shows source-friendly identity and seven-day occurrence filter without Versions", async () => {
    const adapter = new FixtureAdapter();
    const group = (await adapter.errorGroups()).errorGroups[0];
    const data = presentErrorGroupDetail(await adapter.errorGroup(group.id, { period: "7d" }));
    const router = createMemoryRouter([
      { path: "/errors/:errorId", loader: () => data, element: <ErrorGroupDetailRoute /> },
    ], { initialEntries: [`/errors/${group.id}`] });
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider><RouterProvider router={router} /></ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    expect(container.textContent).toContain(data.errorGroup.friendlyId);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Occurred range"]')?.textContent)
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

    await act(async () => root.unmount());
  });
});
