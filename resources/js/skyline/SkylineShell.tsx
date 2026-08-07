import { BrandMark } from "./BrandMark";
import type { SkylineBootstrap } from "./dto";
import { useUiPreferences } from "./UiPreferencesProvider";
import { visibleFavorites, type FavoritePreference, type UiPreferences } from "./UiPreferencesAdapter";
import { TriggerShell } from "../trigger/root";
import type { JobFavorite } from "../trigger/components/navigation/JobFavorites";
import type { SidebarCustomizationPayload } from "../trigger/components/navigation/CustomizeSidebarDialog";

const visibleSectionIds = new Set(["favorites", "metrics"]);
const visibleItemIds = new Set(["jobs", "runs", "logs", "errors", "queues"]);

export function SkylineShell({ bootstrap, children }: { bootstrap: SkylineBootstrap; children?: React.ReactNode }) {
  const { preferences, adapter, warning } = useUiPreferences();
  const navigation = bootstrap.capabilities.navigation;
  const favorites = visibleFavorites(preferences.favorites, navigation).map(toJobFavorite);

  const update = (updater: (current: UiPreferences) => UiPreferences) => adapter.update(updater);
  const onFavoritesChange = (next: JobFavorite[]) => update((current) => ({
    ...current,
    favorites: mergeVisibleFavorites(current.favorites, next, navigation),
  }));
  const onCustomize = (payload: SidebarCustomizationPayload) => update((current) => ({
    ...current,
    sidebar: customizeSidebar(current, payload, new Set(favorites.map((favorite) => favorite.id))),
    favorites: customizeFavorites(current.favorites, payload),
  }));

  return <TriggerShell
    applicationName={bootstrap.applicationName}
    brandMark={<BrandMark name={bootstrap.applicationName} />}
    environmentLabel={bootstrap.environmentLabel}
    capabilities={{
      navigation,
      shell: bootstrap.capabilities.shell,
      help: bootstrap.capabilities.help,
    }}
    preferences={preferences.sidebar}
    appearance={{ theme: preferences.theme, contrast: preferences.contrast }}
    favorites={favorites}
    warning={warning}
    onFavoritesChange={onFavoritesChange}
    onPreferencesChange={(sidebar) => update((current) => ({
      ...current,
      sidebar: { ...current.sidebar, ...sidebar },
    }))}
    onAppearanceChange={(appearance) => update((current) => ({ ...current, ...appearance }))}
    onCustomize={onCustomize}
    panelPersistence={bootstrap.capabilities.shell.panelPersistence ? adapter : null}
  >{children}</TriggerShell>;
}

function toJobFavorite(favorite: FavoritePreference): JobFavorite {
  return { id: favorite.id, label: favorite.label, path: favorite.url, icon: favorite.icon };
}

function mergeVisibleFavorites(current: FavoritePreference[], next: JobFavorite[], navigation: Record<string, boolean>) {
  const dormant = current.filter((favorite) => !visibleFavorites([favorite], navigation).length);
  return [...next.map((favorite) => ({ id: favorite.id, label: favorite.label, url: favorite.path, icon: favorite.icon })), ...dormant];
}

function customizeSidebar(current: UiPreferences, payload: SidebarCustomizationPayload, visibleFavoriteIds: ReadonlySet<string>) {
  const sidebar = current.sidebar;
  const dormantSections = sidebar.sectionOrder.filter((id) => !visibleSectionIds.has(id));
  const sectionOrder = [...(payload.sectionOrder ?? ["favorites", "metrics"]), ...dormantSections];
  const dormantHidden = Object.fromEntries(Object.entries(sidebar.hiddenItems).filter(([id]) => !visibleItemIds.has(id) && !visibleFavoriteIds.has(id)));
  const dormantItemOrder = Object.fromEntries(Object.entries(sidebar.sectionItemOrder).filter(([id]) => !visibleSectionIds.has(id)));

  return {
    ...sidebar,
    sectionOrder,
    hiddenItems: { ...dormantHidden, ...(payload.hiddenItems ?? {}) },
    sectionItemOrder: { ...dormantItemOrder, ...(payload.sectionItemOrder ?? {}) },
  };
}

function customizeFavorites(current: FavoritePreference[], payload: SidebarCustomizationPayload) {
  const removed = new Set(payload.removedFavoriteIds ?? []);
  const labels = new Map(payload.favorites?.map((favorite) => [favorite.id, favorite.label]));
  const retained = current
    .filter((favorite) => !removed.has(favorite.id))
    .map((favorite) => ({ ...favorite, label: labels.get(favorite.id) ?? favorite.label }));
  if (!payload.favorites) return retained;
  const byId = new Map(retained.map((favorite) => [favorite.id, favorite]));
  const ordered = payload.favorites.flatMap(({ id }) => byId.get(id) ?? []);
  const orderedIds = new Set(ordered.map((favorite) => favorite.id));
  return [...ordered, ...retained.filter((favorite) => !orderedIds.has(favorite.id))];
}
