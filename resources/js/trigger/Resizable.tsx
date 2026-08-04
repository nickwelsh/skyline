/*!
 * Derived from Trigger.dev apps/webapp/app/components/primitives/Resizable.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Modified for Skyline's client-only browser detection and local class composition.
 */
import { Panel, PanelGroup, PanelResizer } from "@window-splitter/react";
import React, { useRef } from "react";

export const ResizablePanelGroup = ({ className = "", ...props }: React.ComponentProps<typeof PanelGroup>) => (
  <PanelGroup className={`flex w-full overflow-hidden data-[panel-group-direction=vertical]:flex-col ${className}`} {...props} />
);

export const ResizablePanel = React.forwardRef<React.ElementRef<typeof Panel>, React.ComponentProps<typeof Panel>>(
  function ResizablePanel({ collapseAnimation, ...props }, ref) {
    const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
    return <Panel ref={ref} collapseAnimation={isFirefox ? undefined : collapseAnimation} {...props} />;
  },
);

export const ResizableHandle = ({ className = "", ...props }: React.ComponentProps<typeof PanelResizer>) => (
  <PanelResizer
    onMouseDown={(event: React.MouseEvent) => event.preventDefault()}
    className={`group relative flex w-0.75 items-center justify-center focus-custom before:absolute before:left-px before:top-0 before:h-full before:w-px before:bg-grid-bright after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 ${className}`}
    size="3px"
    {...props}
  >
    <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-0.75 bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100" />
    <div className="relative z-1 flex h-5 w-0.75 flex-col items-center justify-center gap-0.75 bg-background-dimmed transition-opacity group-hover:opacity-0">
      {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-[0.1875rem] w-0.75 rounded-full bg-surface-control" />)}
    </div>
  </PanelResizer>
);

export const RESIZABLE_PANEL_ANIMATION = { easing: "ease-in-out", duration: 300 } as const;

export function useFrozenValue<T>(value: T | null | undefined): T | null | undefined {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return ref.current;
}
