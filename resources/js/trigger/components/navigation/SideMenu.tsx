/*!
 * Adapted from Trigger.dev apps/webapp/app/components/navigation/SideMenu.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Tenant/server inputs are replaced by explicit capabilities and external preferences.
 */
import {
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  MoonIcon,
  PlayIcon,
  QuestionMarkCircleIcon,
  SunIcon,
  SwatchIcon,
  Squares2X2Icon,
} from "@heroicons/react/20/solid";
import { Link, useLocation } from "@remix-run/react";
import { type CSSProperties, type FunctionComponent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { KeyboardIcon } from "~/assets/icons/KeyboardIcon";
import { BugIcon } from "~/assets/icons/BugIcon";
import { LogsIcon } from "~/assets/icons/LogsIcon";
import { QueuesIcon } from "~/assets/icons/QueuesIcon";
import { TaskIcon } from "~/assets/icons/TaskIcon";
import { useShortcutKeys } from "~/hooks/useShortcutKeys";
import { cn } from "~/utils/cn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../primitives/Dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/Popover";
import { Label } from "../primitives/Label";
import { Select, SelectItem } from "../primitives/Select";
import { ShortcutKey } from "../primitives/ShortcutKey";
import { Slider } from "../primitives/Slider";
import {
  CustomizeSidebarDialog,
  type CustomizeSidebarSection,
  type SidebarCustomizationPayload,
} from "./CustomizeSidebarDialog";
import { useJobFavorites } from "./JobFavorites";
import { SideMenuSection } from "./SideMenuSection";
import { isItemHidden, orderByPreference } from "./sideMenuTypes";

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

export type AppearancePreference = {
  theme: "classic" | "system" | "dark" | "light";
  contrast: number;
};

const themePreferences: AppearancePreference["theme"][] = ["classic", "system", "dark", "light"];

type SideMenuProps = {
  applicationName: string;
  brandMark: React.ReactNode;
  environmentLabel: string;
  capabilities: {
    navigation: Record<string, boolean>;
    shell: Record<string, boolean>;
    help: Record<string, boolean>;
  };
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
  capability: string;
  defaultHidden?: boolean;
};

export function SideMenu({ applicationName, brandMark, environmentLabel, capabilities, preferences, appearance, warning, onPreferencesChange, onAppearanceChange, onCustomize }: SideMenuProps) {
  const location = useLocation();
  const favorites = useJobFavorites();
  const [width, setWidth] = useState(preferences.isCollapsed ? COLLAPSED_WIDTH : preferences.width);
  const widthRef = useRef(width);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
    action: () => setShortcutsOpen(true),
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
    { id: "jobs", name: "Jobs", to: "/jobs", icon: TaskIcon, activeIconColor: "text-tasks", capability: "jobs" },
    { id: "runs", name: "Runs", to: "/runs", icon: PlayIcon, activeIconColor: "text-runs", capability: "runs" },
  ];
  const observabilityItems: MenuItem[] = [
    { id: "logs", name: "Logs", to: "/logs", icon: LogsIcon, activeIconColor: "text-text-bright", capability: "logs" },
    { id: "errors", name: "Errors", to: "/errors", icon: BugIcon, activeIconColor: "text-error", capability: "errors" },
    { id: "query", name: "Query", to: "/query", icon: AdjustmentsHorizontalIcon, activeIconColor: "text-text-bright", capability: "query" },
    { id: "queues", name: "Queues", to: "/queues", icon: QueuesIcon, activeIconColor: "text-queues", capability: "queues" },
    { id: "dashboards", name: "Dashboards", to: "/dashboards", icon: ChartBarIcon, activeIconColor: "text-text-bright", capability: "dashboards" },
  ];
  const visibleObservability = orderByPreference(observabilityItems, preferences.sectionItemOrder.metrics)
    .filter((item) => capabilities.navigation[item.capability] === true && !isItemHidden(item, preferences.hiddenItems));
  const sections = orderByPreference([
    ...(favorites.length > 0 ? [{ id: "favorites", title: "Favorites" }] : []),
    { id: "metrics", title: "Observability" },
  ], preferences.sectionOrder);
  const customizeSections: CustomizeSidebarSection[] = [
    ...(favorites.length > 0 ? [{ id: "favorites", title: "Favorites", items: favorites.map((favorite) => ({ id: favorite.id, name: favorite.label, icon: TaskIcon, isFavorite: true })) }] : []),
    { id: "metrics", title: "Observability", items: observabilityItems.filter((item) => capabilities.navigation[item.capability] === true).map((item) => ({ id: item.id, name: item.name, icon: item.icon, defaultHidden: item.defaultHidden })) },
  ];

  const style = { width, "--sm-collapse": progress, "--sm-label-opacity": labelOpacity } as CSSProperties;
  return (
    <aside data-testid="side-menu" className="relative flex h-full min-w-0 flex-col border-r border-grid-bright bg-background-bright" style={style}>
      <div className="flex h-10 min-w-0 items-center gap-2 border-b border-transparent px-1 py-1">
        <div className="flex size-8 shrink-0 items-center justify-center">{brandMark}</div>
        <span className="min-w-0 truncate text-[0.90625rem] font-semibold text-text-bright" style={{ opacity: labelOpacity }}>{applicationName}</span>
      </div>
      <div className="border-b border-grid-bright px-2 pb-2.5 pt-1">
        <div className="mb-1 truncate px-1 text-xs text-text-faint" style={{ opacity: labelOpacity }}>Application environment</div>
        <div className="flex h-8 items-center gap-2 rounded px-1 text-prod">
          <Squares2X2Icon className="size-5 shrink-0" />
          <span className="truncate font-medium capitalize" style={{ opacity: labelOpacity }}>{environmentLabel}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2.5 scrollbar-thumb-on-hover">
        <nav aria-label="Application">
          <div className="mb-4">
          {topItems.filter((item) => capabilities.navigation[item.capability] === true).map((item) => <NavigationLink key={item.id} item={item} active={location.pathname.startsWith(item.to)} labelOpacity={labelOpacity} />)}
          </div>
          <div className="space-y-4">
          {sections.map((section) => section.id === "favorites" ? (
            <SideMenuSection key={section.id} title={section.title} isSideMenuCollapsed={collapsed} initialCollapsed={preferences.collapsedSections.favorites} onCollapseToggle={(value) => onPreferencesChange({ collapsedSections: { ...preferences.collapsedSections, favorites: value } })}>
              <div role="navigation" aria-label="Favorites">{favorites.map((favorite) => <NavigationLink key={favorite.id} item={{ id: favorite.id, name: favorite.label, to: favorite.path, icon: TaskIcon, activeIconColor: "text-tasks", capability: "jobs" }} active={location.pathname === favorite.path} labelOpacity={labelOpacity} />)}</div>
            </SideMenuSection>
          ) : (
            <SideMenuSection key={section.id} title={section.title} isSideMenuCollapsed={collapsed} initialCollapsed={preferences.collapsedSections.metrics} onCollapseToggle={(value) => onPreferencesChange({ collapsedSections: { ...preferences.collapsedSections, metrics: value } })} headerMenu={capabilities.shell.sidebarCustomization ? <button type="button" aria-label="Customize sidebar" onClick={() => setCustomizeOpen(true)} className="rounded p-1 text-text-dimmed hover:bg-background-hover hover:text-text-bright"><AdjustmentsHorizontalIcon className="size-4" /></button> : undefined}>
              {visibleObservability.map((item) => <NavigationLink key={item.id} item={item} active={location.pathname.startsWith(item.to)} labelOpacity={labelOpacity} />)}
            </SideMenuSection>
          ))}
          </div>
        </nav>
      </div>
      <div className="border-t border-grid-bright p-1">
        {warning && <div role="status" className="mb-1 rounded bg-warning/10 px-2 py-1 text-xs text-warning" style={{ opacity: labelOpacity }}>{warning}</div>}
        <div className={cn("flex gap-1", collapsed ? "flex-col" : "items-center")}>
          {capabilities.help.menu && <HelpMenu collapsed={collapsed} shortcuts={capabilities.help.shortcuts} onOpenShortcuts={() => setShortcutsOpen(true)} labelOpacity={labelOpacity} />}
          {capabilities.shell.appearance && <AppearanceMenu appearance={appearance} onChange={onAppearanceChange} collapsed={collapsed} labelOpacity={labelOpacity} />}
          <button type="button" aria-label={collapsed ? "Expand side menu" : "Collapse side menu"} onClick={toggleCollapsed} className="flex size-8 shrink-0 items-center justify-center rounded text-text-dimmed hover:bg-background-hover hover:text-text-bright focus-custom">
            {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronLeftIcon className="size-4" />}
          </button>
        </div>
      </div>
      <div data-testid="side-menu-resizer" className="group absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none" onPointerDown={resize}><div className="absolute inset-y-0 left-[3px] w-px bg-grid-bright group-hover:bg-indigo-500" /></div>
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        {customizeOpen && <CustomizeSidebarDialog sections={customizeSections} prefs={preferences} onConfirm={(payload) => { onCustomize(payload); setCustomizeOpen(false); }} isConfirming={false} />}
      </Dialog>
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </aside>
  );
}

