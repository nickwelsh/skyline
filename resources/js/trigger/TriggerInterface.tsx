/*!
 * Derived from Trigger.dev at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Modified for Skyline: client routing, Skyline DTO fixtures/branding, and unsupported actions removed.
 * See resources/js/trigger/import-manifest.json and THIRD_PARTY_NOTICES.md.
 */
import {
  IconAlertTriangle,
  IconBrandLaravel,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDatabase,
  IconListDetails,
  IconPlayerPlayFilled,
  IconRefresh,
  IconSearch,
  IconServer,
  IconStack2,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FixtureAdapter } from "../skyline/FixtureAdapter";
import type { RunStatus, SkylineDtoAdapter, TraceNode, TracePageDto } from "../skyline/dto";
import * as Timeline from "./Timeline";
import { RESIZABLE_PANEL_ANIMATION, ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./Resizable";

const fixtureAdapter = new FixtureAdapter();

const statusStyles: Record<RunStatus | "released", string> = {
  queued: "text-blue-400",
  running: "text-blue-400",
  retrying: "text-amber-400",
  completed: "text-success",
  failed: "text-error",
  released: "text-amber-400",
};

function useLocation() {
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const onPop = () => setLocation(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", to);
    setLocation(window.location.pathname + window.location.search);
  }, []);

  return { location, navigate };
}

export function App({ adapter = fixtureAdapter }: { adapter?: SkylineDtoAdapter }) {
  const { location, navigate } = useLocation();
  const runMatch = window.location.pathname.match(/\/skyline\/runs\/([^/]+)/);
  const runId = runMatch ? decodeURIComponent(runMatch[1]) : undefined;

  return (
    <div className="h-screen overflow-hidden bg-background-dimmed text-[0.8125rem] text-text-dimmed">
      {runId ? (
        <TracePage adapter={adapter} runId={runId} navigate={navigate} />
      ) : (
        <RunsPage adapter={adapter} navigate={navigate} />
      )}
    </div>
  );
}

