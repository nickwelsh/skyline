import "non.geist";
import "non.geist/mono";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useLocation } from "react-router-dom";
import { PinnedTriggerErrors } from "virtual:pinned-trigger-errors";
import { PinnedTriggerRunError } from "virtual:pinned-trigger-run-error";
import { PinnedTriggerLogDetail } from "virtual:pinned-trigger-log-detail";
import { PinnedTriggerLogsTable } from "virtual:pinned-trigger-logs-table";
import { SideMenu as PinnedTriggerSideMenu } from "virtual:pinned-trigger-side-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../../resources/js/trigger/components/primitives/Resizable";
import { LocaleContextProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/LocaleProvider";
import { OperatingSystemContextProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../../../../trigger.dev/apps/webapp/app/components/primitives/ShortcutsProvider";
import errorsScenario from "../fixtures/nw-224-trigger-errors-scenario.json";
import scenario from "../fixtures/nw-222-failure-scenario.json";
import "./reference.css";
import logsBaseline from "../fixtures/nw-225-trigger-logs-baseline.json";

const triggerError = { ...scenario.triggerError, type: "BUILT_IN_ERROR" as const };
type TriggerFavorite = { id: string; label: string; url: string; icon?: string };
type TriggerSideMenuPreferences = { isCollapsed: boolean; width: number; sectionOrder: string[]; collapsedSections: Record<string, boolean>; hiddenItems: Record<string, boolean>; sectionItemOrder: Record<string, string[]> };
type TriggerShellPreferences = { version: 1; sidebar: TriggerSideMenuPreferences; favorites: TriggerFavorite[] };
const storageKey = "skyline.ui-preferences.v1:/skyline";
const defaultSideMenuPreferences: TriggerSideMenuPreferences = { isCollapsed: false, width: 224, sectionOrder: ["metrics"], collapsedSections: {}, hiddenItems: { prompts: true, models: true, query: true, dashboards: true, deployments: true, "environment-variables": true, "preview-branches": true, regions: true, "waitpoint-tokens": true, batches: true, "bulk-actions": true, "api-keys": true, alerts: true, limits: true, integrations: true }, sectionItemOrder: { metrics: ["logs", "errors", "queues"] } };
let applyTriggerShellPreferences: ((update: (current: TriggerShellPreferences) => TriggerShellPreferences) => void) | undefined;
let reportTriggerStorageFailure: (() => void) | undefined;

window.addEventListener("error", (event) => {
  document.body.textContent = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
});

function Reference() {
  const location = useLocation();
  if (location.pathname.startsWith("/errors")) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background-dimmed">
        <PinnedTriggerErrors
          scenario={errorsScenario}
          detail={location.pathname !== "/errors"}
        />
      </div>
    );
  }

  if (location.pathname.startsWith("/logs")) {
    return <PinnedLogs />;
  }

  if (location.pathname.startsWith("/shell")) {
    return <PinnedTriggerShell />;
  }

  return <div className="w-[488px]"><PinnedTriggerRunError error={triggerError} /></div>;
}

function PinnedTriggerShell() {
  const [preferences, setPreferences] = useState<TriggerShellPreferences>(readTriggerShellPreferences);
  const [storageWarning, setStorageWarning] = useState(false);
  const environment = { id: "environment", slug: "dev", type: "PRODUCTION", userName: "Production", shortcode: "prod" };
  const project = { id: "project", name: "Fixture Project", slug: "fixture", version: "V3", engine: "V1", environments: [environment], createdAt: new Date("2026-01-01T00:00:00Z") };
  const organization = { id: "organization", slug: "fixture", title: "Fixture Trigger", projects: [project] };
  Object.assign(globalThis, { __pinnedTriggerFavorites: preferences.favorites.filter(({ url }) => !url.startsWith("/query")) });
  useEffect(() => {
    applyTriggerShellPreferences = (update) => setPreferences((current) => persistTriggerShellPreferences(update(current)));
    reportTriggerStorageFailure = () => setStorageWarning(true);
    return () => { applyTriggerShellPreferences = undefined; reportTriggerStorageFailure = undefined; };
  }, []);

  return <div className="flex h-screen w-screen bg-background-dimmed text-text-bright">
    <PinnedTriggerSideMenu
      user={{ email: "fixture@trigger.dev", admin: true, isImpersonating: false, dashboardPreferences: { sideMenu: { ...preferences.sidebar, favorites: preferences.favorites } } }}
      project={project}
      environment={environment}
      organization={organization}
      organizations={[organization]}
    />
    <main className="flex-1 p-6"><h1 className="text-lg font-semibold">Runs</h1>{storageWarning ? <div role="status">Browser storage is unavailable. Preference changes will last for this tab only.</div> : null}</main>
  </div>;
}

