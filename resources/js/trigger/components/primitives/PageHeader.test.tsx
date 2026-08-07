import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { FavoritesProvider } from "../navigation/JobFavorites";
import { OperatingSystemContextProvider } from "./OperatingSystemProvider";
import { PageTitle } from "./PageHeader";
import { ShortcutsProvider } from "./ShortcutsProvider";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

test("PageTitle preserves the pinned favorite control", () => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;

  flushSync(() => createRoot(container).render(
    <MemoryRouter initialEntries={["/jobs/example"]}>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <FavoritesProvider favorites={[]} onChange={vi.fn()}>
            <PageTitle title="Example" />
          </FavoritesProvider>
        </ShortcutsProvider>
      </OperatingSystemContextProvider>
    </MemoryRouter>,
  ));

  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Add Example to favorites"]')!;
  expect(button.parentElement?.className).toBe("flex -ml-1");
  expect(button.className).toBe("group/button outline-hidden focus-custom");
  expect(button.firstElementChild?.className).toContain("aspect-square h-6 p-1");
  expect(button.querySelector("svg")?.getAttribute("class")).toBe("size-4 text-text-dimmed transition-colors group-hover/button:text-text-bright");
  expect(button.getAttribute("aria-pressed")).toBe("false");
});

test("PageTitle preserves the pinned favorite control for a composed Error title", () => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const onChange = vi.fn();

  flushSync(() => createRoot(container).render(
    <MemoryRouter initialEntries={["/errors/error_deadlock"]}>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <FavoritesProvider favorites={[]} onChange={onChange}>
            <PageTitle title={<span className="font-mono">error_deadlock</span>} favoriteLabel="Errors" />
          </FavoritesProvider>
        </ShortcutsProvider>
      </OperatingSystemContextProvider>
    </MemoryRouter>,
  ));

  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Add Errors to favorites"]')!;
  expect(button.parentElement?.className).toBe("flex -ml-1");
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF", altKey: true, bubbles: true }));
  expect(onChange).toHaveBeenCalledWith([
    { id: "page:/errors/error_deadlock", label: "Errors", path: "/errors/error_deadlock" },
  ]);
});

test("PageTitle omits the favorite control when unavailable", () => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;

  flushSync(() => createRoot(container).render(
    <MemoryRouter initialEntries={["/jobs/example"]}>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <FavoritesProvider favorites={[{ id: "saved", label: "Saved", path: "/runs/saved" }]} onChange={vi.fn()} enabled={false}>
            <PageTitle title="Example" />
          </FavoritesProvider>
        </ShortcutsProvider>
      </OperatingSystemContextProvider>
    </MemoryRouter>,
  ));

  expect(container.querySelector('button[aria-label*="favorites"]')).toBeNull();
});
