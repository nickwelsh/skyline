import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OperatingSystemContextProvider } from "../trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../trigger/components/primitives/ShortcutsProvider";
import ErrorsRoute from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.errors._index/route";
import { FixtureAdapter } from "./FixtureAdapter";
import { presentErrorGroups } from "./ErrorGroupsAdapter";

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

describe("Error-groups source route state", () => {
  it("carries the active period into Error-group links", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T12:02:00.000Z"));
    const adapter = new FixtureAdapter();
    const data = presentErrorGroups(await adapter.errorGroups({ period: "7d" }));
    const group = data.errorGroups[0];
    const router = createMemoryRouter([
      { path: "/errors", loader: () => data, element: <ErrorsRoute /> },
    ], { initialEntries: ["/errors?period=7d"] });
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider><RouterProvider router={router} /></ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    expect(container.querySelector(`a[href="${group.path}?period=7d"]`)).not.toBeNull();
    expect(container.querySelector(`a[href="${group.jobPath}?period=7d"]`)).toBeNull();

    expect(container.querySelector('[aria-label="Occurred time filter"]')?.getAttribute("role")).toBe("combobox");
    expect(container.querySelector('[aria-label="Tasks"]')?.getAttribute("role")).toBe("combobox");

    await act(async () => root.unmount());
  });
});
