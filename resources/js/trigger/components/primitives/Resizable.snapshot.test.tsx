import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { PanelPersistenceProvider, ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./Resizable";

beforeAll(() => {
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      observe(_target: Element) {}
      disconnect() {}
      unobserve() {}
    },
  });
  Object.assign(HTMLElement.prototype, {
    getBoundingClientRect() {
      return { x: 0, y: 0, width: 800, height: 600, top: 0, right: 800, bottom: 600, left: 0, toJSON() {} };
    },
  });
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ResizablePanelGroup source snapshot", () => {
  it("keeps the source initial grid without native storage", async () => {
    const storageGet = vi.spyOn(Storage.prototype, "getItem");
    const storageSet = vi.spyOn(Storage.prototype, "setItem");
    const { group, root } = await renderGroup(undefined);

    expect(group.dataset.groupId).toBe("panel-run-tree");
    expect(group.style.gridTemplateColumns).toBe("50% 3px 50%");
    expect(storageGet).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("restores validated adapter sizes without native storage", async () => {
    const storageGet = vi.spyOn(Storage.prototype, "getItem");
    const storageSet = vi.spyOn(Storage.prototype, "setItem");
    const { group, root } = await renderGroup([0.25, 0.75]);

    expect(group.dataset.groupId).toBe("panel-run-tree");
    expect(group.style.gridTemplateColumns).toBe("25% 3px 75%");
    expect(storageGet).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});

async function renderGroup(sizes: number[] | undefined) {
  const port = {
    readPanel: vi.fn(() => sizes ? { orientation: "horizontal" as const, itemIds: ["tree", "timeline"], sizes } : undefined),
    writePanel: vi.fn(),
  };
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);

  await act(async () => root.render(
    <PanelPersistenceProvider port={port}>
      <ResizablePanelGroup autosaveId="panel-run-tree">
        <ResizablePanel id="tree" default="50%" />
        <ResizableHandle id="tree-handle" />
        <ResizablePanel id="timeline" default="50%" />
      </ResizablePanelGroup>
    </PanelPersistenceProvider>,
  ));

  return { group: container.querySelector<HTMLElement>("[data-group-id]")!, root };
}
