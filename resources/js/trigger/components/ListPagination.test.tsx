import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { OperatingSystemContextProvider } from "./primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "./primitives/ShortcutsProvider";
import { ListPagination } from "./ListPagination";

describe("ListPagination", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("omits controls when neither cursor exists", () => {
    const container = render({});

    expect(container.innerHTML).toBe("");
  });

  it("renders a previous cursor with backward direction", () => {
    const container = render({ previous: "previous-page" });

    expect(container.querySelector<HTMLAnchorElement>('a[aria-label="Previous"]')?.getAttribute("href"))
      .toBe("/queues?cursor=previous-page&direction=backward");
  });

  it("renders a next cursor with forward direction", () => {
    const container = render({ next: "next-page" });

    expect(container.querySelector<HTMLAnchorElement>('a[aria-label="Next"]')?.getAttribute("href"))
      .toBe("/queues?cursor=next-page&direction=forward");
  });
});

function render(pagination: { previous?: string; next?: string }) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  flushSync(() => root.render(
    <OperatingSystemContextProvider platform="mac">
      <ShortcutsProvider>
        <MemoryRouter initialEntries={["/queues"]}>
          <ListPagination list={{ pagination }} />
        </MemoryRouter>
      </ShortcutsProvider>
    </OperatingSystemContextProvider>,
  ));
  return container;
}
