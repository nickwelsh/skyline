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
  it("preserves the pinned Trigger project and Tasks shell semantics", () => {
    const container = renderSideMenu(fixtureCapabilities.navigation);

    expect(container.querySelector('[data-testid="side-menu-project"]')?.textContent).toContain("Project");
    expect(container.querySelector('[data-testid="side-menu-project"]')?.textContent).toContain("Skyline");
    expect(container.querySelector('[data-testid="side-menu-project"]')?.textContent).toContain("testing");
    expect(container.querySelector('[data-action="tasks"]')?.textContent).toBe("Tasks");
    expect(container.textContent).not.toContain("Application environment");
    expect(container.textContent).not.toContain("Jobs");
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
});

function renderSideMenu(navigation: SideMenuCapabilities["navigation"]) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);

  flushSync(() => root.render(
    <MemoryRouter>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <FavoritesProvider favorites={[]} onChange={vi.fn()}>
            <SideMenu
          applicationName="Skyline"
          brandMark={null}
          environmentLabel="testing"
          capabilities={{ navigation, shell: fixtureCapabilities.shell, help: fixtureCapabilities.help }}
          preferences={{ isCollapsed: false, width: 224, sectionOrder: [], collapsedSections: {}, hiddenItems: {}, sectionItemOrder: {} }}
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
