import "non.geist";
import "non.geist/mono";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, useLocation } from "react-router-dom";
import { PinnedTriggerErrors } from "virtual:pinned-trigger-errors";
import { PinnedTriggerRunError } from "virtual:pinned-trigger-run-error";
import { PinnedTriggerStateInspector } from "virtual:pinned-trigger-state-inspector";
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
type TriggerSideMenuPreferences = { isCollapsed: boolean; width: number; sectionOrder: string[]; collapsedSections: Record<string, boolean>; hiddenItems: Record<string, boolean>; sectionItemOrder: Record<string, string[]> };
let applyTriggerSideMenuPreferences: ((preferences: TriggerSideMenuPreferences) => void) | undefined;

window.addEventListener("error", (event) => {
  document.body.textContent = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
});

function Reference() {
  const location = useLocation();
  const stateInspector = new URLSearchParams(location.search).get("stateInspector") as "sql-captured" | "transaction-committed" | "cache-long" | "redis-truncated" | null;
  if (stateInspector) {
    return <div className="w-[488px] p-3"><PinnedTriggerStateInspector scenario={stateInspector} /></div>;
  }

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
  const [sideMenuPreferences, setSideMenuPreferences] = useState<TriggerSideMenuPreferences>({ isCollapsed: false, width: 224, sectionOrder: ["metrics"], collapsedSections: {}, hiddenItems: { prompts: true, models: true, query: true, dashboards: true, deployments: true, "environment-variables": true, "preview-branches": true, regions: true, "waitpoint-tokens": true, batches: true, "bulk-actions": true, "api-keys": true, alerts: true, limits: true, integrations: true }, sectionItemOrder: { metrics: ["logs", "errors", "queues"] } });
  const environment = { id: "environment", slug: "dev", type: "PRODUCTION", userName: "Production", shortcode: "prod" };
  const project = { id: "project", name: "Fixture Project", slug: "fixture", version: "V3", engine: "V1", environments: [environment], createdAt: new Date("2026-01-01T00:00:00Z") };
  const organization = { id: "organization", slug: "fixture", title: "Fixture Trigger", projects: [project] };
  useEffect(() => {
    applyTriggerSideMenuPreferences = setSideMenuPreferences;
    return () => { applyTriggerSideMenuPreferences = undefined; };
  }, []);

  return <div className="flex h-screen w-screen bg-background-dimmed text-text-bright">
    <PinnedTriggerSideMenu
      user={{ email: "fixture@trigger.dev", admin: true, isImpersonating: false, dashboardPreferences: { sideMenu: sideMenuPreferences } }}
      project={project}
      environment={environment}
      organization={organization}
      organizations={[organization]}
    />
    <main className="flex-1 p-6"><h1 className="text-lg font-semibold">Runs</h1></main>
  </div>;
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
  if (typeof customization === "string") {
    const payload = JSON.parse(customization) as { sectionOrder: string[] | null; hiddenItems: Record<string, boolean> | null; sectionItemOrder: Record<string, string[]> | null };
    applyTriggerSideMenuPreferences?.({ isCollapsed: false, width: 224, sectionOrder: payload.sectionOrder ?? [], collapsedSections: {}, hiddenItems: payload.hiddenItems ?? {}, sectionItemOrder: payload.sectionItemOrder ?? {} });
  }
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
