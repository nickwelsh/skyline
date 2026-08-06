import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { createUiPreferencesAdapter } from "./UiPreferencesAdapter";
import { UiPreferencesProvider, useUiPreferences } from "./UiPreferencesProvider";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--theme-contrast");
  localStorage.clear();
  vi.restoreAllMocks();
});

it("applies preferences and follows System appearance changes live", () => {
  let dark = false;
  let change: (() => void) | undefined;
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return dark; },
    addEventListener: (_event: string, listener: () => void) => { change = listener; },
    removeEventListener: vi.fn(),
  })));
  const adapter = createUiPreferencesAdapter({ basePath: "/monitoring" });
  adapter.update((current) => ({ ...current, theme: "system", contrast: 75 }));
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);

  flushSync(() => root.render(<UiPreferencesProvider adapter={adapter}><Probe /></UiPreferencesProvider>));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.style.getPropertyValue("--theme-contrast")).toBe("0.75");
  expect(container.textContent).toBe("system");

  dark = true;
  flushSync(() => change?.());
  expect(document.documentElement.dataset.theme).toBe("dark");
  flushSync(() => root.unmount());
});

function Probe() {
  return useUiPreferences().preferences.theme;
}
