export type ThemePreference = "classic" | "system" | "dark" | "light";

export type FavoritePreference = {
  id: string;
  label: string;
  url: string;
  icon?: string;
};

export type PanelSnapshot = {
  orientation: "horizontal" | "vertical";
  itemIds: string[];
  sizes: number[];
};

export type UiPreferences = {
  version: 1;
  theme: ThemePreference;
  contrast: number;
  sidebar: {
    isCollapsed: boolean;
    width: number;
    sectionOrder: string[];
    collapsedSections: Record<string, boolean>;
    hiddenItems: Record<string, boolean>;
    sectionItemOrder: Record<string, string[]>;
  };
  favorites: FavoritePreference[];
  runs: { rootOnly: boolean };
  jobs: { usefulLinks: boolean };
  panels: Record<string, PanelSnapshot>;
};

export type UiPreferencesAdapter = {
  storageKey: string;
  read(): UiPreferences;
  update(updater: (current: UiPreferences) => UiPreferences): void;
  clear(): void;
  subscribe(listener: (preferences: UiPreferences) => void): () => void;
  readPanel(id: string): PanelSnapshot | undefined;
  writePanel(id: string, snapshot: PanelSnapshot): void;
  getWarning(): string | null;
};

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const sectionIds = ["favorites", "ai", "metrics", "deployments", "manage"] as const;
const itemIds = ["jobs", "runs", "logs", "errors", "query", "queues", "dashboards", "deployments", "environment-variables", "preview-branches", "regions", "waitpoint-tokens", "batches", "bulk-actions", "api-keys", "alerts", "concurrency", "limits", "integrations"] as const;
const routeRoots = ["jobs", "runs", "errors", "logs", "queues", "query", "dashboards", "deployments", "schedules", "waitpoints", "alerts", "settings"] as const;
const panelDefinitions = {
  "panel-run-parent-v3": { orientation: "horizontal", itemIds: ["run", "inspector"] },
  "panel-run-tree": { orientation: "horizontal", itemIds: ["tree", "timeline"] },
} as const satisfies Record<string, Pick<PanelSnapshot, "orientation" | "itemIds">>;

export const STORAGE_WARNING = "Browser storage is unavailable. Preference changes will last for this tab only.";

export function visibleFavorites(favorites: FavoritePreference[], navigation: Record<string, boolean>): FavoritePreference[] {
  return favorites.filter((favorite) => {
    const root = new URL(favorite.url, "https://skyline.local").pathname.split("/").filter(Boolean)[0];
    return root !== undefined && navigation[root] === true;
  });
}

export function createUiPreferencesAdapter({
  basePath,
  storage,
  onWarning = (message) => console.warn(message),
}: {
  basePath: string;
  storage?: PreferenceStorage;
  onWarning?: (message: string) => void;
}): UiPreferencesAdapter {
  const storageKey = window.__skylineUiPreferences.storageKey(basePath);
  let memory = defaults();
  let initialized = false;
  let warned = false;
  let warning: string | null = null;
  const listeners = new Set<(preferences: UiPreferences) => void>();
  const notify = () => listeners.forEach((listener) => listener(memory));

  const warn = () => {
    if (warned) return;
    warned = true;
    warning = STORAGE_WARNING;
    onWarning(warning);
    notify();
  };

  const selectedStorage = (): PreferenceStorage => {
    try {
      return storage ?? window.localStorage;
    } catch (error) {
      warn();
      throw error;
    }
  };

  const read = () => {
    if (initialized) return memory;
    initialized = true;
    try {
      memory = parsePreferences(readStoredValue(selectedStorage(), storageKey));
    } catch {
      warn();
    }
    return memory;
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) return;
    initialized = true;
    if (event.newValue === null) {
      memory = defaults();
    } else {
      try {
        memory = parsePreferences(JSON.parse(event.newValue));
      } catch {
        memory = defaults();
      }
    }
    notify();
  };

  return {
    storageKey,
    read,
    update: (updater) => {
      memory = parsePreferences(updater(structuredClone(read())));
      initialized = true;
      notify();
      try {
        selectedStorage().setItem(storageKey, JSON.stringify(memory));
      } catch {
        warn();
      }
    },
    clear: () => {
      memory = defaults();
      initialized = true;
      notify();
      try {
        selectedStorage().removeItem(storageKey);
      } catch {
        warn();
      }
    },
    subscribe: (listener) => {
      read();
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    readPanel: (id) => read().panels[id],
    writePanel: (id, snapshot) => {
      const panel = parsePanelSnapshot(id, snapshot);
      if (!panel) return;
      memory = { ...read(), panels: { ...read().panels, [id]: panel } };
      initialized = true;
      notify();
      try {
        selectedStorage().setItem(storageKey, JSON.stringify(memory));
      } catch {
        warn();
      }
    },
    getWarning: () => warning,
  };
}

