import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@window-splitter/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    Panel: React.forwardRef<HTMLButtonElement, Record<string, unknown>>(function Panel({ children, default: defaultSize, id, onResize }, ref) {
      React.useEffect(() => {
        (onResize as ((size: { pixel: number; percentage: number }) => void) | undefined)?.({ pixel: 50, percentage: 0.5 });
      }, [onResize]);
      const percentage = id === "tree" ? 0.25 : 0.75;
      return <button ref={ref} data-panel-id={String(id)} data-default={String(defaultSize)} onClick={() => (onResize as (size: { pixel: number; percentage: number }) => void)?.({ pixel: percentage * 100, percentage })}>{children as React.ReactNode}</button>;
    }),
    PanelGroup: ({ children, snapshot, autosaveId, autosaveStrategy }: { children: React.ReactNode; snapshot?: object; autosaveId?: string; autosaveStrategy?: string }) => <div data-snapshot={snapshot ? "provided" : "absent"} data-autosave-id={autosaveId} data-autosave-strategy={autosaveStrategy}>{children}</div>,
    PanelResizer: ({ children, onDragStart, onDragEnd }: { children: React.ReactNode; onDragStart?: () => void; onDragEnd?: () => void }) => <button
      data-resizer
      onPointerDown={onDragStart}
      onPointerUp={onDragEnd}
      onKeyDown={(event) => {
        if (!event.key.startsWith("Arrow")) return;
        onDragStart?.();
        document.querySelectorAll<HTMLButtonElement>("[data-panel-id]").forEach((panel) => panel.click());
        onDragEnd?.();
      }}
    >{children}</button>,
  };
});

import { PanelPersistenceProvider, ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./Resizable";

afterEach(() => document.body.replaceChildren());

describe("ResizablePanelGroup persistence", () => {
  it("applies a validated saved split once per mount", () => {
    let saved: { orientation: "horizontal" | "vertical"; itemIds: string[]; sizes: number[] } | undefined;
    const port = {
      readPanel: vi.fn(() => saved),
      writePanel: vi.fn(),
    };
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);
    const panels = () => (
      <PanelPersistenceProvider port={port}>
        <ResizablePanelGroup autosaveId="panel-run-tree">
          <ResizablePanel id="tree" default="50%" />
          <ResizableHandle id="tree-handle" />
          <ResizablePanel id="timeline" default="50%" />
        </ResizablePanelGroup>
      </PanelPersistenceProvider>
    );

    flushSync(() => root.render(panels()));
    expect(defaults(container)).toEqual(["50%", "50%"]);
    expect(container.firstElementChild?.getAttribute("data-snapshot")).toBe("absent");
    expect(container.firstElementChild?.getAttribute("data-autosave-id")).toBe("panel-run-tree");
    expect(container.firstElementChild?.getAttribute("data-autosave-strategy")).toBe("external");

    saved = { orientation: "horizontal", itemIds: ["tree", "timeline"], sizes: [0.25, 0.75] };
    flushSync(() => root.render(panels()));
    expect(defaults(container)).toEqual(["50%", "50%"]);

    flushSync(() => root.unmount());
    const nextRoot = createRoot(container);
    flushSync(() => nextRoot.render(panels()));
    expect(defaults(container)).toEqual(["25%", "75%"]);
    expect(container.firstElementChild?.getAttribute("data-snapshot")).toBe("absent");
    expect(container.firstElementChild?.getAttribute("data-autosave-id")).toBe("panel-run-tree");
    expect(container.firstElementChild?.getAttribute("data-autosave-strategy")).toBe("external");
    flushSync(() => nextRoot.unmount());
  });

  it("persists only pointer or keyboard initiated resizing across StrictMode remounts", async () => {
    let saved: { orientation: "horizontal" | "vertical"; itemIds: string[]; sizes: number[] } | undefined;
    const port = {
      readPanel: vi.fn(() => saved),
      writePanel: vi.fn((_id: string, snapshot: typeof saved) => { saved = snapshot; }),
    };
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.querySelector<HTMLDivElement>("#root")!;
    const root = createRoot(container);
    const panels = () => (
      <PanelPersistenceProvider port={port}>
        <ResizablePanelGroup autosaveId="panel-run-tree">
          <ResizablePanel id="tree" default="50%" />
          <ResizableHandle id="tree-handle" />
          <ResizablePanel id="timeline" default="50%" />
        </ResizablePanelGroup>
      </PanelPersistenceProvider>
    );

    await act(async () => root.render(<StrictMode>{panels()}</StrictMode>));
    expect(defaults(container)).toEqual(["50%", "50%"]);
    expect(port.writePanel).not.toHaveBeenCalled();

    const resizer = container.querySelector<HTMLButtonElement>("[data-resizer]")!;
    resizer.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    container.querySelectorAll<HTMLButtonElement>("[data-panel-id]").forEach((panel) => panel.click());
    expect(port.writePanel).not.toHaveBeenCalled();
    resizer.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(port.writePanel).toHaveBeenCalledTimes(1);
    expect(port.writePanel).toHaveBeenLastCalledWith("panel-run-tree", {
      orientation: "horizontal",
      itemIds: ["tree", "timeline"],
      sizes: [0.25, 0.75],
    });

    port.writePanel.mockClear();
    resizer.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(port.writePanel).toHaveBeenCalledTimes(1);
    expect(port.writePanel).toHaveBeenLastCalledWith("panel-run-tree", {
      orientation: "horizontal",
      itemIds: ["tree", "timeline"],
      sizes: [0.25, 0.75],
    });

    const writeCount = port.writePanel.mock.calls.length;
    await act(async () => root.unmount());
    const nextRoot = createRoot(container);
    await act(async () => nextRoot.render(<StrictMode>{panels()}</StrictMode>));
    expect(defaults(container)).toEqual(["25%", "75%"]);
    expect(port.writePanel).toHaveBeenCalledTimes(writeCount);
    await act(async () => nextRoot.unmount());
  });
});

function defaults(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-panel-id]"), (panel) => panel.getAttribute("data-default"));
}
