import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperatingSystemContextProvider } from "../primitives/OperatingSystemProvider";
import { HelpMenu, type HelpCapabilities } from "./HelpMenu";

vi.mock("../primitives/Popover", () => ({
  Popover: ({ children }: ComponentProps<"div">) => <div>{children}</div>,
  PopoverTrigger: ({ children, ...props }: ComponentProps<"button">) => <button {...props}>{children}</button>,
  PopoverContent: ({ children, side, sideOffset, ...props }: ComponentProps<"div"> & { side?: string; sideOffset?: number }) => <div {...props} data-side={side} data-side-offset={sideOffset}>{children}</div>,
}));

const capabilities: HelpCapabilities = { menu: true, shortcuts: true, askAi: false, documentation: false, status: false, suggestFeature: false, contact: false, changelog: false };

afterEach(() => document.body.replaceChildren());

describe("HelpMenu placement", () => {
  it("adds the exact 32px Appearance-row clearance without changing the source side", () => {
    const content = renderHelp({ hasAppearanceAbove: true });
    expect(content.dataset.side).toBe("top");
    expect(content.dataset.sideOffset).toBe("36");
  });

  it("keeps source offsets without the expanded Appearance row", () => {
    expect(renderHelp({ hasAppearanceAbove: false }).dataset.sideOffset).toBe("4");
    const collapsed = renderHelp({ collapsed: true, hasAppearanceAbove: true });
    expect(collapsed.dataset.side).toBe("right");
    expect(collapsed.dataset.sideOffset).toBe("8");
  });
});

function renderHelp(overrides: { collapsed?: boolean; hasAppearanceAbove: boolean }) {
  const container = document.body.appendChild(document.createElement("div"));
  flushSync(() => createRoot(container).render(<OperatingSystemContextProvider platform="mac"><HelpMenu collapsed={overrides.collapsed ?? false} capabilities={capabilities} shortcutsOpen={false} onOpenShortcuts={vi.fn()} labelOpacity={1} hasAppearanceAbove={overrides.hasAppearanceAbove} /></OperatingSystemContextProvider>));
  return container.querySelector<HTMLElement>("[data-side-offset]")!;
}
