/*!
 * Adapted from Trigger.dev apps/webapp/app/components/navigation/SideMenu.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Tenant/server inputs are replaced by explicit capabilities and external preferences.
 */
import {
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  Squares2X2Icon,
} from "@heroicons/react/20/solid";
import { useLocation } from "@remix-run/react";
import { type CSSProperties, type FunctionComponent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { BugIcon } from "~/assets/icons/BugIcon";
import { DevEnvironmentIconSmall, ProdEnvironmentIconSmall } from "~/assets/icons/EnvironmentIcons";
import { FolderOpenIcon } from "~/assets/icons/FolderOpenIcon";
import { LogsIcon } from "~/assets/icons/LogsIcon";
import { LeftSideMenuCollapsedIcon } from "~/assets/icons/LeftSideMenuCollapsedIcon";
import { LeftSideMenuIcon } from "~/assets/icons/LeftSideMenuIcon";
import { QueuesIcon } from "~/assets/icons/QueuesIcon";
import { RunsIcon } from "~/assets/icons/RunsIcon";
import { TasksIcon } from "~/assets/icons/TasksIcon";
import { useShortcutKeys } from "~/hooks/useShortcutKeys";
import { cn } from "~/utils/cn";
import { Dialog } from "../primitives/Dialog";
import { Button } from "../primitives/Buttons";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/Popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/Tooltip";
import {
  CustomizeSidebarDialog,
  type CustomizeSidebarSection,
  type SidebarCustomizationPayload,
} from "./CustomizeSidebarDialog";
import { useJobFavorites } from "./JobFavorites";
import { SideMenuSection } from "./SideMenuSection";
import { SideMenuItem } from "./SideMenuItem";
import { isItemHidden, orderByPreference } from "./sideMenuTypes";
import { AppearanceMenu, type AppearancePreference } from "./AppearanceMenu";
import { HelpMenu, type HelpCapabilities } from "./HelpMenu";
import { ShortcutsDialog } from "./ShortcutsDialog";

const COLLAPSED_WIDTH = 44;
const DEFAULT_WIDTH = 224;
const MAX_WIDTH = 400;

export type SideMenuPreferences = {
  isCollapsed: boolean;
  width: number;
  sectionOrder: string[];
  collapsedSections: Record<string, boolean>;
  hiddenItems: Record<string, boolean>;
  sectionItemOrder: Record<string, string[]>;
};

export type { AppearancePreference } from "./AppearanceMenu";

type ShellCapabilities = {
  appearance: boolean;
  sidebarCustomization: boolean;
  favorites: boolean;
  panelPersistence: boolean;
  shortcuts: boolean;
  account: boolean;
  notifications: boolean;
  jobGuidance: boolean;
  organizationSwitching: boolean;
  projectSwitching: boolean;
  environmentSwitching: boolean;
  accountOpening: boolean;
};

export type SideMenuCapabilities = {
  navigation: {
    jobs: boolean;
    runs: boolean;
    sessions: boolean;
    prompts: boolean;
    models: boolean;
    errors: boolean;
    logs: boolean;
    queues: boolean;
    query: boolean;
    dashboards: boolean;
    deployments: boolean;
    environmentVariables: boolean;
    previewBranches: boolean;
    regions: boolean;
    waitpointTokens: boolean;
    batches: boolean;
    bulkActions: boolean;
    apiKeys: boolean;
    concurrency: boolean;
    limits: boolean;
    integrations: boolean;
    schedules: boolean;
    waitpoints: boolean;
    alerts: boolean;
    settings: boolean;
  };
  shell: ShellCapabilities;
  help: HelpCapabilities;
};

type SideMenuProps = {
  applicationName: string;
  brandMark: React.ReactNode;
  environmentLabel: string;
  capabilities: SideMenuCapabilities;
  preferences: SideMenuPreferences;
  appearance: AppearancePreference;
  warning: string | null;
  onPreferencesChange: (preferences: Partial<SideMenuPreferences>) => void;
  onAppearanceChange: (appearance: Partial<AppearancePreference>) => void;
  onCustomize: (payload: SidebarCustomizationPayload) => void;
};

type MenuItem = {
  id: string;
  name: string;
  to: string;
  icon: FunctionComponent<{ className?: string }>;
  activeIconColor: string;
  capability: keyof SideMenuCapabilities["navigation"];
  defaultHidden?: boolean;
};

type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

export function SideMenu({ applicationName, brandMark, environmentLabel, capabilities, preferences, appearance, warning, onPreferencesChange, onAppearanceChange, onCustomize }: SideMenuProps) {
  const location = useLocation();
  const favorites = useJobFavorites();
  const visibleFavorites = favorites.filter((favorite) => !preferences.hiddenItems[favorite.id]);
  const [width, setWidth] = useState(preferences.isCollapsed ? COLLAPSED_WIDTH : preferences.width);
  const widthRef = useRef(width);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcutsReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const collapsed = width <= COLLAPSED_WIDTH;
  const progress = Math.min(1, Math.max(0, (DEFAULT_WIDTH - width) / (DEFAULT_WIDTH - COLLAPSED_WIDTH)));
  const labelOpacity = Math.min(1, Math.max(0, (0.6 - progress) / 0.6));

  useEffect(() => {
    const next = preferences.isCollapsed ? COLLAPSED_WIDTH : preferences.width;
    widthRef.current = next;
    setWidth(next);
  }, [preferences.isCollapsed, preferences.width]);

  const settle = useCallback((value: number) => {
    widthRef.current = value;
    setWidth(value);
  }, []);

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    settle(next ? COLLAPSED_WIDTH : preferences.width);
    onPreferencesChange({ isCollapsed: next });
  }, [collapsed, onPreferencesChange, preferences.width, settle]);

  useShortcutKeys({
    shortcut: capabilities.shell.sidebarCustomization ? { modifiers: ["mod"], key: "b", enabledOnInputElements: true } : undefined,
    action: toggleCollapsed,
  });
  useShortcutKeys({
    shortcut: capabilities.shell.shortcuts ? { modifiers: ["shift"], key: "?" } : undefined,
    action: () => {
      shortcutsReturnFocusRef.current = null;
      setShortcutsOpen(true);
    },
  });

  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    let dragged = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      if (Math.abs(delta) < 4 && !dragged) return;
      dragged = true;
      settle(Math.min(MAX_WIDTH, Math.max(COLLAPSED_WIDTH, startWidth + delta)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!dragged) {
        toggleCollapsed();
        return;
      }
      const current = widthRef.current;
      if (current < 134) {
        settle(COLLAPSED_WIDTH);
        onPreferencesChange({ isCollapsed: true });
      } else {
        const next = current < DEFAULT_WIDTH ? DEFAULT_WIDTH : Math.round(current);
        settle(next);
        onPreferencesChange({ isCollapsed: false, width: next });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const topItems: MenuItem[] = [
    { id: "tasks", name: "Tasks", to: "/jobs", icon: TasksIcon, activeIconColor: "text-tasks", capability: "jobs" },
    { id: "runs", name: "Runs", to: "/runs", icon: RunsIcon, activeIconColor: "text-runs", capability: "runs" },
    { id: "sessions", name: "Sessions", to: "/sessions", icon: Squares2X2Icon, activeIconColor: "text-text-bright", capability: "sessions" },
  ];
  const staticSections: MenuSection[] = [
    {
      id: "ai",
      title: "AI",
      items: [
        { id: "prompts", name: "Prompts", to: "/prompts", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "prompts" },
        { id: "models", name: "Models", to: "/models", icon: Squares2X2Icon, activeIconColor: "text-text-bright", capability: "models" },
      ],
    },
    {
      id: "metrics",
      title: "Observability",
      items: [
        { id: "logs", name: "Logs", to: "/logs", icon: LogsIcon, activeIconColor: "text-text-bright", capability: "logs" },
        { id: "errors", name: "Errors", to: "/errors", icon: BugIcon, activeIconColor: "text-error", capability: "errors" },
        { id: "query", name: "Query", to: "/query", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "query" },
        { id: "queues", name: "Queues", to: "/queues", icon: QueuesIcon, activeIconColor: "text-queues", capability: "queues" },
        { id: "dashboards", name: "Dashboards", to: "/dashboards", icon: ChartBarIcon, activeIconColor: "text-text-bright", capability: "dashboards" },
      ],
    },
    {
      id: "deployments",
      title: "Deployments",
      items: [
        { id: "deployments", name: "Deploys", to: "/deployments", icon: Squares2X2Icon, activeIconColor: "text-text-bright", capability: "deployments" },
        { id: "environment-variables", name: "Environment variables", to: "/environment-variables", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "environmentVariables" },
        { id: "preview-branches", name: "Preview branches", to: "/preview-branches", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "previewBranches" },
        { id: "regions", name: "Regions", to: "/regions", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "regions" },
      ],
    },
    {
      id: "manage",
      title: "Manage",
      items: [
        { id: "waitpoint-tokens", name: "Waitpoint tokens", to: "/waitpoint-tokens", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "waitpointTokens" },
        { id: "batches", name: "Batches", to: "/batches", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "batches" },
        { id: "bulk-actions", name: "Bulk actions", to: "/bulk-actions", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "bulkActions" },
        { id: "api-keys", name: "API keys", to: "/api-keys", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "apiKeys" },
        { id: "alerts", name: "Alerts", to: "/alerts", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "alerts" },
        { id: "concurrency", name: "Concurrency", to: "/concurrency", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "concurrency" },
        { id: "limits", name: "Limits", to: "/limits", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "limits" },
        { id: "integrations", name: "Integrations", to: "/integrations", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "integrations" },
        { id: "schedules", name: "Schedules", to: "/schedules", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "schedules" },
        { id: "waitpoints", name: "Waitpoints", to: "/waitpoints", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "waitpoints" },
        { id: "settings", name: "Settings", to: "/settings", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "settings" },
      ],
    },
  ];
  const visibleSections = staticSections
    .map((section) => ({
      ...section,
      items: orderByPreference(section.items, preferences.sectionItemOrder[section.id])
        .filter((item) => capabilities.navigation[item.capability] === true && !isItemHidden(item, preferences.hiddenItems)),
    }))
    .filter((section) => section.items.length > 0);
  const sections = orderByPreference([
    ...(favorites.length > 0 ? [{ id: "favorites", title: "Favorites", items: [] as MenuItem[] }] : []),
    ...visibleSections,
  ], preferences.sectionOrder);
  const customizeSections: CustomizeSidebarSection[] = [
    ...(favorites.length > 0 ? [{ id: "favorites", title: "Favorites", items: favorites.map((favorite) => ({ id: favorite.id, name: favorite.label, icon: TasksIcon, isFavorite: true })) }] : []),
    ...staticSections.flatMap((section) => {
      const items = section.items
        .filter((item) => capabilities.navigation[item.capability] === true)
        .map((item) => ({ id: item.id, name: item.name, icon: item.icon, defaultHidden: item.defaultHidden }));
      return items.length > 0 ? [{ id: section.id, title: section.title, items }] : [];
    }),
  ];

  const style = { width, "--sm-collapse": progress, "--sm-label-opacity": labelOpacity } as CSSProperties;
  const sideMenuPadding = "calc(0.625rem - 0.375rem * var(--sm-collapse, 0))";
  return (
    <aside data-testid="side-menu" className="relative h-full border-r border-grid-bright bg-background-bright" style={style}>
      <div data-testid="side-menu-resizer" role="separator" aria-orientation="vertical" aria-label="Resize side menu" className="group/resize absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none" onPointerDown={resize}>
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.75 -translate-x-1/2 bg-indigo-500 opacity-0 transition-opacity duration-300 group-hover/resize:opacity-100" />
      </div>
      <div className="absolute inset-0 grid grid-cols-[100%] grid-rows-[2.5rem_auto_1fr_auto_auto] overflow-hidden">
        <div className="flex min-w-0 items-center overflow-hidden border-b border-transparent px-1 py-1">
        <div className="flex h-8 w-full items-center rounded pl-1.75 pr-1">
          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {brandMark}
            <span className="min-w-0 truncate text-[0.90625rem] font-medium tracking-[-0.01em] text-text-bright" style={{ opacity: labelOpacity }}>{applicationName}</span>
          </span>
        </div>
        </div>
        <div data-testid="side-menu-project" className="border-b border-grid-bright pb-2.5 pt-1" style={{ paddingLeft: sideMenuPadding, paddingRight: sideMenuPadding }}>
        <div className="w-full space-y-1">
          <div className="flex h-4 items-center overflow-hidden pl-1.5 text-xs">
            <span className="whitespace-nowrap">Proj<span style={{ opacity: labelOpacity }}>ect</span></span>
          </div>
          <div className="space-y-1">
            <div className={cn("flex h-8 items-center rounded border pl-1.75", collapsed ? "justify-center border-transparent pr-0.5" : "border-grid-bright pr-1")}>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                <FolderOpenIcon className="size-5 shrink-0 text-text-bright" />
                <span className="min-w-0 truncate text-[0.90625rem] font-medium tracking-[-0.01em] text-text-bright" style={{ opacity: labelOpacity }}>{applicationName}</span>
              </span>
            </div>
            <div className={cn("flex h-8 items-center rounded pl-1.75", collapsed ? "justify-center pr-0.5" : "pr-1")}>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                <EnvironmentIcon environmentLabel={environmentLabel} />
                <span className="overflow-hidden whitespace-nowrap text-left system-mono-label text-prod text-[0.90625rem] font-medium tracking-[-0.01em]" style={{ opacity: labelOpacity }}>{environmentLabel}</span>
              </span>
            </div>
          </div>
        </div>
        </div>
        <div className="min-h-0 overflow-y-auto pt-2.5 scrollbar-gutter-stable scrollbar-thumb-on-hover">
          <nav aria-label="Application" className="mb-6 flex w-full flex-col gap-4 overflow-hidden" style={{ paddingLeft: sideMenuPadding, paddingRight: "0px" }}>
          <div className="w-full space-y-0">
          {topItems.filter((item) => capabilities.navigation[item.capability] === true).map((item) => <NavigationLink key={item.id} item={item} active={location.pathname.startsWith(item.to)} labelOpacity={labelOpacity} />)}
          </div>
          <div className="space-y-4">
          {sections.map((section) => section.id === "favorites" ? (
            <SideMenuSection key={`${section.id}:${Boolean(preferences.collapsedSections.favorites)}`} title={section.title} isSideMenuCollapsed={collapsed} initialCollapsed={preferences.collapsedSections.favorites} onCollapseToggle={(value) => onPreferencesChange({ collapsedSections: { ...preferences.collapsedSections, favorites: value } })}>
              <div role="navigation" aria-label="Favorites">{visibleFavorites.map((favorite) => <NavigationLink key={favorite.id} item={{ id: favorite.id, name: favorite.label, to: favorite.path, icon: TasksIcon, activeIconColor: "text-tasks", capability: "jobs" }} active={location.pathname === favorite.path} labelOpacity={labelOpacity} />)}</div>
            </SideMenuSection>
          ) : (
            <SideMenuSection key={`${section.id}:${Boolean(preferences.collapsedSections[section.id])}`} title={section.title} data-skyline-extension={section.id === "metrics" ? "shell-observability-header" : undefined} isSideMenuCollapsed={collapsed} initialCollapsed={preferences.collapsedSections[section.id]} onCollapseToggle={(value) => onPreferencesChange({ collapsedSections: { ...preferences.collapsedSections, [section.id]: value } })} headerMenu={capabilities.shell.sidebarCustomization ? <SidebarCustomizationMenu onCustomize={() => setCustomizeOpen(true)} /> : undefined}>
              {section.items.map((item) => <NavigationLink key={item.id} item={item} active={location.pathname.startsWith(item.to)} labelOpacity={labelOpacity} />)}
            </SideMenuSection>
          ))}
          </div>
          </nav>
        </div>
        <div data-testid="side-menu-appearance" className={cn(collapsed && "flex justify-center", "px-1")}>
          {capabilities.shell.appearance && <AppearanceMenu appearance={appearance} onChange={onAppearanceChange} collapsed={collapsed} labelOpacity={labelOpacity} />}
        </div>
        <div>
          <div className={cn("flex flex-col gap-1 border-t border-grid-bright p-1", collapsed && "items-center")}>
        {warning && <div role="status" className="mb-1 rounded bg-warning/10 px-2 py-1 text-xs text-warning" style={{ opacity: labelOpacity }}>{warning}</div>}
        <div className={cn("flex w-full", collapsed ? "flex-col-reverse gap-1" : "items-center justify-between")}>
          <DormantShellActions capabilities={capabilities.shell} />
          {capabilities.help.menu && <HelpMenu collapsed={collapsed} capabilities={capabilities.help} shortcutsOpen={shortcutsOpen} onOpenShortcuts={(returnFocus) => { shortcutsReturnFocusRef.current = returnFocus; setShortcutsOpen(true); }} labelOpacity={labelOpacity} />}
          <CollapseMenuButton collapsed={collapsed} onToggle={toggleCollapsed} />
        </div>
        </div>
        </div>
      </div>
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        {customizeOpen && <CustomizeSidebarDialog sections={customizeSections} prefs={preferences} onConfirm={(payload) => { onCustomize(payload); setCustomizeOpen(false); }} isConfirming={false} />}
      </Dialog>
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} returnFocus={shortcutsReturnFocusRef.current} />
    </aside>
  );
}

function CollapseMenuButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [hovering, setHovering] = useState(false);
  return <div><TooltipProvider disableHoverableContent><Tooltip delayDuration={collapsed ? 0 : 500}><TooltipTrigger asChild><span className={cn("inline-flex h-8", collapsed && "w-full")} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}><Button variant="small-menu-item" aria-label={collapsed ? "Expand side menu" : "Collapse side menu"} onClick={onToggle} fullWidth={collapsed} className={cn("h-full", collapsed && "justify-center")}>{collapsed ? <LeftSideMenuCollapsedIcon className={cn("size-5 transition-colors", hovering ? "text-text-bright" : "text-text-dimmed")} /> : <LeftSideMenuIcon className={cn("size-5 transition-colors", hovering ? "text-text-bright" : "text-text-dimmed")} hovered={hovering} />}</Button></span></TooltipTrigger><TooltipContent side="right" sideOffset={8} className="text-xs">{collapsed ? "Expand" : "Collapse"}</TooltipContent></Tooltip></TooltipProvider></div>;
}

function NavigationLink({ item, active, labelOpacity }: { item: MenuItem; active: boolean; labelOpacity: number }) {
  const extension = ["logs", "errors", "queues"].includes(item.id) ? `shell-${item.id}-navigation` : undefined;
  return <SideMenuItem name={item.name} to={item.to} icon={item.icon} activeIconColor={item.activeIconColor} active={active} isCollapsed={labelOpacity === 0} data-action={item.id} data-skyline-extension={extension} />;
}