function Shell({
  children,
  current,
  navigate,
}: {
  children: React.ReactNode;
  current: "runs";
  navigate: (to: string) => void;
}) {
  const [width, setWidth] = useState(() => clamp(Number(localStorage.getItem("skyline:sidemenu-width")) || 224, 44, 400));
  const widthRef = useRef(width);
  const collapsed = width <= 44;
  const progress = clamp((224 - width) / 180, 0, 1);
  const labelOpacity = clamp((0.6 - progress) / 0.6, 0, 1);

  const settleWidth = useCallback((next: number) => {
    widthRef.current = next;
    setWidth(next);
    localStorage.setItem("skyline:sidemenu-width", String(next));
  }, []);

  const toggle = useCallback(() => settleWidth(widthRef.current <= 44 ? 224 : 44), [settleWidth]);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const onResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    let didDrag = false;

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      if (Math.abs(delta) < 4 && !didDrag) return;
      didDrag = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const next = clamp(startWidth + delta, 44, 400);
      widthRef.current = next;
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (!didDrag) return toggle();
      const current = widthRef.current;
      const startedCollapsed = startWidth <= 44;
      const threshold = startedCollapsed ? 0.9 : 0.25;
      if (current >= 224) settleWidth(Math.round(current));
      else settleWidth(clamp((224 - current) / 180, 0, 1) <= threshold ? 224 : 44);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="grid h-full overflow-hidden" style={{ gridTemplateColumns: `${width}px 1fr` }}>
      <aside data-testid="side-menu" className="relative flex min-w-0 flex-col border-r border-grid-bright bg-background-bright" style={{ "--sm-collapse": progress, "--sm-label-opacity": labelOpacity } as React.CSSProperties}>
        <button
          className="flex h-11 items-center gap-2 border-b border-grid-bright px-3 text-left text-text-bright hover:bg-background-hover"
          onClick={toggle}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-amber-400 font-bold text-charcoal-950">S</span>
          <span className="min-w-0 overflow-hidden whitespace-nowrap font-semibold" style={{ opacity: labelOpacity, maxWidth: `${labelOpacity * 160}px` }}>Skyline</span>
          <IconChevronLeft className="ml-auto size-4 shrink-0 text-text-faint" style={{ opacity: labelOpacity }} />
        </button>

        <div className="px-2 py-3">
          <div className="mb-1 overflow-hidden whitespace-nowrap px-1 text-xs text-text-faint" style={{ opacity: labelOpacity, maxWidth: `${labelOpacity * 160}px` }}>Environment</div>
          <div className="flex h-8 items-center gap-2 rounded px-1 text-prod">
            <span className="flex size-5 shrink-0 items-center justify-center rounded border border-prod/40 bg-prod/10">★</span>
            <span className="overflow-hidden whitespace-nowrap font-medium" style={{ opacity: labelOpacity, maxWidth: `${labelOpacity * 160}px` }}>Local</span>
          </div>
        </div>

        <nav className="px-2">
          <button
            className={`flex h-8 w-full items-center gap-2 rounded px-1 ${current === "runs" ? "bg-background-raised text-text-bright" : "hover:bg-background-hover"}`}
            onClick={() => navigate("/skyline")}
          >
            <IconPlayerPlayFilled className="size-5 shrink-0 text-runs" />
            <span className="overflow-hidden whitespace-nowrap" style={{ opacity: labelOpacity, maxWidth: `${labelOpacity * 160}px` }}>Runs</span>
          </button>
        </nav>

        <div className="mt-auto border-t border-grid-bright p-2">
          <div className="flex h-8 items-center gap-2 px-1 text-text-faint">
            <IconBrandLaravel className="size-5 shrink-0" />
            <span className="overflow-hidden whitespace-nowrap" style={{ opacity: labelOpacity, maxWidth: `${labelOpacity * 160}px` }}>Laravel queue monitoring</span>
          </div>
        </div>
        <div data-testid="side-menu-resizer" className="group absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none" onPointerDown={onResizeStart}>
          <div className="absolute inset-y-0 left-[3px] w-px bg-grid-bright group-hover:bg-indigo-500" />
        </div>
      </aside>
      <main className="min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}

function PageHeader({ children }: { children: React.ReactNode }) {
  return <header className="flex h-11 items-center border-b border-grid-bright bg-background-dimmed px-3 text-sm">{children}</header>;
}

function RunsPage({ adapter, navigate }: { adapter: SkylineDtoAdapter; navigate: (to: string, replace?: boolean) => void }) {
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [status, setStatus] = useState<RunStatus | "all">((params.get("status") as RunStatus | null) ?? "all");
  const cursor = params.get("cursor") ?? undefined;
  const query = useMemo(() => ({ cursor, limit: 25 as const, search, status: status === "all" ? undefined : [status] }), [cursor, search, status]);
  const [page, setPage] = useState(() => adapter.runs(query));
  const [newRuns, setNewRuns] = useState(0);
  const goToCursor = useCallback((nextCursor?: string) => {
    const next = new URLSearchParams(window.location.search);
    nextCursor && nextCursor !== "0" ? next.set("cursor", nextCursor) : next.delete("cursor");
    navigate(`/skyline${next.size ? `?${next}` : ""}`);
  }, [navigate]);

  useEffect(() => setPage(adapter.runs(query)), [query]);

  useEffect(() => {
    const activeTimer = window.setInterval(() => setPage(adapter.runs(query)), 3_000);
    const newRunsTimer = window.setInterval(() => {
      const latest = adapter.runs(query);
      setNewRuns(Math.max(0, latest.runs.length - page.runs.length));
    }, 6_000);
    return () => {
      window.clearInterval(activeTimer);
      window.clearInterval(newRunsTimer);
    };
  }, [page.runs.length, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("input, textarea, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "j" && page.pagination.next) goToCursor(page.pagination.next);
      if (event.key.toLowerCase() === "k" && page.pagination.previous) goToCursor(page.pagination.previous);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToCursor, page.pagination.next, page.pagination.previous]);

  const updateFilters = (nextSearch: string, nextStatus: RunStatus | "all") => {
    const next = new URLSearchParams(window.location.search);
    next.delete("cursor");
    nextSearch ? next.set("search", nextSearch) : next.delete("search");
    nextStatus === "all" ? next.delete("status") : next.set("status", nextStatus);
    navigate(`/skyline${next.size ? `?${next}` : ""}`, true);
  };

  return (
    <Shell current="runs" navigate={navigate}>
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader>
          <div className="flex items-center gap-2 text-text-bright">
            <IconPlayerPlayFilled className="size-4 text-runs" />
            <span className="font-medium">Runs</span>
          </div>
          {newRuns > 0 && <button className="ml-auto rounded bg-indigo-500 px-2 py-1 text-xs text-white" onClick={() => { setPage(adapter.runs(query)); setNewRuns(0); }}>{newRuns} new Runs</button>}
          <button className={`${newRuns ? "ml-2" : "ml-auto"} flex h-7 items-center gap-1 rounded border border-grid-bright bg-background-bright px-2 text-xs hover:bg-background-hover`} onClick={() => setPage(adapter.runs(query))}>
            <IconRefresh className="size-3.5" /> Refresh
          </button>
        </PageHeader>

        <div className="flex h-12 items-center gap-2 border-b border-grid-bright px-3">
          <label className="flex h-8 min-w-64 items-center gap-2 rounded border border-grid-bright bg-input-bg px-2 focus-within:border-border-brighter">
            <IconSearch className="size-4 text-text-faint" />
            <input
              className="w-full border-0 bg-transparent p-0 text-sm text-text-bright placeholder:text-text-faint focus:ring-0"
              placeholder="Search Runs"
              value={search}
              onChange={(event) => { setSearch(event.target.value); updateFilters(event.target.value, status); }}
            />
          </label>
          {(["all", "running", "retrying", "completed", "failed"] as const).map((value) => (
            <button
              key={value}
              onClick={() => { setStatus(value); updateFilters(search, value); }}
              className={`h-7 rounded border px-2 text-xs capitalize ${status === value ? "border-indigo-500 bg-indigo-500/10 text-indigo-300" : "border-grid-bright bg-background-bright hover:bg-background-hover"}`}
            >
              {value}
            </button>
          ))}
          <div className="ml-auto text-xs text-text-faint">25 per page</div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-background-dimmed text-xs text-text-faint">
              <tr className="h-9 border-b border-grid-bright">
                <th className="px-3 font-medium">Run</th>
                <th className="px-3 font-medium">Status</th>
                <th className="px-3 font-medium">Queue</th>
                <th className="px-3 font-medium">Attempts</th>
                <th className="px-3 font-medium">Triggered</th>
                <th className="px-3 font-medium">Queue time</th>
                <th className="px-3 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {page.runs.map((run) => (
                <tr
                  key={run.id}
                  className="h-12 cursor-pointer border-b border-grid-dimmed hover:bg-background-hover"
                  onClick={() => {
                    navigate(`/skyline/runs/${encodeURIComponent(run.id)}?span=${encodeURIComponent(run.id)}&tableState=${encodeURIComponent(window.location.search)}`);
                  }}
                >
                  <td className="max-w-md px-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-blue-500 text-xs font-semibold text-white">J</span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-text-bright">{shortName(run.name)}</div>
                        <div className="truncate font-mono text-xs text-text-faint">{run.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3"><Status status={run.status} /></td>
                  <td className="px-3"><span className="text-text-bright">{run.queue}</span><span className="ml-1 text-xs text-text-faint">{run.connection}</span></td>
                  <td className="px-3 tabular-nums">{run.attemptCount}</td>
                  <td className="px-3 tabular-nums">{formatTime(run.queuedAt)}</td>
                  <td className="px-3 tabular-nums">{formatOptionalDuration(run.queueDurationMs)}</td>
                  <td className="px-3 text-right font-mono tabular-nums text-text-bright">{formatOptionalDuration(run.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {page.runs.length === 0 && <div className="grid h-48 place-items-center text-text-faint">No Runs match these filters.</div>}
        </div>

        <div className="flex h-11 items-center border-t border-grid-bright px-3 text-xs">
          <button disabled={!page.pagination.previous} onClick={() => goToCursor(page.pagination.previous)} className="rounded border border-grid-bright px-2 py-1 disabled:opacity-50">Previous <kbd className="ml-1">K</kbd></button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-text-faint">1–{page.runs.length}</span>
            <button disabled={!page.pagination.next} onClick={() => goToCursor(page.pagination.next)} className="rounded border border-grid-bright px-2 py-1 hover:bg-background-hover disabled:opacity-50">Next <kbd className="ml-1">J</kbd></button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function TracePage({ adapter, runId, navigate }: { adapter: SkylineDtoAdapter; runId: string; navigate: (to: string, replace?: boolean) => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const tracePage = useMemo(() => adapter.trace(runId), [adapter, refreshKey, runId]);
  const run = tracePage.run;
  const nodes = useMemo<TraceNode[]>(() => tracePage.trace.events.map((event) => ({
    id: event.id,
    parentId: event.parentId,
    runId: event.runId ?? runId,
    kind: event.data.kind,
    label: event.data.message,
    level: event.level,
    offsetMs: event.data.offsetNs / 1_000_000,
    durationMs: (event.data.durationNs ?? 0) / 1_000_000,
    status: event.data.status,
    isError: event.data.isError,
    isPartial: event.data.isPartial,
    metadata: {},
  })), [runId, tracePage.trace.events]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [queueTime, setQueueTime] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get("span") ?? nodes[0]?.id);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.08);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 150);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSelectedId(new URLSearchParams(window.location.search).get("span") ?? nodes[0]?.id);
    setCollapsed(new Set());
  }, [nodes, runId]);

  const childrenByParent = useMemo(() => {
    const result = new Map<string, TraceNode[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      result.set(node.parentId, [...(result.get(node.parentId) ?? []), node]);
    }
    return result;
  }, [nodes]);

  const visibleNodes = useMemo(() => {
    const query = search.toLowerCase();
    const match = new Set<string>();
    for (const node of nodes) {
      if ((!query || node.label.toLowerCase().includes(query)) && (!errorsOnly || node.isError || node.isPartial)) {
        match.add(node.id);
        let parent = node.parentId;
        while (parent) {
          match.add(parent);
          parent = nodes.find((candidate) => candidate.id === parent)?.parentId;
        }
      }
    }
    return nodes.filter((node) => {
      if (!match.has(node.id)) return false;
      let parent = node.parentId;
      while (parent) {
        if (collapsed.has(parent)) return false;
        parent = nodes.find((candidate) => candidate.id === parent)?.parentId;
      }
      return true;
    });
  }, [nodes, search, errorsOnly, collapsed]);

  const selectedTraceNode = nodes.find((node) => node.id === selectedId);
  const selectedNode = selectedTraceNode ? adapter.inspector(selectedTraceNode.id, runId) : undefined;
  const totalDuration = Math.max(...nodes.map((node) => node.offsetMs + node.durationMs), 1);
  const queueDuration = (tracePage.trace.queuedDurationNs ?? 0) / 1_000_000;
  const queueOffset = queueTime ? 0 : Math.min(queueDuration, totalDuration / 4);
  const displayedDuration = Math.max(1, totalDuration - queueOffset);

  const selectNode = useCallback((id?: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("span", id); else params.delete("span");
    navigate(`${window.location.pathname}?${params.toString()}`, true);
  }, [navigate]);

  const toggleNode = useCallback((id: string, includeDescendants = false) => {
    setCollapsed((current) => {
      const next = new Set(current);
      const collapse = !next.has(id);
      const visit = (nodeId: string) => {
        collapse ? next.add(nodeId) : next.delete(nodeId);
        if (includeDescendants) childrenByParent.get(nodeId)?.forEach((child) => visit(child.id));
      };
      visit(id);
      return next;
    });
  }, [childrenByParent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "Escape") selectNode(undefined);
      if (event.key.toLowerCase() === "q") setQueueTime((value) => !value);
      if (event.key.toLowerCase() === "e") setCollapsed(new Set());
      if (event.key.toLowerCase() === "w") setCollapsed(new Set(nodes.filter((node) => childrenByParent.has(node.id)).map((node) => node.id)));
      if (/^[0-9]$/.test(event.key)) {
        const depth = Number(event.key);
        setCollapsed(new Set(nodes.filter((node) => childrenByParent.has(node.id) && node.level >= depth).map((node) => node.id)));
      }
      if (event.key === "Home") {
        event.preventDefault();
        selectNode(visibleNodes[0]?.id);
      }
      if (event.key === "End") {
        event.preventDefault();
        selectNode(visibleNodes.at(-1)?.id);
      }
      if (event.key === "ArrowLeft" && selectedId) {
        event.preventDefault();
        if (childrenByParent.has(selectedId) && !collapsed.has(selectedId)) toggleNode(selectedId);
        else selectNode(nodes.find((node) => node.id === selectedId)?.parentId);
      }
      if (event.key === "ArrowRight" && selectedId) {
        event.preventDefault();
        if (collapsed.has(selectedId)) toggleNode(selectedId);
        else selectNode(childrenByParent.get(selectedId)?.[0]?.id ?? selectedId);
      }
      if (event.key.toLowerCase() === "p" && tracePage.run.parentRunId) {
        navigate(`/skyline/runs/${tracePage.run.parentRunId}?span=${tracePage.run.parentRunId}`);
      }
      if (["j", "k"].includes(event.key.toLowerCase())) {
        const runs = adapter.runs().runs;
        const index = runs.findIndex((candidate) => candidate.id === runId);
        const offset = event.key.toLowerCase() === "j" ? 1 : -1;
        const adjacent = runs[index + offset];
        if (adjacent) navigate(`/skyline/runs/${adjacent.id}?span=${adjacent.id}`);
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const index = Math.max(0, visibleNodes.findIndex((node) => node.id === selectedId));
        const next = event.key === "ArrowDown" ? Math.min(visibleNodes.length - 1, index + 1) : Math.max(0, index - 1);
        selectNode(visibleNodes[next]?.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adapter, childrenByParent, collapsed, navigate, nodes, runId, selectNode, selectedId, toggleNode, tracePage.run.parentRunId, visibleNodes]);

  return (
    <Shell current="runs" navigate={navigate}>
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader>
          <button className="text-text-faint hover:text-text-bright" onClick={() => navigate(`/skyline${new URLSearchParams(window.location.search).get("tableState") ?? ""}`)}>Runs</button>
          <span className="mx-2 text-text-faint">/</span>
          <span className="font-mono text-text-bright">{run.id}</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="flex h-7 items-center gap-1 rounded border border-grid-bright bg-background-bright px-2 text-xs hover:bg-background-hover" onClick={() => setRefreshKey((value) => value + 1)}><IconRefresh className="size-3.5" /> Refresh</button>
          </div>
        </PageHeader>

        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-grid-bright px-3">
          {tracePage.run.parentRunId ? (
            <button className="flex items-center gap-1 text-xs text-text-faint hover:text-text-bright" onClick={() => navigate(`/skyline/runs/${tracePage.run.parentRunId}?span=${tracePage.run.parentRunId}`)}>
              <IconStack2 className="size-4" /> Root/parent Run <span className="rounded border border-grid-bright px-1 font-mono text-xxs">P</span>
            </button>
          ) : <div className="text-xs text-text-faint">Root Run</div>}
          <label className="ml-auto flex h-7 w-64 items-center gap-2 rounded border border-grid-bright bg-input-bg px-2">
            <IconSearch className="size-3.5 text-text-faint" />
            <input className="w-full border-0 bg-transparent p-0 text-xs text-text-bright placeholder:text-text-faint focus:ring-0" placeholder="Search Trace" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            {searchInput && <button onClick={() => { setSearchInput(""); setSearch(""); }}><IconX className="size-3.5" /></button>}
          </label>
          <label className="flex items-center gap-2 text-xs text-text-faint">Zoom <input aria-label="Timeline zoom" type="range" min="0" max="1" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <Toggle label="Queue time" value={queueTime} onChange={setQueueTime} shortcut="Q" />
          <Toggle label="Errors only" value={errorsOnly} onChange={setErrorsOnly} />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup autosaveId="skyline-run-parent" className="h-full max-h-full">
            <ResizablePanel id="run" min="100px">
              <ResizablePanelGroup autosaveId="skyline-run-tree" className="h-full max-h-full">
                <ResizablePanel id="tree" default="50%" min="50px" className="min-w-0 overflow-hidden">
                  <div className="flex h-8 items-center border-b border-grid-bright px-3 text-xs text-text-faint">Trace</div>
                  <div ref={treeScrollRef} data-testid="trace-tree-scroll" className="h-[calc(100%-2rem)] overflow-auto" onScroll={(event) => { if (timelineScrollRef.current) timelineScrollRef.current.scrollTop = event.currentTarget.scrollTop; }}>
                    {visibleNodes.map((node) => (
                      <TreeRow key={node.id} node={node} selected={selectedId === node.id} hasChildren={childrenByParent.has(node.id)} collapsed={collapsed.has(node.id)} onToggle={(descendants) => toggleNode(node.id, descendants)} onSelect={() => selectNode(node.id)} />
                    ))}
                  </div>
                </ResizablePanel>
                <ResizableHandle id="tree-handle" />
                <ResizablePanel id="timeline" default="50%" min="50px" className="min-w-0 overflow-hidden">
                  <div ref={timelineScrollRef} data-testid="trace-timeline-scroll" className="h-full min-w-0 overflow-auto" onScroll={(event) => { if (treeScrollRef.current) treeScrollRef.current.scrollTop = event.currentTarget.scrollTop; }}>
                    <Timeline.Root durationMs={displayedDuration} scale={zoom} minWidth={700} maxWidth={1800} className="min-h-full">
                      <TimelineHeader duration={displayedDuration} />
                      <div>
                        {visibleNodes.map((node) => (
                          <Timeline.Row key={node.id} className={`h-8 border-b border-grid-dimmed ${selectedId === node.id ? "bg-indigo-500/8" : ""}`} onClick={() => selectNode(node.id)}>
                            <Timeline.Span startMs={Math.max(0, node.offsetMs - queueOffset)} durationMs={Math.max(2, node.durationMs)} className="top-[7px] h-[18px] min-w-1 px-1">
                              <div className={`h-full rounded-sm ${barClass(node)} ${node.kind === "run" ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : ""}`}>
                                {node.durationMs > totalDuration * 0.08 && <span className="px-1 font-mono text-xxs text-white/90">{formatDuration(node.durationMs)}</span>}
                              </div>
                            </Timeline.Span>
                          </Timeline.Row>
                        ))}
                      </div>
                    </Timeline.Root>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle id="parent-handle" className={!selectedNode ? "pointer-events-none opacity-0" : ""} />
            <ResizablePanel
              id="inspector"
              default="500px"
              min="250px"
              collapsible
              collapsed={!selectedNode}
              onCollapseChange={() => {}}
              collapsedSize="0px"
              collapseAnimation={RESIZABLE_PANEL_ANIMATION}
              className="overflow-hidden"
            >
              <div className="h-full" style={{ minWidth: 250 }}>
                {selectedNode && <Inspector node={selectedNode} run={run} onClose={() => selectNode(undefined)} />}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="flex h-10 shrink-0 items-center gap-3 border-t border-grid-bright px-3 text-xs text-text-faint">
          <span><kbd className="rounded border border-grid-bright px-1">↑</kbd> <kbd className="rounded border border-grid-bright px-1">↓</kbd> Navigate</span>
          <span><kbd className="rounded border border-grid-bright px-1">E</kbd> Expand all</span>
          <span><kbd className="rounded border border-grid-bright px-1">W</kbd> Collapse all</span>
          <span><kbd className="rounded border border-grid-bright px-1">Q</kbd> Queue time</span>
        </div>
      </div>
    </Shell>
  );
}

function TreeRow({ node, selected, hasChildren, collapsed, onToggle, onSelect }: { node: TraceNode; selected: boolean; hasChildren: boolean; collapsed: boolean; onToggle: (descendants: boolean) => void; onSelect: () => void }) {
  return (
    <div data-node-id={node.id} className={`flex h-8 cursor-pointer items-center border-b border-grid-dimmed pr-2 ${selected ? "bg-indigo-500/10 text-text-bright" : "hover:bg-background-hover"}`} onClick={onSelect}>
      <div style={{ width: `${node.level * 20 + 6}px` }} className="shrink-0" />
      <button aria-label={collapsed ? "Expand node" : "Collapse node"} className={`mr-1 grid size-5 shrink-0 place-items-center ${hasChildren ? "text-text-faint" : "invisible"}`} onClick={(event) => { event.stopPropagation(); onToggle(event.altKey); }}>
        {collapsed ? <IconChevronRight className="size-3.5" /> : <IconChevronDown className="size-3.5" />}
      </button>
      <NodeIcon node={node} />
      <span className={`ml-2 min-w-0 flex-1 truncate ${node.kind === "run" ? "font-medium text-blue-400" : ""}`}>{node.label}</span>
      {node.isError ? <IconAlertTriangle className="size-4 shrink-0 text-error" /> : node.status === "completed" ? <IconCheck className="size-4 shrink-0 text-success" /> : null}
    </div>
  );
}

function NodeIcon({ node }: { node: TraceNode }) {
  if (node.kind === "run") return <span className="grid size-5 shrink-0 place-items-center rounded bg-blue-500 text-xxs font-bold text-white">J</span>;
  if (node.kind === "attempt") return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-600 text-xxs font-bold text-charcoal-200">A</span>;
  return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-query"><IconDatabase className="size-3.5" /></span>;
}

function TimelineHeader({ duration }: { duration: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <Timeline.Row className="sticky top-0 z-10 h-8 border-b border-grid-bright bg-background-dimmed">
      {ticks.map((ratio) => (
        <Timeline.Point key={ratio} ms={duration * ratio} className="top-0 h-full border-l border-grid-bright">
          {() => <span className="ml-1 font-mono text-xxs text-text-faint">{formatDuration(duration * ratio)}</span>}
        </Timeline.Point>
      ))}
      <Timeline.FollowCursor>{(ms) => <div className="h-[calc(100vh-7rem)] border-l border-indigo-400"><span className="ml-1 whitespace-nowrap rounded bg-indigo-500 px-1 font-mono text-xxs text-white">{formatDuration(ms)}</span></div>}</Timeline.FollowCursor>
    </Timeline.Row>
  );
}

function Inspector({ node, run, onClose }: { node: TraceNode; run: TracePageDto["run"]; onClose: () => void }) {
  const [tab, setTab] = useState("Overview");
  useEffect(() => setTab("Overview"), [node.id]);
  const tabs = ["Overview", "Detail", "Context", "Metadata"];
  return (
    <aside className="min-w-0 overflow-hidden bg-background-bright">
      <div className="flex h-full flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-grid-bright px-3">
          <NodeIcon node={node} />
          <div className="min-w-0 flex-1 truncate font-medium text-text-bright">{node.label}</div>
          <button className="rounded p-1 hover:bg-background-hover" onClick={onClose}><IconX className="size-4" /></button>
        </div>
        <div role="tablist" className="flex h-9 shrink-0 items-end border-b border-grid-bright px-3">
          {tabs.map((value) => <button role="tab" aria-selected={tab === value} key={value} onClick={() => setTab(value)} className={`mr-5 h-9 border-b-2 text-xs ${tab === value ? "border-indigo-500 text-text-bright" : "border-transparent text-text-faint"}`}>{value}</button>)}
        </div>
        <div role="tabpanel" className="min-h-0 flex-1 overflow-auto p-4">
          {tab === "Overview" && <Overview node={node} run={run} />}
          {tab === "Detail" && <Detail node={node} run={run} />}
          {tab === "Context" && <PropertyList values={{ runId: node.runId, nodeId: node.id, parentId: node.parentId ?? "—", kind: node.kind }} />}
          {tab === "Metadata" && <pre className="overflow-auto rounded border border-grid-bright bg-background-deep p-3 font-mono text-xs leading-5 text-text-bright">{JSON.stringify(node.metadata, null, 2)}</pre>}
        </div>
      </div>
    </aside>
  );
}

function Overview({ node, run }: { node: TraceNode; run: TracePageDto["run"] }) {
  return (
    <div className="space-y-4">
      <Status status={node.status} />
      {node.kind === "run" && (
        <div className="rounded border border-grid-bright bg-background-dimmed p-3">
          <Lifecycle label="Triggered" value={formatTime(run.queuedAt)} first />
          <Lifecycle label="Queued" value={run.queueDurationMs ? `${formatDuration(run.queueDurationMs)} queue time` : "Waiting"} />
          <Lifecycle label="Started" value={run.startedAt ? "Worker received Job" : "Not started"} />
          <Lifecycle label={run.status === "failed" ? "Failed" : "Finished"} value={formatOptionalDuration(run.durationMs)} last />
        </div>
      )}
      {node.exception && (
        <div className="rounded border border-error/40 bg-error/5 p-3">
          <div className="font-mono text-xs text-error">{node.exception.class}</div>
          <p className="mt-2 text-sm text-text-bright">{node.exception.message}</p>
          <div className="mt-3 space-y-2 border-t border-error/20 pt-3 font-mono text-xxs">
            {node.exception.frames.map((frame) => <div key={`${frame.file}:${frame.line}`}><div className="text-text-bright">{frame.call}</div><div className="text-text-faint">{frame.file}:{frame.line}</div></div>)}
          </div>
        </div>
      )}
      {node.kind !== "run" && <PropertyList values={{ Started: formatDuration(node.offsetMs), Duration: formatDuration(node.durationMs), Status: node.status }} />}
    </div>
  );
}

function Detail({ node, run }: { node: TraceNode; run: TracePageDto["run"] }) {
  if (node.kind === "query") return <div><div className="mb-2 text-xs text-text-faint">Parameterized SQL</div><pre className="whitespace-pre-wrap rounded border border-grid-bright bg-background-deep p-3 font-mono text-xs leading-5 text-text-bright">{node.sql}</pre></div>;
  return <PropertyList values={{ Job: run.name, Connection: run.connection, Queue: run.queue, Attempts: run.attemptCount, Duration: formatOptionalDuration(run.durationMs) }} />;
}

function PropertyList({ values }: { values: Record<string, string | number | undefined> }) {
  return <dl className="divide-y divide-grid-dimmed rounded border border-grid-bright">{Object.entries(values).map(([key, value]) => <div key={key} className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2"><dt className="text-xs text-text-faint">{key}</dt><dd className="min-w-0 break-all font-mono text-xs text-text-bright">{value}</dd></div>)}</dl>;
}

function Lifecycle({ label, value, first, last }: { label: string; value: string; first?: boolean; last?: boolean }) {
  return <div className="grid grid-cols-[1rem_1fr_auto] gap-2"><div className="relative flex justify-center">{!first && <div className="absolute -top-3 h-3 border-l border-grid-bright" />}<span className={`mt-1 size-2 rounded-full ${last ? "bg-success" : "border border-success bg-background-dimmed"}`} />{!last && <div className="absolute top-3 h-6 border-l border-grid-bright" />}</div><div className="pb-4 font-medium text-text-bright">{label}</div><div className="text-xs text-text-faint">{value}</div></div>;
}

function Toggle({ label, value, onChange, shortcut }: { label: string; value: boolean; onChange: (value: boolean) => void; shortcut?: string }) {
  return <label className="flex cursor-pointer items-center gap-2 text-xs text-text-faint"><span>{label}</span><button role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-4 w-7 rounded-full ${value ? "bg-indigo-500" : "bg-surface-control"}`}><span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${value ? "left-3.5" : "left-0.5"}`} /></button>{shortcut && <span className="rounded border border-grid-bright px-1 font-mono text-xxs">{shortcut}</span>}</label>;
}

function Status({ status }: { status: RunStatus | "released" }) {
  const Icon = status === "failed" ? IconAlertTriangle : status === "completed" ? IconCheck : status === "running" ? IconClock : IconRefresh;
  return <span className={`inline-flex items-center gap-1.5 capitalize ${statusStyles[status]}`}><Icon className="size-4" />{status}</span>;
}

function shortName(name: string) { return name.split("\\").at(-1) ?? name; }
function formatDuration(ms: number) { return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s` : `${Math.round(ms)}ms`; }
function formatOptionalDuration(ms?: number) { return ms ? formatDuration(ms) : "—"; }
function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function barClass(node: TraceNode) { if (node.isError) return "bg-error"; if (node.isPartial) return "bg-amber-500"; if (node.kind === "run") return "bg-success"; return "bg-charcoal-550"; }
