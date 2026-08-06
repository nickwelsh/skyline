/*!
 * Derived from Trigger.dev apps/webapp/app/components/primitives/Resizable.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Modified for Skyline's client-only browser detection and package-local cn import.
 */
import { Panel, PanelGroup, PanelResizer } from "@window-splitter/react";
import React, { createContext, useContext, useMemo, useRef } from "react";

import { cn } from "../../utils/cn";

type PanelSnapshotPort = {
  readPanel(id: string): { orientation: "horizontal" | "vertical"; itemIds: string[]; sizes: number[] } | undefined;
  writePanel(id: string, snapshot: { orientation: "horizontal" | "vertical"; itemIds: string[]; sizes: number[] }): void;
};

const PanelPersistenceContext = createContext<PanelSnapshotPort | null>(null);

export function PanelPersistenceProvider({ port, children }: { port: PanelSnapshotPort | null; children: React.ReactNode }) {
  return <PanelPersistenceContext.Provider value={port}>{children}</PanelPersistenceContext.Provider>;
}

const ResizablePanelGroup = ({ className, autosaveId, children, orientation = "horizontal", ...props }: React.ComponentProps<typeof PanelGroup>) => {
  const persistence = useContext(PanelPersistenceContext);
  const itemIds = React.Children.toArray(children).flatMap((child) =>
    React.isValidElement(child) && child.type === ResizablePanel && typeof child.props.id === "string" ? [child.props.id] : []
  );
  const saved = useMemo(() => autosaveId ? persistence?.readPanel(autosaveId) : undefined, [autosaveId, persistence]);
  const compatible = saved?.orientation === orientation && saved.itemIds.length === itemIds.length && saved.itemIds.every((id, index) => id === itemIds[index]);
  const latestSizes = useRef<Record<string, number>>({});
  const persistentChildren = useMemo(() => React.Children.map(children, (child) => {
    if (!React.isValidElement<React.ComponentProps<typeof Panel>>(child) || child.type !== ResizablePanel || typeof child.props.id !== "string") return child;
    const index = itemIds.indexOf(child.props.id);
    const originalResize = child.props.onResize;
    return React.cloneElement(child, {
      ...(compatible ? { default: `${(saved?.sizes[index] ?? 0) * 100}%` } : {}),
      onResize: (size: { pixel: number; percentage: number }) => {
        originalResize?.(size);
        if (!autosaveId || !persistence) return;
        latestSizes.current[child.props.id as string] = size.percentage;
        const sizes = itemIds.map((id) => latestSizes.current[id]);
        if (sizes.every((value) => typeof value === "number")) {
          persistence.writePanel(autosaveId, { orientation, itemIds, sizes });
        }
      },
    });
  }), [autosaveId, children, compatible, itemIds.join("\u0000"), orientation, persistence, saved]);

  return <PanelGroup
    className={cn(
      "flex w-full overflow-hidden data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    orientation={orientation}
    {...props}
  >{persistentChildren}</PanelGroup>;
};

// react-window-splitter drives the collapse animation through @react-spring/rafz,
// which has timing/interaction issues with Firefox that produce visual glitches
// (alternating frames, panels stuck at min, panelHasSpace invariant violations).
// Skyline renders this module client-side, so browser detection stays local.
const ResizablePanel = React.forwardRef<
  React.ElementRef<typeof Panel>,
  React.ComponentProps<typeof Panel>
>(function ResizablePanel({ collapseAnimation, ...props }, ref) {
  const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
  return (
    <Panel
      ref={ref}
      collapseAnimation={isFirefox ? undefined : collapseAnimation}
      {...props}
    />
  );
});

const ResizableHandle = ({
  withHandle = true,
  className,
  ...props
}: React.ComponentProps<typeof PanelResizer> & {
  withHandle?: boolean;
}) => (
  <PanelResizer
    onMouseDown={(e: React.MouseEvent) => {
      e.preventDefault();
    }}
    className={cn(
      "group relative flex items-center justify-center focus-custom",
      // Horizontal size
      "w-0.75",
      // Vertical size
      "data-[handle-orientation=vertical]:h-0.75 data-[handle-orientation=vertical]:w-full",
      // Normal-state line (::before) — 1px, centered in the 3px handle
      "before:absolute before:left-px before:top-0 before:h-full before:w-px before:bg-grid-bright",
      "data-[handle-orientation=vertical]:before:left-0 data-[handle-orientation=vertical]:before:top-px data-[handle-orientation=vertical]:before:h-px data-[handle-orientation=vertical]:before:w-full",
      // Hit area (::after pseudo) for easier grabbing
      "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
      "data-[handle-orientation=vertical]:after:inset-x-0 data-[handle-orientation=vertical]:after:inset-y-auto",
      "data-[handle-orientation=vertical]:after:left-0 data-[handle-orientation=vertical]:after:top-1/2",
      "data-[handle-orientation=vertical]:after:h-3 data-[handle-orientation=vertical]:after:w-full",
      "data-[handle-orientation=vertical]:after:-translate-y-1/2 data-[handle-orientation=vertical]:after:translate-x-0",
      className
    )}
    size="3px"
    {...props}
  >
    {/* Indigo hover overlay — absolutely positioned on top of everything */}
    <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-0.75 bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100 group-data-[handle-orientation=vertical]:hidden" />
    <div className="pointer-events-none absolute left-0 top-0 z-10 hidden h-0.75 w-full bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100 group-data-[handle-orientation=vertical]:block" />
    {withHandle && (
      <>
        {/* Horizontal orientation dots (vertical arrangement) */}
        <div className="relative z-1 flex h-5 w-0.75 flex-col items-center justify-center gap-0.75 bg-background-dimmed transition-opacity group-hover:opacity-0 group-data-[handle-orientation=vertical]:hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[0.1875rem] w-0.75 rounded-full bg-surface-control" />
          ))}
        </div>
        {/* Vertical orientation dots (horizontal arrangement) */}
        <div className="relative z-1 hidden h-0.75 w-5 flex-row items-center justify-center gap-0.75 bg-background-dimmed transition-opacity group-hover:opacity-0 group-data-[handle-orientation=vertical]:flex">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-0.75 w-[0.1875rem] rounded-full bg-surface-control" />
          ))}
        </div>
      </>
    )}
  </PanelResizer>
);

// Firefox filtering happens inside ResizablePanel (see above).
const RESIZABLE_PANEL_ANIMATION = { easing: "ease-in-out", duration: 300 } as const;

const COLLAPSIBLE_HANDLE_CLASSNAME = "transition-opacity duration-200";

function collapsibleHandleClassName(show: boolean) {
  return cn(COLLAPSIBLE_HANDLE_CLASSNAME, !show && "pointer-events-none opacity-0");
}

function useFrozenValue<T>(value: T | null | undefined): T | null | undefined {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return ref.current;
}

export {
  RESIZABLE_PANEL_ANIMATION,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  collapsibleHandleClassName,
  useFrozenValue,
};

export type ResizableSnapshot = React.ComponentProps<typeof PanelGroup>["snapshot"];
