import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OperatingSystemContextProvider } from "../trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../trigger/components/primitives/ShortcutsProvider";
import RunDetailRoute from "../trigger/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route";
import { FixtureAdapter } from "./FixtureAdapter";
import { presentRunDetail } from "./RunDetailAdapter";

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";

beforeAll(() => {
  Object.assign(globalThis, {
    ResizeObserver: class ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      observe(_target: Element) {}
      disconnect() {}
      unobserve() {}
    },
  });
  Object.assign(HTMLElement.prototype, {
    scrollTo() {},
    getBoundingClientRect() {
      return { x: 0, y: 0, width: 800, height: 600, top: 0, right: 800, bottom: 600, left: 0, toJSON() {} };
    },
  });
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Run detail source primitives", () => {
  it("presents the selected Trace row label through the source Paragraph and SpanTitle seam", async () => {
    const { container, root } = await renderRoute();
    const row = container.querySelector(`[data-node-id="run_${runId}"]`);
    const sourceLabel = row?.querySelector("p > span.flex > span.truncate");

    expect(sourceLabel?.textContent).toBe("GenerateMonthlyInvoices");
    await act(async () => root.unmount());
  });

  it("closes the inspector through the source Button and ExitIcon seam", async () => {
    const { container, root, router } = await renderRoute();
    const inspector = container.querySelector('[aria-label="Run inspector"]');
    const closeButton = Array.from(inspector?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Esc",
    );

    expect(closeButton).toBeInstanceOf(HTMLButtonElement);
    expect(closeButton?.getAttribute("aria-label")).toBeNull();
    expect(closeButton?.querySelector("svg")).not.toBeNull();

    await act(async () => closeButton?.click());
    expect(router.state.location.search).toBe("");
    await act(async () => root.unmount());
  });
});

async function renderRoute() {
  const adapter = new FixtureAdapter();
  const data = presentRunDetail(await adapter.trace(runId), (nodeId) => adapter.inspector(nodeId, runId));
  const router = createMemoryRouter([
    { path: "/runs/:runId", loader: () => data, element: <RunDetailRoute /> },
  ], { initialEntries: [`/runs/${runId}?node=run_${runId}`] });
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider><RouterProvider router={router} /></ShortcutsProvider>
      </OperatingSystemContextProvider>,
    );
  });
  await vi.waitFor(() => expect(container.querySelector(`[data-node-id="run_${runId}"]`)).not.toBeNull());
  return { container, root, router };
}
