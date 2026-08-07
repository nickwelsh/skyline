import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureCapabilities } from "../../../skyline/FixtureAdapter";
import { OperatingSystemContextProvider } from "../primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../primitives/ShortcutsProvider";
import { FavoritesProvider } from "./JobFavorites";
import { SideMenu, type SideMenuCapabilities } from "./SideMenu";

const dormantSurfaces = [
  "Sessions",
  "Prompts",
  "Models",
  "Deploys",
  "Environment variables",
  "Preview branches",
  "Regions",
  "Waitpoint tokens",
  "Batches",
  "Bulk actions",
  "API keys",
  "Alerts",
  "Concurrency",
  "Limits",
  "Integrations",
] as const;
const dormantCapabilityKeys = [
  "sessions",
  "prompts",
  "models",
  "deployments",
  "environmentVariables",
  "previewBranches",
  "regions",
  "waitpointTokens",
  "batches",
  "bulkActions",
  "apiKeys",
  "alerts",
  "concurrency",
  "limits",
  "integrations",
] as const;

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("SideMenu capabilities", () => {
  it("uses the installed Application identity without inventing a project", () => {
    const container = renderSideMenu(fixtureCapabilities.navigation);

    expect(container.querySelector('[data-testid="side-menu-application"]')?.textContent).toBe("Applicationtesting");
    expect(container.querySelector('[data-testid="side-menu-application"]')?.textContent).not.toContain("Project");
    expect(container.querySelector('[data-action="tasks"]')?.textContent).toBe("Tasks");
    expect(container.textContent).not.toContain("Application environment");
    expect(container.textContent).not.toContain("Jobs");
  });

  it("preserves the pinned Trigger shell geometry and resize seam", () => {
    const container = renderSideMenu(fixtureCapabilities.navigation);
    const menu = container.querySelector<HTMLElement>('[data-testid="side-menu"]')!;
    const inner = menu.querySelector<HTMLElement>(":scope > .absolute.inset-0.grid")!;
    const application = container.querySelector<HTMLElement>('[data-testid="side-menu-application"]')!;
    const navigation = container.querySelector<HTMLElement>('nav[aria-label="Application"]')!.parentElement!;
    const navigationContent = navigation.firstElementChild as HTMLElement;
    const resizer = container.querySelector<HTMLElement>('[data-testid="side-menu-resizer"]')!;

    expect(menu.className).toBe("relative h-full border-r border-grid-bright bg-background-bright");
    expect(inner.className).toBe("absolute inset-0 grid grid-cols-[100%] grid-rows-[2.5rem_auto_1fr_auto_auto] overflow-hidden");
    expect(application.className).toBe("border-b border-grid-bright pb-2.5 pt-1");
    expect(application.style.paddingLeft).toBe("calc(0.625rem - 0.375rem * var(--sm-collapse, 0))");
    expect(application.style.paddingRight).toBe("calc(0.625rem - 0.375rem * var(--sm-collapse, 0))");
    expect(navigation.className).toBe("min-h-0 overflow-y-auto pt-2.5 scrollbar-gutter-stable scrollbar-thumb-on-hover");
    expect(navigation.hasAttribute("data-skyline-anchor")).toBe(false);
    expect(container.querySelectorAll('nav[aria-label="Application"]')).toHaveLength(1);
    expect(navigationContent.className).toBe("mb-6 flex w-full flex-col gap-4 overflow-hidden");
    expect(navigationContent.style.paddingLeft).toBe("calc(0.625rem - 0.375rem * var(--sm-collapse, 0))");
    expect(navigationContent.style.paddingRight).toBe("0px");
    expect(resizer.getAttribute("role")).toBe("separator");
    expect(resizer.getAttribute("aria-orientation")).toBe("vertical");
    expect(resizer.getAttribute("aria-label")).toBe("Resize side menu");
    expect(resizer.className).toBe("group/resize absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none");
    expect((resizer.firstElementChild as HTMLElement).className).toBe("pointer-events-none absolute inset-y-0 left-1/2 w-0.75 -translate-x-1/2 bg-indigo-500 opacity-0 transition-opacity duration-300 group-hover/resize:opacity-100");
  });

  it("uses exact source controls for the supported Observability extension", () => {
    const container = renderSideMenu(fixtureCapabilities.navigation);
    const section = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Observability"))!;

    expect(section.className).toBe("group/section flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-sm py-1 pl-1.5 pr-1 group-hover/sectionheader:bg-background-hover focus-custom");
    expect(section.getAttribute("data-skyline-extension")).toBe("shell-observability-header");
    for (const action of ["tasks", "runs", "logs", "errors", "queues"]) {
      const link = container.querySelector<HTMLElement>(`[data-action="${action}"]`)!;
      expect(link.className).toBe("h-8! block w-full group/menulink flex h-8 items-center gap-2 overflow-hidden rounded pl-1.75 pr-2 focus-custom w-full text-text-dimmed group-hover/menuitem:bg-background-hover group-hover/menuitem:text-text-bright hover:bg-background-hover hover:text-text-bright");
      expect(link.querySelector("span")?.className).toBe("overflow-hidden whitespace-nowrap min-w-0 flex-1 select-none text-left text-[0.90625rem] font-medium tracking-[-0.01em]");
      expect(link.getAttribute("data-skyline-extension")).toBe(["logs", "errors", "queues"].includes(action) ? `shell-${action}-navigation` : null);
    }
  });

  it("uses the pinned exact-path active state on detail routes", () => {
    const list = renderSideMenu(fixtureCapabilities.navigation, false, undefined, "/errors");
    expect(list.querySelector('[data-action="errors"]')?.className).toContain("bg-tertiary");

    const detail = renderSideMenu(fixtureCapabilities.navigation, false, undefined, "/errors/error_123");
    expect(detail.querySelector('[data-action="errors"]')?.className).not.toContain("bg-tertiary");
  });

  it("keeps Appearance in a dedicated row before the unchanged source footer", () => {
    const container = renderSideMenu(fixtureCapabilities.navigation);
    const inner = container.querySelector<HTMLElement>('[data-testid="side-menu"] > .absolute.inset-0.grid')!;
    const footer = inner.lastElementChild as HTMLElement;
    const appearanceRow = footer.previousElementSibling as HTMLElement;
    const panel = footer.firstElementChild as HTMLElement;
    const controls = panel.lastElementChild as HTMLElement;
    const help = [...controls.querySelectorAll("button")].find((button) => button.textContent?.includes("Help & Feedback"))!;
    const appearance = appearanceRow.querySelector<HTMLButtonElement>('button[aria-label="Appearance"]')!;
    const collapse = controls.querySelector<HTMLButtonElement>('button[aria-label="Collapse side menu"]')!;

    expect(appearanceRow.getAttribute("data-testid")).toBe("side-menu-appearance");
    expect(appearanceRow.className).toBe("px-1");
    expect(footer.className).toBe("");
    expect(panel.className).toBe("flex flex-col gap-1 border-t border-grid-bright p-1");
    expect(controls.className).toBe("flex w-full items-center justify-between");
    expect(controls.hasAttribute("data-skyline-anchor")).toBe(false);
    expect(container.querySelectorAll('button[aria-label="Collapse side menu"]')).toHaveLength(1);
    expect(help.className).toBe("group flex h-8 items-center gap-1.5 rounded pl-1.75 pr-2 hover:bg-background-hover focus-custom w-full justify-between");
    expect(help.querySelector("span > span")?.className).toBe("min-w-0 overflow-hidden whitespace-nowrap text-[0.90625rem] font-medium tracking-[-0.01em] text-text-dimmed group-hover:text-text-bright");
    const helpIcon = help.querySelector("svg")!;
    expect(helpIcon.className.baseVal).toBe("size-5 min-w-5 shrink-0 text-success");
    expect(helpIcon.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(helpIcon.querySelector('circle[cx="12"][cy="12.0232"][r="9"]')).not.toBeNull();
    expect(helpIcon.querySelector('path[d="M9.27051 8.7533C9.7438 7.71876 10.788 7 12 7C13.6569 7 15 8.34315 15 10C15 11.6569 13.6569 13 12 13V14.5"]')).not.toBeNull();
    expect(helpIcon.querySelector('circle[cx="12"][cy="17"][r="1"]')).not.toBeNull();
    expect(appearance.className).toContain("w-full");
    expect(appearance.textContent).toBe("Appearance");
    expect(appearance.getAttribute("data-skyline-extension")).toBe("shell-appearance");
    expect(collapse.className).toBe("group/button outline-hidden focus-custom");
    expect(collapse.parentElement?.parentElement?.parentElement).toBe(controls);
    expect(appearance.contains(help)).toBe(false);
    expect(help.contains(appearance)).toBe(false);

    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.indexOf(appearance)).toBeLessThan(buttons.indexOf(help));
    expect(buttons.indexOf(help)).toBeLessThan(buttons.indexOf(collapse));
  });

  it("keeps the dedicated Appearance target on narrow and collapsed shells", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const narrow = renderSideMenu(fixtureCapabilities.navigation);
    const narrowAppearance = narrow.querySelector<HTMLButtonElement>('button[aria-label="Appearance"]')!;
    expect(narrowAppearance.textContent).toBe("Appearance");
    expect(narrowAppearance.closest('[data-testid="side-menu-appearance"]')).not.toBeNull();

    document.body.replaceChildren();
    const collapsed = renderSideMenu(fixtureCapabilities.navigation, true);
    const collapsedRow = collapsed.querySelector<HTMLElement>('[data-testid="side-menu-appearance"]')!;
    const collapsedAppearance = collapsedRow.querySelector<HTMLButtonElement>('button[aria-label="Appearance"]')!;
    expect(collapsedRow.className).toBe("flex justify-center px-1");
    expect(collapsedAppearance.className).toContain("w-8 justify-center pl-0 pr-0");
    expect(collapsedAppearance.textContent).toBe("");
    expect(collapsedAppearance.querySelector("svg")).not.toBeNull();
    expect(collapsed.querySelector('button[aria-label="Expand side menu"]')).not.toBeNull();
  });

  it("retains every unsupported Trigger surface behind a dormant branch", () => {
    const container = renderSideMenu({
      ...fixtureCapabilities.navigation,
      sessions: true,
      prompts: true,
      models: true,
      deployments: true,
      environmentVariables: true,
      previewBranches: true,
      regions: true,
      waitpointTokens: true,
      batches: true,
      bulkActions: true,
      apiKeys: true,
      alerts: true,
      concurrency: true,
      limits: true,
      integrations: true,
    } as SideMenuCapabilities["navigation"]);

    for (const label of dormantSurfaces) {
      expect(container.textContent).toContain(label);
    }
    for (const section of ["AI", "Observability", "Deployments", "Manage"]) {
      expect(container.textContent).toContain(section);
    }
  });

  it("keeps unsupported Trigger surfaces absent in the fixture contract", () => {
    const container = renderSideMenu(fixtureCapabilities.navigation);

    for (const capability of dormantCapabilityKeys) {
      expect(fixtureCapabilities.navigation[capability]).toBe(false);
    }
    for (const label of dormantSurfaces) {
      expect(container.textContent).not.toContain(label);
    }
    for (const section of ["AI", "Deployments", "Manage"]) {
      expect(container.textContent).not.toContain(section);
    }
  });

  it("omits dormant saved favorites when the shell capability is unavailable", () => {
    const container = renderSideMenu(fixtureCapabilities.navigation, false, {
      enabled: false,
      favorites: [{ id: "saved", label: "Saved run", path: "/runs/saved" }],
    });

    expect(container.querySelector('[aria-label="Favorites"]')).toBeNull();
    expect(container.textContent).not.toContain("Saved run");
  });
});

function renderSideMenu(navigation: SideMenuCapabilities["navigation"], collapsed = false, favoriteOptions: { enabled: boolean; favorites: Array<{ id: string; label: string; path: string }> } = { enabled: true, favorites: [] }, path = "/") {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);

  flushSync(() => root.render(
    <MemoryRouter initialEntries={[path]}>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <FavoritesProvider favorites={favoriteOptions.favorites} onChange={vi.fn()} enabled={favoriteOptions.enabled}>
            <SideMenu
          applicationName="Skyline"
          brandMark={null}
          environmentLabel="testing"
          capabilities={{ navigation, shell: fixtureCapabilities.shell, help: fixtureCapabilities.help }}
          preferences={{ isCollapsed: collapsed, width: 224, sectionOrder: [], collapsedSections: {}, hiddenItems: {}, sectionItemOrder: {} }}
          appearance={{ theme: "system", contrast: 50 }}
          warning={null}
          onPreferencesChange={vi.fn()}
          onAppearanceChange={vi.fn()}
          onCustomize={vi.fn()}
            />
          </FavoritesProvider>
        </ShortcutsProvider>
      </OperatingSystemContextProvider>
    </MemoryRouter>,
  ));

  return container;
}