function NavigationLink({ item, active, labelOpacity }: { item: MenuItem; active: boolean; labelOpacity: number }) {
  const ItemIcon = item.icon;
  return <Link to={item.to} aria-current={active ? "page" : undefined} className={cn("flex h-8 items-center gap-1.5 rounded pl-1.75 pr-2 text-[0.90625rem] font-medium tracking-[-0.01em] focus-custom", active ? "bg-background-raised text-text-bright" : "text-text-dimmed hover:bg-background-hover hover:text-text-bright")}>
    <ItemIcon className={cn("size-5 min-w-5 shrink-0", active ? item.activeIconColor : "text-text-dimmed")} />
    <span className="min-w-0 truncate" style={{ opacity: labelOpacity }}>{item.name}</span>
  </Link>;
}

function HelpMenu({ collapsed, shortcuts, onOpenShortcuts, labelOpacity }: { collapsed: boolean; shortcuts: boolean; onOpenShortcuts: () => void; labelOpacity: number }) {
  return <Popover><PopoverTrigger className={cn("flex h-8 items-center gap-1.5 rounded pl-1.75 pr-2 text-text-dimmed hover:bg-background-hover hover:text-text-bright focus-custom", collapsed ? "w-8" : "min-w-0 flex-1")}>
    <QuestionMarkCircleIcon className="size-5 min-w-5 text-success" /><span className="truncate text-[0.90625rem] font-medium" style={{ opacity: labelOpacity }}>Help &amp; Feedback</span>
  </PopoverTrigger><PopoverContent side={collapsed ? "right" : "top"} align="start" className="min-w-56 p-1">
    {shortcuts && <button type="button" onClick={onOpenShortcuts} className="flex h-8 w-full items-center gap-2 rounded px-2 text-left hover:bg-background-hover focus-custom"><KeyboardIcon className="size-5 text-text-dimmed" /><span className="flex-1">Shortcuts</span><ShortcutKey shortcut={{ modifiers: ["shift"], key: "?" }} variant="medium" /></button>}
  </PopoverContent></Popover>;
}

