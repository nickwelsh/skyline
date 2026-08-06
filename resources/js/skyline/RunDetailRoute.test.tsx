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
  it("mounts the trace splitter before the delayed inspector opens", async () => {
    const adapter = new FixtureAdapter();
    const inspector = await adapter.inspector(`run_${runId}`, runId);
    let resolveInspector!: (value: typeof inspector) => void;
    const pendingInspector = new Promise<typeof inspector>((resolve) => { resolveInspector = resolve; });
    const loadInspector = vi.fn(() => pendingInspector);
    const collapsedStates: string[] = [];
    const observer = new MutationObserver(() => {
      const panel = document.querySelector('[data-splitter-id="inspector"]');
      const group = document.querySelector('[data-group-id="panel-run-tree"]');
      if (panel && group) collapsedStates.push(panel.getAttribute("data-collapsed") ?? "missing");
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-collapsed"] });

    const { container, root } = await renderRoute({ initialEntry: `/runs/${runId}`, loadInspector });
    const treeGroup = container.querySelector('[data-group-id="panel-run-tree"]');

    expect(collapsedStates[0]).toBe("true");
    await vi.waitFor(() => expect(loadInspector).toHaveBeenCalledWith(`run_${runId}`, expect.any(AbortSignal)));
    expect(container.querySelector('[data-group-id="panel-run-tree"]')).toBe(treeGroup);

    await act(async () => resolveInspector(inspector));
    await vi.waitFor(() => expect(container.querySelector('[aria-label="Run inspector"]')).not.toBeNull());
    expect(container.querySelector('[data-group-id="panel-run-tree"]')).toBe(treeGroup);

    observer.disconnect();
    await act(async () => root.unmount());
  });

  it("presents the selected Trace row label through the source Paragraph and SpanTitle seam", async () => {
    const { container, root } = await renderRoute();
    const row = container.querySelector(`[data-node-id="run_${runId}"]`);
    const sourceLabel = row?.querySelector("p > span.flex > span.truncate");

    expect(sourceLabel?.textContent).toBe("GenerateMonthlyInvoices");
    await act(async () => root.unmount());
  });

  it("preserves the pinned Trace row structure and indentation", async () => {
    const { container, root } = await renderRoute();
    const treeItem = container.querySelector('[data-index="5"][role="treeitem"]')!;
    const row = treeItem.firstElementChild!;
    const indentation = row.children[0]!;
    const content = row.children[1]!;

    expect(row.tagName).toBe("DIV");
    expect(row.className).toContain("bg-transparent");
    expect(indentation.tagName).toBe("DIV");
    expect(indentation.className).toBe("flex h-8 items-center");
    expect(Array.from(indentation.children).map((child) => [child.tagName, child.className])).toEqual([
      ["DIV", "h-8 w-2 border-r border-grid-bright"],
      ["DIV", "h-8 w-2 border-r border-grid-bright"],
      ["DIV", "flex h-8 w-4 items-center"],
    ]);
    expect(content.tagName).toBe("DIV");
    expect(content.className).toBe("flex w-full items-center justify-between gap-2 pl-1");
    expect(treeItem.hasAttribute("aria-level")).toBe(false);
    expect(content.firstElementChild?.firstElementChild?.tagName).toBe("svg");
    expect(content.firstElementChild?.firstElementChild?.getAttribute("aria-hidden")).toBeNull();
    expect(row.querySelector("button")).toBeNull();
    await act(async () => root.unmount());
  });

  it("preserves the pinned Run panel group sizing classes", async () => {
    const { container, root } = await renderRoute();
    const group = container.querySelector('[data-group-id="panel-run-parent-v3"]');

    expect(group?.className).toContain("h-full max-h-full");
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

  it("uses the pinned header-only Span body for a selected query", async () => {
    const queryId = "span_4f24adb545b26d31";
    const adapter = new FixtureAdapter();
    const loadInspector = async (nodeId: string) => ({
      ...await adapter.inspector(nodeId, runId),
      label: "SQL query",
      presentation: {
        type: "sql" as const,
        timing: { startedAt: "2026-08-05T12:00:00.000000000Z", endedAt: "2026-08-05T12:00:00.125000000Z", durationUs: 125_000 },
        failure: null,
        sql: {
          statement: { value: "select * from invoices where customer_id = ?", isTruncated: false, originalBytes: 49 },
          bindings: { items: [{ position: 0, column: "customer_id", value: "[REDACTED]" }], truncated: false, originalBytes: 88 },
          result: null,
        },
      },
    });
    const { container, root } = await renderRoute({ initialEntry: `/runs/${runId}?node=${queryId}&tab=detail`, loadInspector });

    await vi.waitFor(() => expect(container.querySelector('[data-skyline-extension="database-state-operation-inspector"]')).not.toBeNull());
    const inspector = container.querySelector<HTMLElement>('[aria-label="Run inspector"]')!;

    expect(inspector.className).toContain("grid-rows-[2.5rem_1fr]");
    expect(inspector.querySelector('[role="tablist"]')).toBeNull();
    expect(inspector.textContent).toContain("Completed");
    expect(inspector.textContent).toContain("Message");
    expect(inspector.textContent).toContain("Properties");

    await act(async () => root.unmount());
  });
});

async function renderRoute(options: { initialEntry?: string; loadInspector?: Parameters<typeof presentRunDetail>[1] } = {}) {
  const adapter = new FixtureAdapter();
  const data = presentRunDetail(await adapter.trace(runId), options.loadInspector ?? ((nodeId) => adapter.inspector(nodeId, runId)));
  const router = createMemoryRouter([
    { path: "/runs/:runId", loader: () => data, element: <RunDetailRoute /> },
  ], { initialEntries: [options.initialEntry ?? `/runs/${runId}?node=run_${runId}`] });
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
