import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Plugin } from "vite";

export function pinnedShell(appRoot: string): Plugin {
  const sideMenuId = "virtual:pinned-trigger-side-menu";
  const sideMenuResolvedId = `${resolve(appRoot, "components/navigation/SideMenu.tsx")}?pinned-shell`;
  const stubPrefix = "\0virtual:pinned-trigger-side-menu-stub:";
  const stubs = new Map<string, string>([
    ["~/hooks/useFeatureFlags", "export const useFeatureFlags = () => ({ hasAiAccess: false, hasQueryAccess: true, hasLogsPageAccess: true, isTaskRunMetricsEnabled: false });"],
    ["~/hooks/useFeatures", "export const useFeatures = () => ({ isManagedCloud: false });"],
    ["~/hooks/useShortcutKeys", "export const useShortcutKeys = () => undefined;"],
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
    ["~/components/navigation/FavoritesSection", "export const FavoriteMenuItem = () => null;"],
    ["~/components/navigation/favoritePages", "export const FAVORITES_ACTION_PATH = '/resources/preferences/favorites'; export const useFavorites = () => []; export const useActiveFavoriteId = () => undefined; export const favoriteLinkTo = () => '/'; export const favoritePageIcon = () => () => null; export const favoritePageIconClassName = () => '';"],
    ["../billing/FreePlanUsage", "export const FreePlanUsage = () => null;"],
    ["../DevPresence", "export const useDevPresence = () => ({ isConnected: undefined }); export const ConnectionIcon = () => null; export const DevPresencePanel = () => null;"],
    ["../FeatureBadges", "export const AlphaBadge = () => null; export const NewBadge = () => null;"],
    ["./DashboardDialogs", "export const CreateDashboardButton = () => null;"],
    ["./DashboardList", "export const DashboardList = () => null;"],
    ["./NotificationPanel", "export const NotificationPanel = () => null;"],
    ["./FavoritesSection", "export const FavoriteMenuItem = () => null;"],
    ["./favoritePages", "export const FAVORITES_ACTION_PATH = '/resources/preferences/favorites'; export const useFavorites = () => []; export const useActiveFavoriteId = () => undefined; export const favoriteLinkTo = () => '/'; export const favoritePageIcon = () => () => null; export const favoritePageIconClassName = () => '';"],
  ]);

  return {
    name: "pinned-trigger-shell",
    enforce: "pre",
    resolveId(id, importer) {
      if (id === sideMenuId) return sideMenuResolvedId;
      const normalizedId = id.startsWith(appRoot)
        ? `~${id.slice(appRoot.length).replace(/\.(?:ts|tsx)$/, "")}`
        : id;
      if (stubs.has(normalizedId)) return `${stubPrefix}${normalizedId}`;
      return undefined;
    },
    async load(id) {
      if (id.startsWith(stubPrefix)) return stubs.get(id.slice(stubPrefix.length));
      const normalizedId = id.startsWith(appRoot)
        ? `~${id.slice(appRoot.length).replace(/\?.*$/, "").replace(/\.(?:ts|tsx)$/, "")}`
        : id;
      if (stubs.has(normalizedId)) return stubs.get(normalizedId);
      if (id !== sideMenuResolvedId) return undefined;
      return readFileSync(resolve(appRoot, "components/navigation/SideMenu.tsx"), "utf8");
    },
  };
}