function readTriggerShellPreferences(): TriggerShellPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<TriggerShellPreferences> | null;
    return {
      version: 1,
      sidebar: { ...defaultSideMenuPreferences, ...(stored?.sidebar ?? {}) },
      favorites: Array.isArray(stored?.favorites) ? stored.favorites : [],
    };
  } catch {
    return { version: 1, sidebar: defaultSideMenuPreferences, favorites: [] };
  }
}

function persistTriggerShellPreferences(preferences: TriggerShellPreferences) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    reportTriggerStorageFailure?.();
  }
  return preferences;
}

function PinnedLogs() {
  const referenceLogs = logsBaseline.referenceLogs as Array<{ id: string; runId: string; taskIdentifier: string; spanId: string; triggeredTimestamp: string; level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"; message: string; attributes: Record<string, unknown> }>;
  const [selectedId, setSelectedId] = useState<string>();
  const selected = referenceLogs.find((log) => log.id === selectedId);
  const select = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("log", id);
    window.history.replaceState(null, "", url);
  };
  const close = () => {
    setSelectedId(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("log");
    window.history.replaceState(null, "", url);
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => event.key === "Escape" && selectedId && close();
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [selectedId]);

  return <div className="h-screen w-screen overflow-hidden bg-background-dimmed"><ResizablePanelGroup orientation="horizontal" className="h-screen max-h-full"><ResizablePanel id="logs-main" min="200px"><PinnedTriggerLogsTable logs={referenceLogs} selectedLogId={selectedId} onLogSelect={select} /></ResizablePanel><ResizableHandle id="logs-handle" className={selected ? "" : "pointer-events-none opacity-0"} />{selected ? <ResizablePanel id="log-detail" default="430px" min="430px" max="600px"><PinnedTriggerLogDetail log={selected} onClose={close} /></ResizablePanel> : null}</ResizablePanelGroup></div>;
}

const router = createBrowserRouter([{ id: "root", path: "*", action: async ({ request }) => {
  if (new URL(request.url).pathname !== "/resources/preferences/sidemenu") return { success: false };
  const formData = await request.formData();
  const customization = formData.get("customization");
  applyTriggerShellPreferences?.((current) => {
    if (typeof customization === "string") {
      const payload = JSON.parse(customization) as { sectionOrder: string[] | null; hiddenItems: Record<string, boolean> | null; sectionItemOrder: Record<string, string[]> | null; favorites?: Array<{ id: string; label: string }>; removedFavoriteIds?: string[] };
      const removed = new Set(payload.removedFavoriteIds ?? []);
      const labels = new Map(payload.favorites?.map(({ id, label }) => [id, label]));
      const retained = current.favorites.filter(({ id }) => !removed.has(id)).map((favorite) => ({ ...favorite, label: labels.get(favorite.id) ?? favorite.label }));
      const byId = new Map(retained.map((favorite) => [favorite.id, favorite]));
      const ordered = payload.favorites ? payload.favorites.flatMap(({ id }) => byId.get(id) ?? []) : retained;
      return { ...current, sidebar: { ...current.sidebar, sectionOrder: payload.sectionOrder ?? ["metrics"], hiddenItems: payload.hiddenItems ?? {}, sectionItemOrder: payload.sectionItemOrder ?? {} }, favorites: ordered };
    }
    const isCollapsed = formData.get("isCollapsed");
    const width = formData.get("width");
    const sectionId = formData.get("sectionId");
    const sectionCollapsed = formData.get("sectionCollapsed");
    return { ...current, sidebar: { ...current.sidebar,
      ...(typeof isCollapsed === "string" ? { isCollapsed: isCollapsed === "true" } : {}),
      ...(typeof width === "string" ? { width: Number(width) } : {}),
      ...(typeof sectionId === "string" && typeof sectionCollapsed === "string" ? { collapsedSections: { ...current.sidebar.collapsedSections, [sectionId]: sectionCollapsed === "true" } } : {}),
    } };
  });
  return { success: true };
}, element: <Reference /> }]);

ReactDOM.createRoot(document.getElementById("reference")!).render(
  <React.StrictMode>
    <LocaleContextProvider locales={["en-US"]}>
      <OperatingSystemContextProvider platform="mac">
        <ShortcutsProvider>
          <RouterProvider router={router} />
        </ShortcutsProvider>
      </OperatingSystemContextProvider>
    </LocaleContextProvider>
  </React.StrictMode>,
);
