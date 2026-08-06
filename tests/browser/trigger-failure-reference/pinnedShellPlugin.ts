import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Plugin } from "vite";

export function pinnedShell(appRoot: string): Plugin {
  const sideMenuId = "virtual:pinned-trigger-side-menu";
  const sideMenuResolvedId = `${resolve(appRoot, "components/navigation/SideMenu.tsx")}?pinned-shell`;
  const sideMenuItemId = "\0virtual:pinned-trigger-side-menu-item.tsx";
  const sideMenuItemSourceId = `${resolve(appRoot, "components/navigation/SideMenuItem.tsx")}?pinned-shell-source`;
  const sideMenuSectionId = "\0virtual:pinned-trigger-side-menu-section.tsx";
  const sideMenuSectionSourceId = `${resolve(appRoot, "components/navigation/SideMenuSection.tsx")}?pinned-shell-source`;
  const customizeSidebarId = "\0virtual:pinned-trigger-customize-sidebar.tsx";
  const customizeSidebarSourceId = `${resolve(appRoot, "components/navigation/CustomizeSidebarDialog.tsx")}?pinned-shell-source`;
  const stubPrefix = "\0virtual:pinned-trigger-side-menu-stub:";
  const stubs = new Map<string, string>([
    ["~/hooks/useFeatureFlags", "export const useFeatureFlags = () => ({ hasAiAccess: false, hasQueryAccess: true, hasLogsPageAccess: true, isTaskRunMetricsEnabled: false });"],
    ["~/hooks/useFeatures", "export const useFeatures = () => ({ isManagedCloud: false });"],
    ["~/hooks/useShowSelfServe", "export const useShowSelfServe = () => false;"],
    ["~/hooks/useUser", "export const useHasAdminAccess = () => false; export const useIsViewingAsUser = () => false; export const useOptionalUser = () => undefined;"],
    ["~/routes/_app.orgs.$organizationSlug/route", "export const useCurrentPlan = () => undefined; export const useIsUsingRbacPlugin = () => false; export const useIsUsingSsoPlugin = () => false;"],
    ["~/routes/resources.incidents", "export const useIncidentStatus = () => ({ hasIncident: false, title: undefined, isManagedCloud: false }); export const IncidentStatusPanel = () => null;"],
    ["~/routes/resources.platform-changelogs", "export const useRecentChangelogs = () => ({ changelogs: [] });"],
    ["~/components/AskAI", "export const AskAIRoot = ({ children }) => children(undefined);"],
    ["~/components/Feedback", "export const Feedback = () => null;"],
    ["~/components/UserProfilePhoto", "export const UserProfilePhoto = () => null;"],
    ["~/components/integrations/VercelLogo", "export const VercelLogo = () => null;"],
    ["~/components/primitives/Avatar", "export const Avatar = ({ children }) => children ?? null;"],
    ["~/components/billing/FreePlanUsage", "export const FreePlanUsage = () => null;"],
    ["~/components/DevPresence", "export const useDevPresence = () => ({ isConnected: undefined }); export const ConnectionIcon = () => null; export const DevPresencePanel = () => null;"],
    ["~/components/FeatureBadges", "export const AlphaBadge = () => null; export const NewBadge = () => null;"],
    ["~/components/navigation/DashboardDialogs", "export const CreateDashboardButton = () => null;"],
    ["~/components/navigation/DashboardList", "export const DashboardList = () => null;"],
    ["~/components/navigation/NotificationPanel", "export const NotificationPanel = () => null;"],
    ["~/components/navigation/favoritePages", favoritePagesStub()],
    ["../billing/FreePlanUsage", "export const FreePlanUsage = () => null;"],
    ["../DevPresence", "export const useDevPresence = () => ({ isConnected: undefined }); export const ConnectionIcon = () => null; export const DevPresencePanel = () => null;"],
    ["../FeatureBadges", "export const AlphaBadge = () => null; export const NewBadge = () => null;"],
    ["./DashboardDialogs", "export const CreateDashboardButton = () => null;"],
    ["./DashboardList", "export const DashboardList = () => null;"],
    ["./NotificationPanel", "export const NotificationPanel = () => null;"],
    ["./favoritePages", favoritePagesStub()],
  ]);

  return {
    name: "pinned-trigger-shell",
    enforce: "pre",
    resolveId(id, importer) {
      if (id === sideMenuId) return sideMenuResolvedId;
      if (id === "virtual:pinned-trigger-side-menu-item-source") return sideMenuItemSourceId;
      if (id === "virtual:pinned-trigger-side-menu-section-source") return sideMenuSectionSourceId;
      if (id === "virtual:pinned-trigger-customize-sidebar-source") return customizeSidebarSourceId;
      if (id === "./SideMenuItem") return sideMenuItemId;
      if (id === "./SideMenuSection") return sideMenuSectionId;
      if (id === "./CustomizeSidebarDialog") return customizeSidebarId;
      const normalizedId = id.startsWith(appRoot)
        ? `~${id.slice(appRoot.length).replace(/\.(?:ts|tsx)$/, "")}`
        : id;
      if (stubs.has(normalizedId)) return `${stubPrefix}${normalizedId}`;
      return undefined;
    },
    async load(id) {
      if (id.startsWith(stubPrefix)) return stubs.get(id.slice(stubPrefix.length));
      if (id === sideMenuItemId) return `
import React from "react";
import { SideMenuItem as SourceSideMenuItem, SideMenuItemButton as SourceSideMenuItemButton, SideMenuLabel } from "virtual:pinned-trigger-side-menu-item-source";
export { SideMenuLabel };
export function SideMenuItem(props) {
  const fixtureCapabilitiesEnabled = localStorage.getItem("skyline.ui-preferences.v1:/skyline") !== null;
  const supported = ["tasks", "runs", "logs", "errors", "queues", "favorite"];
  return fixtureCapabilitiesEnabled && props["data-action"] && !supported.includes(props["data-action"]) ? null : React.createElement(SourceSideMenuItem, props);
}
export const SideMenuItemButton = React.forwardRef(function SideMenuItemButton(props, ref) {
  const fixtureCapabilitiesEnabled = localStorage.getItem("skyline.ui-preferences.v1:/skyline") !== null;
  return fixtureCapabilitiesEnabled && props["data-action"] && props["data-action"] !== "shortcuts" ? null : React.createElement(SourceSideMenuItemButton, { ...props, ref });
});`;
      if (id === sideMenuSectionId) return `
import React from "react";
import { SideMenuSection as SourceSideMenuSection } from "virtual:pinned-trigger-side-menu-section-source";
export function SideMenuSection(props) {
  const fixtureCapabilitiesEnabled = localStorage.getItem("skyline.ui-preferences.v1:/skyline") !== null;
  return !fixtureCapabilitiesEnabled || ["Favorites", "Observability"].includes(props.title) ? React.createElement(SourceSideMenuSection, props) : null;
}`;
      if (id === customizeSidebarId) return `
import React from "react";
import { CustomizeSidebarDialog as SourceCustomizeSidebarDialog } from "virtual:pinned-trigger-customize-sidebar-source";
export function CustomizeSidebarDialog(props) {
  const sections = props.sections.flatMap((section) => {
    if (section.id === "favorites") return [{ ...section, items: section.items.filter((item) => item.id !== "future-query") }];
    if (section.id === "metrics") return [{ ...section, items: section.items.filter((item) => ["logs", "errors", "queues"].includes(item.id)) }];
    return [];
  });
  return React.createElement(SourceCustomizeSidebarDialog, { ...props, sections });
}`;
      if (id === sideMenuItemSourceId) return readFileSync(resolve(appRoot, "components/navigation/SideMenuItem.tsx"), "utf8");
      if (id === sideMenuSectionSourceId) return readFileSync(resolve(appRoot, "components/navigation/SideMenuSection.tsx"), "utf8");
      if (id === customizeSidebarSourceId) return readFileSync(resolve(appRoot, "components/navigation/CustomizeSidebarDialog.tsx"), "utf8");
      const normalizedId = id.startsWith(appRoot)
        ? `~${id.slice(appRoot.length).replace(/\?.*$/, "").replace(/\.(?:ts|tsx)$/, "")}`
        : id;
      if (stubs.has(normalizedId)) return stubs.get(normalizedId);
      if (id !== sideMenuResolvedId) return undefined;
      return readFileSync(resolve(appRoot, "components/navigation/SideMenu.tsx"), "utf8");
    },
  };
}

function favoritePagesStub() {
  return `
import { TasksIcon } from "~/assets/icons/TasksIcon";
export const FAVORITES_ACTION_PATH = "/resources/preferences/favorites";
export const useFavorites = () => globalThis.__pinnedTriggerFavorites ?? [];
export const useActiveFavoriteId = () => undefined;
export const favoriteLinkTo = (favorite) => favorite.url;
export const favoritePageIcon = () => TasksIcon;
export const favoritePageIconClassName = () => "";
export const favoritePageActiveColor = () => "text-tasks";
export const isFavoriteActive = (favorite, pathname, search) => favorite.url === pathname + search;
`;
}