function EnvironmentIcon({ environmentLabel }: { environmentLabel: string }) {
  const Icon = environmentLabel.toLowerCase().includes("dev") ? DevEnvironmentIconSmall : ProdEnvironmentIconSmall;
  return <Icon className="size-5 shrink-0 text-prod" />;
}

function SidebarCustomizationMenu({ onCustomize }: { onCustomize: () => void }) {
  return <Popover><PopoverTrigger asChild><button type="button" aria-label="Sidebar options" className="rounded p-1 text-text-dimmed hover:bg-background-hover hover:text-text-bright"><AdjustmentsHorizontalIcon className="size-4" /></button></PopoverTrigger><PopoverContent align="start" sideOffset={4} className="p-1"><button type="button" onClick={onCustomize} className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[0.90625rem] font-medium text-text-dimmed hover:bg-background-hover hover:text-text-bright"><AdjustmentsHorizontalIcon className="size-4" />Customize sidebar</button></PopoverContent></Popover>;
}

function DormantShellActions({ capabilities }: { capabilities: ShellCapabilities }) {
  const actions = [
    [capabilities.notifications, "Notifications"],
    [capabilities.account || capabilities.accountOpening, "Account"],
    [capabilities.organizationSwitching, "Switch organization"],
    [capabilities.projectSwitching, "Switch project"],
    [capabilities.environmentSwitching, "Switch environment"],
  ] as const;

  return <>{actions.map(([available, label]) => available
    ? <button key={label} type="button" className="flex h-8 items-center rounded px-2 text-text-dimmed hover:bg-background-hover hover:text-text-bright focus-custom">{label}</button>
    : null)}</>;
}