function readStoredValue(storage: PreferenceStorage, storageKey: string): unknown {
  const value = storage.getItem(storageKey);
  if (value === null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function parsePreferences(value: unknown): UiPreferences {
  const fallback = defaults();
  const input = record(value);
  const sidebar = record(input.sidebar);
  const runs = record(input.runs);
  const jobs = record(input.jobs);
  const appearance = window.__skylineUiPreferences.parseAppearance(input);

  return {
    version: 1,
    theme: appearance.theme,
    contrast: appearance.contrast,
    sidebar: {
      isCollapsed: boolean(sidebar.isCollapsed) ?? fallback.sidebar.isCollapsed,
      width: integer(sidebar.width, 134, 400) ?? fallback.sidebar.width,
      sectionOrder: Array.isArray(sidebar.sectionOrder) ? stringList(sidebar.sectionOrder, sectionIds) : fallback.sidebar.sectionOrder,
      collapsedSections: booleanRecord(sidebar.collapsedSections, sectionIds),
      hiddenItems: booleanRecord(sidebar.hiddenItems, itemIds),
      sectionItemOrder: listRecord(sidebar.sectionItemOrder, sectionIds, itemIds),
    },
    favorites: favorites(input.favorites),
    runs: { rootOnly: boolean(runs.rootOnly) ?? fallback.runs.rootOnly },
    jobs: { usefulLinks: boolean(jobs.usefulLinks) ?? fallback.jobs.usefulLinks },
    panels: panels(input.panels),
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function integer(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

function stringList(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((candidate): candidate is string => typeof candidate === "string" && allowed.includes(candidate)))];
}

function booleanRecord(value: unknown, allowed: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(Object.entries(record(value)).filter((entry): entry is [string, boolean] => allowed.includes(entry[0]) && typeof entry[1] === "boolean"));
}

function listRecord(value: unknown, keys: readonly string[], allowedItems: readonly string[]): Record<string, string[]> {
  return Object.fromEntries(Object.entries(record(value))
    .filter(([key]) => keys.includes(key))
    .map(([key, items]) => [key, stringList(items, allowedItems)])
    .filter(([, items]) => items.length > 0));
}

function favorites(value: unknown): FavoritePreference[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value.flatMap((candidate) => {
    const item = record(candidate);
    if (typeof item.id !== "string" || seen.has(item.id) || typeof item.label !== "string" || typeof item.url !== "string" || !validFavoriteUrl(item.url)) return [];
    seen.add(item.id);
    return [{ id: item.id, label: item.label, url: item.url, ...(typeof item.icon === "string" ? { icon: item.icon } : {}) }];
  });
}

function validFavoriteUrl(value: string): boolean {
  try {
    const url = new URL(value, "https://skyline.local");
    if (url.origin !== "https://skyline.local") return false;
    const root = url.pathname.split("/").filter(Boolean)[0];
    return root !== undefined && routeRoots.includes(root as typeof routeRoots[number]);
  } catch {
    return false;
  }
}

function panels(value: unknown): Record<string, PanelSnapshot> {
  return Object.fromEntries(Object.entries(record(value)).flatMap(([id, snapshot]) => {
    const parsed = parsePanelSnapshot(id, snapshot);
    return parsed ? [[id, parsed]] : [];
  }));
}

function parsePanelSnapshot(id: string, value: unknown): PanelSnapshot | undefined {
  const definition = panelDefinitions[id as keyof typeof panelDefinitions];
  const input = record(value);
  if (!definition || input.orientation !== definition.orientation) return undefined;
  if (!Array.isArray(input.itemIds) || input.itemIds.length !== definition.itemIds.length || input.itemIds.some((item, index) => item !== definition.itemIds[index])) return undefined;
  if (!Array.isArray(input.sizes) || input.sizes.length !== definition.itemIds.length || input.sizes.some((size) => typeof size !== "number" || !Number.isFinite(size))) return undefined;
  const clamped = input.sizes.map((size) => Math.min(1, Math.max(0, size as number)));
  const total = clamped.reduce((sum, size) => sum + size, 0);
  if (total === 0) return undefined;
  return {
    orientation: definition.orientation,
    itemIds: [...definition.itemIds],
    sizes: clamped.map((size) => size / total),
  };
}

function defaults(): UiPreferences {
  return {
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
  };
}
import "./uiPreferencesPrepaint.js";
