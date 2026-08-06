import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@window-splitter/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    Panel: React.forwardRef<HTMLDivElement, Record<string, unknown>>(function Panel({ children, default: defaultSize, id }, ref) {
      return <div ref={ref} data-panel-id={String(id)} data-default={String(defaultSize)}>{children as React.ReactNode}</div>;
    }),
    PanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PanelResizer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

import { PanelPersistenceProvider, ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./Resizable";

afterEach(() => document.body.replaceChildren());

describe("ResizablePanelGroup persistence", () => {
  it("applies a validated saved split once per mount", () => {
    let saved: { orientation: "horizontal"; itemIds: string[]; sizes: number[] } | undefined;
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

    saved = { orientation: "horizontal", itemIds: ["tree", "timeline"], sizes: [0.25, 0.75] };
    flushSync(() => root.render(panels()));
    expect(defaults(container)).toEqual(["50%", "50%"]);

    flushSync(() => root.unmount());
    const nextRoot = createRoot(container);
    flushSync(() => nextRoot.render(panels()));
    expect(defaults(container)).toEqual(["25%", "75%"]);
    flushSync(() => nextRoot.unmount());
  });
});

function defaults(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-panel-id]"), (panel) => panel.getAttribute("data-default"));
}
