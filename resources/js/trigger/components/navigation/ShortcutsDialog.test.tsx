import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { OperatingSystemContextProvider } from "../primitives/OperatingSystemProvider";
import { ShortcutsDialog } from "./ShortcutsDialog";

afterEach(() => document.body.replaceChildren());

describe("ShortcutsDialog", () => {
  it("uses the source sheet and lists supported controls", () => {
    render({ sidebar: true, favorites: true, pagination: true, runs: true });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.className).toContain("right-0");
    expect(dialog.textContent).toContain("General");
    expect(dialog.textContent).toContain("Toggle side menu");
    expect(dialog.textContent).toContain("Favorite this page");
    expect(dialog.textContent).toContain("Previous page");
    expect(dialog.textContent).toContain("Run page");
    expect(dialog.textContent).toContain("Navigate trace");
    expect(dialog.textContent).toContain("Expand all");
    expect(dialog.textContent).toContain("Context");
    expect(dialog.textContent).not.toContain("Ask AI");
    expect(dialog.textContent).not.toContain("Bulk action");
  });

  it("omits controls whose capability is unavailable", () => {
    render({ sidebar: false, favorites: false, pagination: false, runs: false });

    const text = document.querySelector<HTMLElement>('[role="dialog"]')!.textContent;
    expect(text).toContain("Close");
    expect(text).not.toContain("Toggle side menu");
    expect(text).not.toContain("Favorite this page");
    expect(text).not.toContain("Previous page");
    expect(text).not.toContain("Run page");
  });
});

function render(capabilities: { sidebar: boolean; favorites: boolean; pagination: boolean; runs: boolean }) {
  const container = document.createElement("div");
  document.body.append(container);
  flushSync(() => createRoot(container).render(
    <OperatingSystemContextProvider platform="linux">
      <ShortcutsDialog open onOpenChange={() => {}} capabilities={capabilities} />
    </OperatingSystemContextProvider>,
  ));
}
