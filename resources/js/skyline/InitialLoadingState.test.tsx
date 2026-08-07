import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { OperatingSystemContextProvider } from "../trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../trigger/components/primitives/ShortcutsProvider";
import { FixtureAdapter, fixtureCapabilities } from "./FixtureAdapter";
import { InitialLoadingState, initialLoadingRoute } from "./InitialLoadingState";
import { createSkylineRouter } from "./router";
import { createUiPreferencesAdapter } from "./UiPreferencesAdapter";
import { UiPreferencesProvider } from "./UiPreferencesProvider";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe("InitialLoadingState", () => {
  it.each([
    ["/skyline/runs", "/skyline", { label: "Runs", title: "Runs" }],
    ["/skyline/runs/run-01", "/skyline", { label: "Run", title: "run-01", back: { to: "/runs", text: "Runs" } }],
    ["/runs", "/", { label: "Runs", title: "Runs" }],
    ["/queues/redis%3Adefault", "/", { label: "Queue target", title: "redis:default", back: { to: "/queues", text: "Queues" } }],
  ] as const)("describes %s within %s", (pathname, basePath, expected) => {
    expect(initialLoadingRoute(pathname, basePath)).toEqual(expected);
  });

  it("keeps the source shell and direct-detail composition visible", async () => {
    window.history.replaceState({}, "", "/skyline/runs/run-01");
    const bootstrap = {
      schemaVersion: 1 as const,
      basePath: "/skyline",
      applicationName: "Skyline",
      environmentLabel: "local",
      capabilities: fixtureCapabilities,
    };
    const preferences = createUiPreferencesAdapter({ basePath: bootstrap.basePath });
    const adapter = new FixtureAdapter();
    adapter.trace = () => new Promise(() => {});
    const router = createSkylineRouter(bootstrap, adapter, preferences);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="linux">
        <ShortcutsProvider>
          <UiPreferencesProvider adapter={preferences}>
            <RouterProvider router={router} fallbackElement={<InitialLoadingState bootstrap={bootstrap} />} />
          </UiPreferencesProvider>
        </ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    expect(container.querySelector('[data-testid="side-menu"]')).not.toBeNull();
    expect(container.querySelector("main")?.getAttribute("class")).toContain("overflow-hidden");
    expect(container.querySelector('[aria-label="Loading Run"]')).not.toBeNull();
    expect(container.querySelector("main h2")?.textContent).toBe("run-01");
    expect(container.querySelector(".min-w-\\[1024px\\]")).not.toBeNull();

    router.dispose();
    await act(async () => root.unmount());
  });
});
