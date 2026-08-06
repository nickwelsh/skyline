import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiPreferencesAdapter, visibleFavorites } from "./UiPreferencesAdapter";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--theme-contrast");
  vi.restoreAllMocks();
});

describe("UiPreferencesAdapter", () => {
  it("shares versioning and appearance parsing with prepaint", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true })) });
    localStorage.setItem("skyline.ui-preferences.v1:/monitoring", JSON.stringify({ theme: "system", contrast: 75 }));

    window.__skylineUiPreferences.prepaint("/monitoring/");

    expect(window.__skylineUiPreferences.storageKey("/monitoring/")).toBe("skyline.ui-preferences.v1:/monitoring");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--theme-contrast")).toBe("0.75");
  });

  it("uses versioned base-path storage and source defaults", () => {
    const preferences = createUiPreferencesAdapter({ basePath: "/monitoring/" });

    expect(preferences.storageKey).toBe("skyline.ui-preferences.v1:/monitoring");
    expect(preferences.read()).toEqual({
      version: 1,
      theme: "classic",
      contrast: 50,
      sidebar: {
        isCollapsed: false,
        width: 224,
        sectionOrder: ["favorites", "metrics"],
        collapsedSections: {},
        hiddenItems: {},
        sectionItemOrder: {},
      },
      favorites: [],
      runs: { rootOnly: false },
      jobs: { usefulLinks: true },
      panels: {},
    });
  });

  it("recovers invalid fields independently and prunes deleted routes", () => {
    localStorage.setItem("skyline.ui-preferences.v1:/monitoring", JSON.stringify({
      version: 1,
      theme: "neon",
      contrast: 80,
      sidebar: {
        isCollapsed: true,
        width: 9999,
        sectionOrder: ["metrics", "ai", "deleted", "metrics"],
        collapsedSections: { metrics: true, ai: true, deleted: true },
        hiddenItems: { logs: true, query: true, deleted: true },
        sectionItemOrder: { metrics: ["queues", "logs", "deleted", "queues"] },
      },
      favorites: [
        { id: "run", label: "Run", url: "/runs/run_01" },
        { id: "future-query", label: "Query", url: "/query" },
        { id: "deleted", label: "Deleted", url: "/deleted" },
        { id: "external", label: "External", url: "https://example.test" },
      ],
      runs: { rootOnly: "yes" },
      jobs: { usefulLinks: false },
      panels: {},
    }));

    expect(createUiPreferencesAdapter({ basePath: "/monitoring" }).read()).toMatchObject({
      theme: "classic",
      contrast: 80,
      sidebar: {
        isCollapsed: true,
        width: 224,
        sectionOrder: ["metrics", "ai"],
        collapsedSections: { metrics: true, ai: true },
        hiddenItems: { logs: true, query: true },
        sectionItemOrder: { metrics: ["queues", "logs"] },
      },
      favorites: [
        { id: "run", label: "Run", url: "/runs/run_01" },
        { id: "future-query", label: "Query", url: "/query" },
      ],
      runs: { rootOnly: false },
      jobs: { usefulLinks: false },
    });
  });

  it("updates immediately, synchronizes storage events, and clears to defaults", () => {
    const first = createUiPreferencesAdapter({ basePath: "/monitoring" });
    const second = createUiPreferencesAdapter({ basePath: "/monitoring" });
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const stopFirst = first.subscribe(firstListener);
    const stopSecond = second.subscribe(secondListener);

    first.update((current) => ({ ...current, theme: "dark", runs: { rootOnly: false } }));

    expect(first.read()).toMatchObject({ theme: "dark", runs: { rootOnly: false }, jobs: { usefulLinks: true } });
    expect(firstListener).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "dark" }));
    window.dispatchEvent(new StorageEvent("storage", {
      key: first.storageKey,
      newValue: localStorage.getItem(first.storageKey),
      storageArea: localStorage,
    }));
    expect(second.read()).toMatchObject({ theme: "dark", runs: { rootOnly: false } });
    expect(secondListener).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "dark" }));

    first.clear();
    expect(first.read()).toMatchObject({ theme: "classic", runs: { rootOnly: false }, jobs: { usefulLinks: true } });
    expect(localStorage.getItem(first.storageKey)).toBeNull();

    stopFirst();
    stopSecond();
  });

  it("falls back to memory and warns once when storage fails", () => {
    const warning = vi.fn();
    const storage = {
      getItem: vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }),
      setItem: vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }),
      removeItem: vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }),
    };
    const preferences = createUiPreferencesAdapter({ basePath: "/monitoring", storage, onWarning: warning });

    expect(preferences.read().theme).toBe("classic");
    preferences.update((current) => ({ ...current, theme: "light" }));
    preferences.update((current) => ({ ...current, contrast: 75 }));
    expect(preferences.read()).toMatchObject({ theme: "light", contrast: 75 });
    expect(warning).toHaveBeenCalledOnce();
  });

  it("keeps only declared panel identities and clamps compatible snapshots", () => {
    localStorage.setItem("skyline.ui-preferences.v1:/monitoring", JSON.stringify({
      version: 1,
      panels: {
        "panel-run-parent-v3": {
          orientation: "horizontal",
          itemIds: ["run", "inspector"],
          sizes: [-2, 3],
        },
        "panel-run-tree": {
          orientation: "vertical",
          itemIds: ["tree", "timeline"],
          sizes: [0.4, 0.6],
        },
        "unknown-panel": {
          orientation: "horizontal",
          itemIds: ["a", "b"],
          sizes: [0.5, 0.5],
        },
      },
    }));
    const preferences = createUiPreferencesAdapter({ basePath: "/monitoring" });

    expect(preferences.readPanel("panel-run-parent-v3")).toEqual({
      orientation: "horizontal",
      itemIds: ["run", "inspector"],
      sizes: [0, 1],
    });
    expect(preferences.readPanel("panel-run-tree")).toBeUndefined();
    expect(preferences.read().panels).not.toHaveProperty("unknown-panel");

    preferences.writePanel("panel-run-tree", {
      orientation: "horizontal",
      itemIds: ["tree", "timeline"],
      sizes: [0.25, 0.75],
    });
    expect(preferences.readPanel("panel-run-tree")?.sizes).toEqual([0.25, 0.75]);
  });

  it("keeps capability-unavailable favorites dormant", () => {
    const favorites = [
      { id: "runs", label: "Runs", url: "/runs" },
      { id: "query", label: "Query", url: "/query" },
    ];

    expect(visibleFavorites(favorites, { runs: true, query: false })).toEqual([favorites[0]]);
    expect(visibleFavorites(favorites, { runs: true, query: true })).toEqual(favorites);
  });

  it("preserves dormant pinned SideMenu item and route preferences", () => {
    const roots = [
      "sessions",
      "prompts",
      "models",
      "environment-variables",
      "preview-branches",
      "regions",
      "waitpoint-tokens",
      "batches",
      "bulk-actions",
      "api-keys",
      "concurrency",
      "limits",
      "integrations",
    ];
    const favorites = roots.map((root) => ({ id: `favorite_${root}`, label: root, url: `/${root}` }));
    localStorage.setItem("skyline.ui-preferences.v1:/monitoring", JSON.stringify({
      sidebar: {
        hiddenItems: { prompts: true, models: false },
        sectionItemOrder: { ai: ["models", "prompts"] },
      },
      favorites,
    }));

    const stored = createUiPreferencesAdapter({ basePath: "/monitoring" }).read();

    expect(stored.sidebar.hiddenItems).toEqual({ prompts: true, models: false });
    expect(stored.sidebar.sectionItemOrder.ai).toEqual(["models", "prompts"]);
    expect(stored.favorites).toEqual(favorites);
  });

  it("retains hidden state only for registered routes and saved favorites", () => {
    localStorage.setItem("skyline.ui-preferences.v1:/monitoring", JSON.stringify({
      sidebar: {
        hiddenItems: {
          logs: true,
          job_invoice: true,
          orphaned_favorite: true,
        },
      },
      favorites: [
        { id: "job_invoice", label: "GenerateMonthlyInvoices", url: "/jobs/job_invoice" },
      ],
    }));

    expect(createUiPreferencesAdapter({ basePath: "/monitoring" }).read().sidebar.hiddenItems).toEqual({
      logs: true,
      job_invoice: true,
    });
  });
});
