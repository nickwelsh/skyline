import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperatingSystemContextProvider } from "../trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../trigger/components/primitives/ShortcutsProvider";
import { ErrorBoundary as EnvironmentErrorBoundary } from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam/route";
import { fixtureCapabilities, FixtureAdapter } from "./FixtureAdapter";
import { SkylineApiError } from "./HttpAdapter";
import { createSkylineRouter } from "./router";
import type { RunsPageDto } from "./dto";
import { createUiPreferencesAdapter } from "./UiPreferencesAdapter";
import { UiPreferencesProvider } from "./UiPreferencesProvider";

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe("Environment route error boundary", () => {
  it("owns every environment list and detail loader", () => {
    window.history.replaceState({}, "", "/");
    const router = createSkylineRouter({
      schemaVersion: 1,
      basePath: "/",
      applicationName: "Skyline",
      environmentLabel: "local",
      capabilities: fixtureCapabilities,
    }, new FixtureAdapter());
    const environment = router.routes[0]?.children?.[0];

    const errorElement = environment && "errorElement" in environment ? environment.errorElement : undefined;
    expect(errorElement).toEqual(expect.objectContaining({ type: EnvironmentErrorBoundary }));
    expect(environment?.children?.map((route) => route.path ?? "index")).toEqual([
      "index", "jobs", "jobs/:jobId", "runs", "runs/:runId", "queues", "queues/:queueId", "errors", "errors/:errorId", "logs",
    ]);
    expect(environment?.children?.every((route) => !("errorElement" in route) || route.errorElement === undefined)).toBe(true);

    router.dispose();
  });

  it.each([
    [404, "missing", "404: Page not found", "Not Found"],
    [500, "Deterministic telemetry error.", "Error", "Deterministic telemetry error."],
  ])("presents adapter status %i through the environment boundary", async (status, adapterMessage, title, message) => {
    window.history.replaceState({}, "", "/runs");
    const preferences = createUiPreferencesAdapter({ basePath: "/" });
    const router = createSkylineRouter({
      schemaVersion: 1,
      basePath: "/",
      applicationName: "Skyline",
      environmentLabel: "local",
      capabilities: fixtureCapabilities,
    }, new FailingRunsAdapter(new SkylineApiError(status, "fixture_error", adapterMessage)), preferences);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <UiPreferencesProvider adapter={preferences}>
            <RouterProvider router={router} />
          </UiPreferencesProvider>
        </ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    await vi.waitFor(() => expect(container.querySelector(".fixed.inset-0")?.textContent).toContain(title));
    expect(container.querySelector(".fixed.inset-0")?.textContent).toContain(message);

    router.dispose();
    await act(async () => root.unmount());
  });

  it.each([
    [new Error("Deterministic telemetry error."), "Error", "Deterministic telemetry error."],
    [new Response("Deterministic telemetry evidence was not found.", { status: 404, statusText: "Not Found" }), "404: Page not found", "Not Found"],
  ])("uses the shared source presenter for %s", async (thrown, title, message) => {
    const router = createMemoryRouter([{
      path: "/",
      element: <Outlet />,
      errorElement: <EnvironmentErrorBoundary />,
      loader: () => { throw thrown; },
    }]);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <RouterProvider router={router} />
        </ShortcutsProvider>
      </OperatingSystemContextProvider>,
    ));

    const presenter = container.querySelector(".fixed.inset-0");
    expect(presenter?.textContent).toContain(title);
    expect(presenter?.textContent).toContain(message);
    expect(presenter?.querySelector("a")?.textContent).toContain("Go to homepage");
    expect(presenter?.querySelector("a")?.getAttribute("href")).toBe("/");

    await act(async () => root.unmount());
  });
});

class FailingRunsAdapter extends FixtureAdapter {
  constructor(private readonly failure: Error) {
    super();
  }

  override async runs(): Promise<RunsPageDto> {
    throw this.failure;
  }
}