function AppearanceMenu({ appearance, onChange, collapsed, labelOpacity }: { appearance: AppearancePreference; onChange: (value: Partial<AppearancePreference>) => void; collapsed: boolean; labelOpacity: number }) {
  return <Popover><PopoverTrigger aria-label="Appearance" className={cn("flex h-8 items-center gap-1.5 rounded pl-1.75 pr-2 text-text-dimmed hover:bg-background-hover hover:text-text-bright focus-custom", collapsed ? "w-8" : "min-w-0 flex-1")}>
    {themeIcon(appearance.theme)}<span className="truncate text-[0.90625rem] font-medium" style={{ opacity: labelOpacity }}>Appearance</span>
  </PopoverTrigger><PopoverContent side={collapsed ? "right" : "top"} align="start" className="w-64 p-3">
    <div className="flex items-center justify-between gap-4"><Label>Interface theme</Label><Select<AppearancePreference["theme"], AppearancePreference["theme"]>
      aria-label="Interface theme"
      value={appearance.theme}
      setValue={(value) => onChange({ theme: value as AppearancePreference["theme"] })}
      variant="secondary/small"
      dropdownIcon
      items={themePreferences}
      text={(value) => <span className="flex items-center gap-1.5">{themeIcon(value)}{themeLabel(value)}</span>}
      className="w-44"
    >
      {(items) => items.map((item) => <SelectItem key={item} value={item} icon={themeIcon(item)}>{themeLabel(item)}</SelectItem>)}
    </Select></div>
    {appearance.theme !== "classic" && <div className="mt-4 flex items-center justify-between gap-4"><Label>Contrast</Label><Slider variant="settings" className="w-44" aria-label="Contrast" min={0} max={100} step={5} value={[appearance.contrast]} onValueChange={(values) => onChange({ contrast: values[0] ?? 50 })} /></div>}
  </PopoverContent></Popover>;
}

function themeLabel(theme: AppearancePreference["theme"]) {
  return { classic: "Classic", system: "System preference", dark: "Dark", light: "Light" }[theme];
}

function themeIcon(theme: AppearancePreference["theme"]) {
  if (theme === "classic") return <SwatchIcon className="size-5 min-w-5 text-text-dimmed" />;
  if (theme === "system") return <ComputerDesktopIcon className="size-5 min-w-5 text-text-dimmed" />;
  if (theme === "dark") return <span className="grid size-5 min-w-5 place-items-center"><MoonIcon className="size-4 text-text-dimmed" /></span>;
  return <SunIcon className="size-5 min-w-5 text-text-dimmed" />;
}

function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md p-4"><DialogHeader className="h-7"><DialogTitle className="flex items-center gap-2"><KeyboardIcon className="size-5" />Keyboard shortcuts</DialogTitle></DialogHeader><div className="mt-5 space-y-3"><ShortcutRow name="Close"><ShortcutKey shortcut={{ key: "esc" }} variant="medium/bright" /></ShortcutRow><ShortcutRow name="Filter"><ShortcutKey shortcut={{ key: "f" }} variant="medium/bright" /></ShortcutRow><ShortcutRow name="Toggle side menu"><ShortcutKey shortcut={{ modifiers: ["mod"], key: "b" }} variant="medium/bright" /></ShortcutRow><ShortcutRow name="Favorite this page"><ShortcutKey shortcut={{ modifiers: ["alt"], key: "f" }} variant="medium/bright" /></ShortcutRow><ShortcutRow name="Navigate"><ShortcutKey shortcut={{ key: "arrowup" }} variant="medium/bright" /><ShortcutKey shortcut={{ key: "arrowdown" }} variant="medium/bright" /></ShortcutRow></div></DialogContent></Dialog>;
}

function ShortcutRow({ name, children }: { name: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-sm text-text-dimmed">{name}</span><span className="flex gap-0.5">{children}</span></div>;
}
