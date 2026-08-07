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
    const header = dialog.firstElementChild as HTMLElement;
    const content = header.children[1] as HTMLElement;
    expect(dialog.className).toContain("right-0");
    expect(header.className).toContain("space-y-2");
    expect(header.children).toHaveLength(2);
    expect(header.firstElementChild?.firstElementChild?.tagName).toBe("DIV");
    expect(content.className).toBe("space-y-6 px-4 pb-4 pt-2");
    expect(sectionRows(content.children[0] as HTMLElement)).toEqual([
      "Close", "Toggle side menu", "Favorite this page", "Previous page", "Next page",
    ]);
    expect(sectionRows(content.children[1] as HTMLElement)).toEqual([
      "Overview", "Details", "Context", "Metadata", "Navigate", "Jump to next/previous run", "Expand all", "Collapse all", "Toggle level", "Jump to root run", "Jump to parent run",
    ]);
    expect(shortcutKeys(row(content, "Toggle side menu"))).toHaveLength(2);
    expect(shortcutKeys(row(content, "Favorite this page"))).toHaveLength(2);
    expect(shortcutKeys(row(content, "Jump to next/previous run"))).toHaveLength(2);
    expect(row(content, "Toggle level").textContent).toContain("0to9");
    expect(dialog.textContent).not.toContain("Ask AI");
    expect(dialog.textContent).not.toContain("Bulk action");
    expect(dialog.textContent).not.toContain("Queue time");
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

function sectionRows(section: HTMLElement) {
  return Array.from(section.children).slice(1).map((element) => element.firstElementChild?.textContent);
}

function row(content: HTMLElement, label: string) {
  return Array.from(content.querySelectorAll<HTMLElement>(".justify-between")).find((element) => element.firstElementChild?.textContent === label)!;
}

function shortcutKeys(element: HTMLElement) {
  return element.lastElementChild?.querySelectorAll(":scope > span") ?? [];
}
