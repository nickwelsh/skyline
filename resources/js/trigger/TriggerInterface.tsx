/*!
 * Derived from Trigger.dev at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Modified for Skyline: client routing, Skyline DTO adapters/branding, and unsupported actions removed.
 * See resources/js/trigger/import-manifest.json and THIRD_PARTY_NOTICES.md.
 */
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconBrandLaravel,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCloudDataConnection,
  IconDatabase,
  IconExternalLink,
  IconFolder,
  IconListDetails,
  IconMail,
  IconPlayerPlayFilled,
  IconRefresh,
  IconSearch,
  IconServer,
  IconStack2,
  IconTerminal2,
  IconWorldWww,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SkylineApiError } from "../skyline/HttpAdapter";
import type { HttpMessageCapture, InspectorDto, NodeKind, RunStatus, RunsPageDto, SkylineDtoAdapter, TraceNode, TracePageDto } from "../skyline/dto";
import { JsonCapturePreview, SqlCapturePreview, TextCapturePreview } from "./CapturePreview";
import { ExceptionPreview } from "./ExceptionPreview";
import * as Timeline from "./Timeline";
import { RESIZABLE_PANEL_ANIMATION, ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./Resizable";

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

export function App({ adapter, basePath = "/skyline" }: { adapter: SkylineDtoAdapter; basePath?: string }) {
  const { location, navigate } = useLocation();
  const runMatch = window.location.pathname.match(new RegExp(`${escapeRegExp(basePath)}/runs/([^/]+)`));
  const runId = runMatch ? decodeURIComponent(runMatch[1]) : undefined;

  return (
    <div className="isolate h-screen overflow-hidden bg-background-dimmed text-[0.8125rem] text-text-dimmed antialiased">
      {runId ? (
        <TracePage adapter={adapter} basePath={basePath} runId={runId} navigate={navigate} />
      ) : (
        <RunsPage adapter={adapter} basePath={basePath} navigate={navigate} />
      )}
    </div>
  );
}

function Shell({
  children,
  current,
  basePath,
  navigate,
}: {
  children: React.ReactNode;
  current: "runs";
  basePath: string;
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
            onClick={() => navigate(basePath)}
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

function RunsPage({ adapter, basePath, navigate }: { adapter: SkylineDtoAdapter; basePath: string; navigate: (to: string, replace?: boolean) => void }) {
  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [status, setStatus] = useState<RunStatus | "all">((params.get("status") as RunStatus | null) ?? "all");
  const cursor = params.get("cursor") ?? undefined;
  const query = useMemo(() => ({ cursor, search, status: status === "all" ? undefined : [status] }), [cursor, search, status]);
  const [page, setPage] = useState<RunsPageDto>();
  const pageRef = useRef<RunsPageDto>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [newRuns, setNewRuns] = useState(0);
  const loadPage = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try {
      const next = await adapter.runs(query, signal);
      setPage(next);
      setNewRuns(0);
    } catch (reason) {
      if (!isAbort(reason)) setError(reason);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [adapter, query]);
  const goToCursor = useCallback((nextCursor?: string) => {
    const next = new URLSearchParams(window.location.search);
    nextCursor && nextCursor !== "0" ? next.set("cursor", nextCursor) : next.delete("cursor");
    navigate(`${basePath}${next.size ? `?${next}` : ""}`);
  }, [basePath, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPage(controller.signal);
    return () => controller.abort();
  }, [loadPage]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (!page) return;
    const controller = new AbortController();
    let activeCursor = page.pollCursor;
    const activeTimer = window.setInterval(async () => {
      const current = pageRef.current;
      if (!current) return;
      const activeIds = current.runs.filter((run) => ["queued", "running", "retrying"].includes(run.status)).map((run) => run.id);
      if (!activeIds.length) return;
      try {
        const updates = await adapter.updates(query, activeCursor, activeIds, controller.signal);
        activeCursor = updates.pollCursor;
        setPage((value) => value ? { ...value, runs: mergeRunUpdates(value.runs, updates.runs, query.status) } : value);
      } catch (reason) {
        if (!isAbort(reason)) setError(reason);
      }
    }, page.polling.activeRunsIntervalMs);
    const newRunsTimer = window.setInterval(async () => {
      try {
        const updates = await adapter.updates(query, page.pollCursor, [], controller.signal);
        setNewRuns(updates.newRunCount);
      } catch (reason) {
        if (!isAbort(reason)) setError(reason);
      }
    }, page.polling.newRunsIntervalMs);
    return () => {
      controller.abort();
      window.clearInterval(activeTimer);
      window.clearInterval(newRunsTimer);
    };
  }, [adapter, page?.pollCursor, page?.polling.activeRunsIntervalMs, page?.polling.newRunsIntervalMs, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("input, textarea, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "j" && page?.pagination.next) goToCursor(page.pagination.next);
      if (event.key.toLowerCase() === "k" && page?.pagination.previous) goToCursor(page.pagination.previous);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToCursor, page?.pagination.next, page?.pagination.previous]);

  const updateFilters = (nextSearch: string, nextStatus: RunStatus | "all") => {
    const next = new URLSearchParams(window.location.search);
    next.delete("cursor");
    nextSearch ? next.set("search", nextSearch) : next.delete("search");
    nextStatus === "all" ? next.delete("status") : next.set("status", nextStatus);
    navigate(`${basePath}${next.size ? `?${next}` : ""}`, true);
  };

  return (
    <Shell current="runs" basePath={basePath} navigate={navigate}>
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader>
          <div className="flex items-center gap-2 text-text-bright">
            <IconPlayerPlayFilled className="size-4 text-runs" />
            <span className="font-medium">Runs</span>
          </div>
          {newRuns > 0 && <button className="ml-auto rounded bg-indigo-500 px-2 py-1 text-xs text-white" onClick={() => cursor ? goToCursor(undefined) : void loadPage()}>{newRuns} new Runs</button>}
          <button className={`${newRuns ? "ml-2" : "ml-auto"} flex h-7 items-center gap-1 rounded border border-grid-bright bg-background-bright px-2 text-xs hover:bg-background-hover`} onClick={() => void loadPage()}>
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
          {(["all", "queued", "running", "retrying", "completed", "failed"] as const).map((value) => (
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
            <tbody aria-busy={loading}>
              {page?.runs.map((run) => (
                <tr
                  key={run.id}
                  className="h-12 cursor-pointer border-b border-grid-dimmed hover:bg-background-hover"
                  onClick={() => {
                    const detail = new URLSearchParams({
                      node: `run_${run.id}`,
                      tableState: page.tableState,
                      returnTo: window.location.search,
                    });
                    navigate(`${basePath}/runs/${encodeURIComponent(run.id)}?${detail}`);
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
                  <td className="px-3"><span className="text-text-bright">{run.queue ?? "—"}</span><span className="ml-1 text-xs text-text-faint">{run.connection ?? ""}</span></td>
                  <td className="px-3 tabular-nums">{run.attemptCount}</td>
                  <td className="px-3 tabular-nums">{formatTime(run.triggeredAt)}</td>
                  <td className="px-3 tabular-nums">{formatOptionalDurationUs(run.queueDurationUs)}</td>
                  <td className="px-3 text-right font-mono tabular-nums text-text-bright">{formatOptionalDurationUs(run.durationUs ?? run.activeDurationUs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !page && <LoadingState label="Loading Runs…" />}
          {error !== undefined && <ErrorState error={error} onRetry={() => void loadPage()} />}
          {!loading && !error && page?.runs.length === 0 && <div className="grid h-48 place-items-center text-text-faint">{page.hasAnyRuns ? "No Runs match these filters." : "No Runs yet."}</div>}
        </div>

        <div className="flex h-11 items-center border-t border-grid-bright px-3 text-xs">
          <button disabled={!page?.pagination.previous} onClick={() => goToCursor(page?.pagination.previous ?? undefined)} className="rounded border border-grid-bright px-2 py-1 disabled:opacity-50">Previous <kbd className="ml-1">K</kbd></button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-text-faint">1–{page?.runs.length ?? 0}</span>
            <button disabled={!page?.pagination.next} onClick={() => goToCursor(page?.pagination.next ?? undefined)} className="rounded border border-grid-bright px-2 py-1 hover:bg-background-hover disabled:opacity-50">Next <kbd className="ml-1">J</kbd></button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function TracePage({ adapter, basePath, runId, navigate }: { adapter: SkylineDtoAdapter; basePath: string; runId: string; navigate: (to: string, replace?: boolean) => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tracePage, setTracePage] = useState<TracePageDto>();
  const [error, setError] = useState<unknown>();
  const tableState = new URLSearchParams(window.location.search).get("tableState") ?? undefined;

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    const load = async () => {
      try {
        const next = await adapter.trace(runId, tableState, controller.signal);
        setTracePage(next);
        setError(undefined);
        if (next.trace.polling) timer = window.setTimeout(() => void load(), next.trace.pollIntervalMs);
      } catch (reason) {
        if (!isAbort(reason)) setError(reason);
      }
    };
    void load();
    return () => {
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [adapter, refreshKey, runId, tableState]);

  if (!tracePage) {
    return (
      <Shell current="runs" basePath={basePath} navigate={navigate}>
        {error ? <ErrorState error={error} onRetry={() => setRefreshKey((value) => value + 1)} /> : <LoadingState label="Loading Trace…" />}
      </Shell>
    );
  }

  return <TraceContent adapter={adapter} basePath={basePath} runId={runId} navigate={navigate} tracePage={tracePage} onRefresh={() => setRefreshKey((value) => value + 1)} />;
}

function TraceContent({ adapter, basePath, runId, navigate, tracePage, onRefresh }: {
  adapter: SkylineDtoAdapter;
  basePath: string;
  runId: string;
  navigate: (to: string, replace?: boolean) => void;
  tracePage: TracePageDto;
  onRefresh: () => void;
}) {
  const run = tracePage.run;
  const nodes = tracePage.trace.nodes;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [kindFilter, setKindFilter] = useState<NodeKind | "all">("all");
  const [queueTime, setQueueTime] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get("node") ?? nodes[0]?.id);
  const [selectedNode, setSelectedNode] = useState<InspectorDto>();
  const [inspectorError, setInspectorError] = useState<unknown>();
  const [inspectorKey, setInspectorKey] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.08);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 150);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSelectedId((current) => {
      const requested = new URLSearchParams(window.location.search).get("node") ?? undefined;
      const next = requested ?? current ?? nodes[0]?.id;
      return nodes.some((node) => node.id === next) ? next : nodes[0]?.id;
    });
    setCollapsed(new Set());
  }, [runId]);

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
      if ((!query || node.label.toLowerCase().includes(query))
        && (!errorsOnly || node.isError || node.isPartial)
        && (kindFilter === "all" || node.kind === kindFilter)) {
        match.add(node.id);
        let parent = node.parentId;
        while (parent) {
          match.add(parent);
          parent = nodes.find((candidate) => candidate.id === parent)?.parentId ?? null;
        }
      }
    }
    return nodes.filter((node) => {
      if (!match.has(node.id)) return false;
      let parent = node.parentId;
      while (parent) {
        if (collapsed.has(parent)) return false;
        parent = nodes.find((candidate) => candidate.id === parent)?.parentId ?? null;
      }
      return true;
    });
  }, [nodes, search, errorsOnly, kindFilter, collapsed]);

  const selectedTraceNode = nodes.find((node) => node.id === selectedId);

  useEffect(() => {
    if (!selectedTraceNode) {
      setSelectedNode(undefined);
      setInspectorError(undefined);
      return;
    }
    const controller = new AbortController();
    setSelectedNode(undefined);
    setInspectorError(undefined);
    void adapter.inspector(selectedTraceNode.id, runId, controller.signal)
      .then(setSelectedNode)
      .catch((reason) => { if (!isAbort(reason)) setInspectorError(reason); });
    return () => controller.abort();
  }, [adapter, inspectorKey, runId, selectedTraceNode?.id, tracePage.trace.revision]);

  const totalDuration = Math.max(
    (tracePage.trace.durationUs ?? tracePage.trace.activeDurationUs ?? 0) / 1_000,
    ...nodes.map((node) => (node.offsetUs + (node.durationUs ?? 0)) / 1_000),
    1,
  );
  const queueDuration = (tracePage.trace.queuedDurationUs ?? 0) / 1_000;
  const queueOffset = queueTime ? 0 : Math.min(queueDuration, totalDuration);
  const displayedDuration = Math.max(1, totalDuration - queueOffset);

  const navigateRun = useCallback((nextRunId: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("node", `run_${nextRunId}`);
    navigate(`${basePath}/runs/${encodeURIComponent(nextRunId)}?${params}`);
  }, [basePath, navigate]);

  const selectNode = useCallback((id?: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("node", id); else params.delete("node");
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
        else selectNode(nodes.find((node) => node.id === selectedId)?.parentId ?? undefined);
      }
      if (event.key === "ArrowRight" && selectedId) {
        event.preventDefault();
        if (collapsed.has(selectedId)) toggleNode(selectedId);
        else selectNode(childrenByParent.get(selectedId)?.[0]?.id ?? selectedId);
      }
      if (event.key.toLowerCase() === "p" && tracePage.run.parentRunId) {
        navigateRun(tracePage.run.parentRunId);
      }
      if (["j", "k"].includes(event.key.toLowerCase())) {
        const adjacent = event.key.toLowerCase() === "j"
          ? tracePage.navigation.nextRunId
          : tracePage.navigation.previousRunId;
        if (adjacent) navigateRun(adjacent);
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
  }, [childrenByParent, collapsed, navigateRun, nodes, selectNode, selectedId, toggleNode, tracePage.navigation.nextRunId, tracePage.navigation.previousRunId, tracePage.run.parentRunId, visibleNodes]);

  return (
    <Shell current="runs" basePath={basePath} navigate={navigate}>
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader>
          <button className="text-text-faint hover:text-text-bright" onClick={() => {
            const returnTo = new URLSearchParams(window.location.search).get("returnTo");
            navigate(`${basePath}${returnTo ?? ""}`);
          }}>Runs</button>
          <span className="mx-2 text-text-faint">/</span>
          <span className="font-mono text-text-bright">{run.id}</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="flex h-7 items-center gap-1 rounded border border-grid-bright bg-background-bright px-2 text-xs hover:bg-background-hover" onClick={onRefresh}><IconRefresh className="size-3.5" /> Refresh</button>
          </div>
        </PageHeader>

        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-grid-bright px-3">
          {tracePage.run.parentRunId ? (
            <button className="flex items-center gap-1 text-xs text-text-faint hover:text-text-bright" onClick={() => navigateRun(tracePage.run.parentRunId!)}>
              <IconStack2 className="size-4" /> Root/parent Run <span className="rounded border border-grid-bright px-1 font-mono text-xxs">P</span>
            </button>
          ) : <div className="text-xs text-text-faint">Root Run</div>}
          {tracePage.trace.isTruncated && <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">Trace truncated to {nodes.length.toLocaleString()} nodes</div>}
          <label className="ml-auto flex h-7 w-64 items-center gap-2 rounded border border-grid-bright bg-input-bg px-2">
            <IconSearch className="size-3.5 text-text-faint" />
            <input className="w-full border-0 bg-transparent p-0 text-xs text-text-bright placeholder:text-text-faint focus:ring-0" placeholder="Search Trace" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            {searchInput && <button onClick={() => { setSearchInput(""); setSearch(""); }}><IconX className="size-3.5" /></button>}
          </label>
          <select aria-label="Span type" className="h-7 rounded border border-grid-bright bg-input-bg px-2 text-xs text-text-bright" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as NodeKind | "all")}>
            <option value="all">All types</option>
            <option value="cache">Cache</option>
            <option value="redis">Redis</option>
            <option value="query">SQL</option>
            <option value="request">HTTP</option>
            <option value="custom">Custom</option>
            <option value="transaction">Transactions</option>
            <option value="mail">Mail</option>
            <option value="notification">Notifications</option>
            <option value="storage">Storage</option>
            <option value="process">Processes</option>
          </select>
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
                            <Timeline.Span startMs={Math.max(0, node.offsetUs / 1_000 - queueOffset)} durationMs={Math.max(2, nodeDurationMs(node, totalDuration, queueOffset))} className={`top-[7px] h-[18px] ${node.kind === "query" || node.kind === "request" ? "min-w-[6px]" : "min-w-1"}`}>
                              <div
                                data-timeline-node-id={node.id}
                                title={`${node.label} · Started ${formatDuration(Math.max(0, node.offsetUs / 1_000 - queueOffset))} · Duration ${formatDuration(nodeDurationMs(node, totalDuration, queueOffset))}`}
                                className={`h-full rounded-sm px-1 ${barClass(node)} ${node.kind === "run" ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" : node.kind === "query" || node.kind === "request" ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]" : ""}`}
                              >
                                {nodeDurationMs(node, totalDuration, queueOffset) > totalDuration * 0.08 && <span className="px-1 font-mono text-xxs text-white/90">{formatDuration(nodeDurationMs(node, totalDuration, queueOffset))}</span>}
                              </div>
                            </Timeline.Span>
                            {node.timelineEvents.map((event, index) => (
                              <Timeline.Point key={`${event.name}:${event.offsetUs}:${index}`} ms={Math.max(0, event.offsetUs / 1_000 - queueOffset)} className="top-[13px] z-10">
                                {() => <span
                                  data-timeline-event-kind={event.kind ?? "event"}
                                  aria-label={event.name}
                                  title={event.name}
                                  className={event.kind === "breadcrumb"
                                    ? `block size-2.5 -translate-y-0.5 rotate-45 border border-background-dimmed ${breadcrumbClass(event.level)}`
                                    : "block size-1.5 rounded-full border border-background-dimmed bg-text-bright"}
                                />}
                              </Timeline.Point>
                            ))}
                          </Timeline.Row>
                        ))}
                      </div>
                    </Timeline.Root>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle id="parent-handle" className={!selectedTraceNode ? "pointer-events-none opacity-0" : ""} />
            <ResizablePanel
              id="inspector"
              default="500px"
              min="250px"
              collapsible
              collapsed={!selectedTraceNode}
              onCollapseChange={() => {}}
              collapsedSize="0px"
              collapseAnimation={RESIZABLE_PANEL_ANIMATION}
              className="overflow-hidden"
            >
              <div className="h-full" style={{ minWidth: 250 }}>
                {selectedNode && <Inspector node={selectedNode} run={run} onClose={() => selectNode(undefined)} />}
                {!selectedNode && inspectorError !== undefined && <ErrorState error={inspectorError} onRetry={() => setInspectorKey((value) => value + 1)} />}
                {!selectedNode && !inspectorError && selectedTraceNode && <LoadingState label="Loading inspector…" />}
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
  if (node.kind === "query") return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-query"><IconDatabase className="size-3.5" /></span>;
  if (node.kind === "cache" || node.kind === "redis") return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-amber-400"><IconCloudDataConnection className="size-3.5" /></span>;
  if (node.kind === "transaction") return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-indigo-400"><IconArrowsExchange className="size-3.5" /></span>;
  if (node.kind === "mail" || node.kind === "notification") return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-fuchsia-400"><IconMail className="size-3.5" /></span>;
  if (node.kind === "storage") return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-emerald-400"><IconFolder className="size-3.5" /></span>;
  if (node.kind === "process") return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-orange-400"><IconTerminal2 className="size-3.5" /></span>;
  return <span className="grid size-5 shrink-0 place-items-center rounded bg-charcoal-700 text-cyan-400"><IconWorldWww className="size-3.5" /></span>;
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

function Inspector({ node, run, onClose }: { node: InspectorDto; run: TracePageDto["run"]; onClose: () => void }) {
  const [tab, setTab] = useState("Overview");
  useEffect(() => setTab("Overview"), [node.id]);
  const tabs = ["Overview", "Detail", "Context", "Metadata"];
  return (
    <aside className="h-full min-w-0 overflow-hidden bg-background-bright">
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
          {tab === "Context" && <PropertyList values={{ ...node.overview, runId: node.runId, nodeId: node.id, parentId: node.parentId ?? "—", kind: node.kind }} />}
          {tab === "Metadata" && <JsonCapturePreview label="Metadata" value={node.metadata.value} truncated={node.metadata.isTruncated} />}
        </div>
      </div>
    </aside>
  );
}

function Overview({ node, run }: { node: InspectorDto; run: TracePageDto["run"] }) {
  return (
    <div className="space-y-4">
      <Status status={node.status} />
      {node.kind === "run" && (
        <div className="rounded border border-grid-bright bg-background-dimmed p-3">
          <Lifecycle label="Triggered" value={formatTime(run.triggeredAt)} first />
          {run.queuedAt && <Lifecycle label="Queued" value={run.queueDurationUs ? `${formatDuration(run.queueDurationUs / 1_000)} queue time` : "Queued"} />}
          <Lifecycle label="Started" value={run.startedAt ? "Worker received Job" : "Not started"} />
          <Lifecycle label={run.status === "failed" ? "Failed" : "Finished"} value={formatOptionalDurationUs(run.durationUs)} last />
        </div>
      )}
      {node.exception && <ExceptionPreview exception={node.exception} />}
      {node.kind === "attempt" && node.summary && (
        <section className="space-y-2">
          <h3 className="font-medium text-text-bright">Resources</h3>
          <PropertyList values={{ "Process peak memory (lifetime)": formatBytes(node.summary.resources.peakMemoryBytes), "Memory delta": formatBytes(node.summary.resources.memoryDeltaBytes), "CPU time": `${node.summary.resources.cpuTimeUs.toLocaleString()}μs` }} />
          {Object.keys(node.summary.operations).length > 0 && <PropertyList values={Object.fromEntries(Object.entries(node.summary.operations).map(([role, value]) => [role, `${value.count.toLocaleString()} · ${formatDuration(value.durationMs)}`]))} />}
        </section>
      )}
      {node.kind === "attempt" && node.breadcrumbs && node.breadcrumbs.length > 0 && (
        <details className="rounded border border-grid-bright bg-background-dimmed">
          <summary className="cursor-pointer px-3 py-2 font-medium text-text-bright">Breadcrumbs ({node.breadcrumbs.length})</summary>
          <div className="divide-y divide-grid-dimmed border-t border-grid-bright">
            {node.breadcrumbs.map((breadcrumb, index) => (
              <div key={`${breadcrumb.timestamp}:${index}`} className="space-y-1 px-3 py-2 text-xs">
                <div className="flex gap-2 text-text-faint"><span className="uppercase">{breadcrumb.level}</span><span>{breadcrumb.channel}</span><span className="ml-auto">{formatTime(breadcrumb.timestamp)}</span></div>
                <div className="break-words text-text-bright">{breadcrumb.message}</div>
                {Object.keys(breadcrumb.context).length > 0 && <JsonCapturePreview label="Context" value={breadcrumb.context} />}
              </div>
            ))}
          </div>
        </details>
      )}
      {node.kind !== "run" && <PropertyList values={{ Started: formatDuration(node.offsetUs / 1_000), Duration: node.durationUs === null ? "Running" : formatDuration(node.durationUs / 1_000), Status: node.status }} />}
    </div>
  );
}

function Detail({ node, run }: { node: InspectorDto; run: TracePageDto["run"] }) {
  if (node.kind === "query") return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} label="Query source" />}
      <SqlCapturePreview
        sql={node.sql?.value ?? ""}
        bindings={node.bindings?.items}
        sqlTruncated={node.sql?.isTruncated}
        bindingsTruncated={node.bindings?.truncated}
      />
      {node.bindings && <JsonCapturePreview label="Bindings" value={node.bindings.items} truncated={node.bindings.truncated} />}
      {node.result?.kind === "rows" && <JsonCapturePreview label="Result preview" summary={`${node.result.rowCount.toLocaleString()} ${node.result.rowCount === 1 ? "row" : "rows"} returned`} value={node.result.rows} truncated={node.result.truncated} />}
      {node.result?.kind === "affected" && <JsonCapturePreview label="Result" summary={`${node.result.affectedRows.toLocaleString()} ${node.result.affectedRows === 1 ? "row" : "rows"} affected`} value={{ affectedRows: node.result.affectedRows }} />}
    </div>
  );
  if (node.kind === "request" && node.http) return (
    <div className="space-y-5">
      {node.source && <NodeSource source={node.source} label="Request source" />}
      <PropertyList values={{ Method: node.http.method, URL: node.http.url, Status: node.http.statusCode }} />
      <HttpMessagePreview label="Request" capture={node.http.request} />
      <HttpMessagePreview label="Response" capture={node.http.response} />
    </div>
  );
  if (node.kind === "cache" && node.cache) return <CacheDetail node={node} />;
  if (node.kind === "redis" && node.redis) return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} />}
      <DetailSection title="Command">
        <PropertyList values={{ Command: node.redis.command, Connection: node.redis.connection, Outcome: humanize(node.redis.outcome) }} />
      </DetailSection>
      <CaptureNote>Arguments and return values are not captured.</CaptureNote>
    </div>
  );
  if (node.kind === "storage" && node.storage) return <StorageDetail node={node} />;
  if ((node.kind === "mail" || node.kind === "notification") && node.delivery) return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} />}
      <DetailSection title={node.kind === "mail" ? "Delivery" : "Notification delivery"}>
        <PropertyList values={{
          Type: shortName(node.delivery.messageType ?? "—"),
          [node.kind === "mail" ? "Mailer" : "Channel"]: node.delivery.transportOrChannel,
          Recipients: node.delivery.recipientCount,
          Outcome: humanize(node.delivery.outcome),
        }} />
      </DetailSection>
      <CaptureNote>Recipient identities, subjects, and message bodies are not captured.</CaptureNote>
    </div>
  );
  if (node.kind === "process" && node.process) return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} />}
      <DetailSection title="Execution">
        <PropertyList values={{
          Executable: node.process.executable,
          Mode: node.process.async ? "Asynchronous" : "Synchronous",
          Timeout: node.process.timeoutSeconds === null ? "No timeout reported" : formatTtl(node.process.timeoutSeconds),
          "Exit code": node.process.exitCode,
          Outcome: node.process.timedOut ? "Timed out" : humanize(node.process.outcome),
        }} />
      </DetailSection>
      <CaptureNote>Arguments, environment variables, and process output are not captured.</CaptureNote>
    </div>
  );
  if (node.kind === "transaction" && node.transaction) return (
    <div className="space-y-4">
      <DetailSection title="Transaction">
        <PropertyList values={{
          Connection: node.transaction.connection,
          Driver: node.transaction.driver,
          Depth: node.transaction.depth,
          Outcome: humanize(node.transaction.outcome),
          "Query time": node.transaction.queryTimeMs === null ? null : formatDuration(node.transaction.queryTimeMs),
        }} />
      </DetailSection>
    </div>
  );
  if (node.kind === "custom" && node.custom) return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} />}
      <DetailSection title="Measurement">
        <PropertyList values={{ Name: node.custom.name, Outcome: node.isError ? "Failed" : "Completed" }} />
      </DetailSection>
      {Object.keys(node.custom.attributes).length > 0
        ? <JsonCapturePreview label="Application attributes" value={node.custom.attributes} />
        : <CaptureNote>No application attributes were recorded.</CaptureNote>}
    </div>
  );
  if (node.kind !== "attempt") return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} />}
      <PropertyList values={node.overview} />
    </div>
  );
  return <PropertyList values={{ Job: run.name, Connection: run.connection, Queue: run.queue, Attempts: run.attemptCount, Duration: formatOptionalDurationUs(run.durationUs) }} />;
}

function CacheDetail({ node }: { node: InspectorDto }) {
  const cache = node.cache!;
  const expiration = cache.forever
    ? "Forever"
    : cache.ttlSeconds === null
      ? cache.operation === "GET" ? "Not reported for reads" : "Not reported by Laravel"
      : formatTtl(cache.ttlSeconds);

  return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} />}
      <DetailSection title="Cache operation">
        <PropertyList values={{
          Operation: humanize(cache.operation),
          Store: cache.store,
          Strategy: cache.strategy ? humanize(cache.strategy) : "Direct operation",
          Outcome: cache.hit === null ? humanize(cache.outcome) : cache.hit ? "Hit" : "Miss",
          ...(cache.strategy === "stale_while_revalidate" ? {
            "Fresh for": cache.freshTtlSeconds === null ? "Not reported by Laravel" : formatTtl(cache.freshTtlSeconds),
            "Retained for": expiration,
          } : { Expiration: expiration }),
          ...(cache.keyCount > 1 ? { Keys: cache.keyCount } : {}),
        }} />
      </DetailSection>
      {cache.key && <DetailSection title="Entry">
        <PropertyList values={{ [cache.keyCaptured ? "Key" : "Key fingerprint"]: cache.key, Value: "Not captured" }} />
      </DetailSection>}
      <CaptureNote>{cache.keyCaptured ? "Cache values are never captured." : "Raw keys are hidden. Enable SKYLINE_CACHE_CAPTURE_KEYS to show them; cache values are never captured."}</CaptureNote>
    </div>
  );
}

function StorageDetail({ node }: { node: InspectorDto }) {
  const storage = node.storage!;
  const result = storage.result;
  const resultValues: Record<string, string | number | null | undefined> = {
    Exists: result.exists === null ? undefined : result.exists ? "Yes" : "No",
    "Last modified": result.lastModified === null ? undefined : new Date(result.lastModified * 1_000).toLocaleString(),
    "MIME type": result.mimeType,
    Visibility: result.visibility,
  };
  const hasResult = Object.values(resultValues).some((value) => value !== undefined && value !== null);

  return (
    <div className="space-y-4">
      {node.source && <NodeSource source={node.source} />}
      <DetailSection title="Storage operation">
        <PropertyList values={{
          Operation: humanize(storage.operation),
          Disk: storage.disk,
          Driver: storage.driver,
          Outcome: humanize(storage.outcome),
          Bytes: storage.bytes === null ? null : formatBytes(storage.bytes),
        }} />
      </DetailSection>
      <DetailSection title="File">
        <PropertyList values={{
          [storage.pathCaptured ? "Path" : "Path fingerprint"]: storage.path,
          ...(storage.destination ? { [storage.destinationCaptured ? "Destination" : "Destination fingerprint"]: storage.destination } : {}),
        }} />
      </DetailSection>
      {(storage.url || storage.localFile?.href || storage.destinationUrl || storage.destinationLocalFile?.href) && <DetailSection title="Open file">
        <div className="space-y-2">
          {storage.url && <FileLink href={storage.url} label="Open source URL" value={storage.url} />}
          {storage.localFile?.href && <FileLink href={storage.localFile.href} label="Open source in editor" value={storage.localFile.path} />}
          {storage.destinationUrl && <FileLink href={storage.destinationUrl} label="Open destination URL" value={storage.destinationUrl} />}
          {storage.destinationLocalFile?.href && <FileLink href={storage.destinationLocalFile.href} label="Open destination in editor" value={storage.destinationLocalFile.path} />}
        </div>
      </DetailSection>}
      {hasResult && <DetailSection title="Result"><PropertyList values={resultValues} /></DetailSection>}
      <CaptureNote>{storage.pathCaptured ? "File contents are not captured. Links are best effort and depend on disk configuration." : "Raw paths are hidden. Enable SKYLINE_STORAGE_CAPTURE_PATHS to show paths and available links; file contents are never captured."}</CaptureNote>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section aria-label={title} className="space-y-2"><h3 className="text-xs font-medium text-text-faint">{title}</h3>{children}</section>;
}

function CaptureNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded border border-grid-bright bg-background-dimmed p-3 text-xs leading-5 text-text-faint">{children}</p>;
}

function FileLink({ href, label, value }: { href: string; label: string; value: string }) {
  return <a href={href} aria-label={label} className="flex min-h-9 min-w-0 items-center gap-2 rounded border border-grid-bright bg-background-deep px-3 text-text-bright hover:border-indigo-500/60 hover:bg-background-hover"><span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span><IconExternalLink className="size-4 shrink-0" /></a>;
}

function HttpMessagePreview({ label, capture }: { label: string; capture: HttpMessageCapture }) {
  return (
    <section aria-label={label} className="space-y-3">
      <h3 className="font-medium text-text-bright">{label}</h3>
      {capture.headers && <JsonCapturePreview label={`${label} headers`} value={capture.headers.items} truncated={capture.headers.truncated} />}
      {capture.body && (capture.body.isJson
        ? <JsonCapturePreview label={`${label} body`} value={capture.body.json} summary={capture.body.contentType ?? undefined} truncated={capture.body.truncated} />
        : <TextCapturePreview label={`${label} body`} value={capture.body.value} summary={capture.body.contentType ?? undefined} truncated={capture.body.truncated} />)}
      {!capture.headers && !capture.body && <div className="rounded border border-grid-bright bg-background-dimmed p-3 text-xs text-text-faint">Capture disabled</div>}
    </section>
  );
}

function NodeSource({ source, label = "Source" }: { source: NonNullable<InspectorDto["source"]>; label?: string }) {
  const location = `${source.file}:${source.line}`;
  const content = <><span className="min-w-0 truncate font-mono text-xs">{location}</span>{source.href && <IconExternalLink className="size-4 shrink-0" />}</>;

  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-2">
      <div className="text-xs text-text-faint">Source</div>
      {source.href ? (
        <a href={source.href} aria-label={`Open ${location} in editor`} title="Open in editor" className="flex min-h-9 min-w-0 items-center gap-2 rounded border border-grid-bright bg-background-deep px-3 text-text-bright hover:border-indigo-500/60 hover:bg-background-hover">
          {content}
        </a>
      ) : (
        <div className="flex min-h-9 min-w-0 items-center rounded border border-grid-bright bg-background-deep px-3 text-text-bright">{content}</div>
      )}
    </section>
  );
}

function PropertyList({ values }: { values: Record<string, string | number | null | undefined> }) {
  return <dl className="divide-y divide-grid-dimmed rounded border border-grid-bright">{Object.entries(values).map(([key, value]) => <div key={key} className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2"><dt className="text-xs text-text-faint">{key}</dt><dd className="min-w-0 break-all font-mono text-xs text-text-bright">{value ?? "—"}</dd></div>)}</dl>;
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
function formatOptionalDurationUs(us?: number | null) { return us === null || us === undefined ? "—" : formatDuration(us / 1_000); }
function formatTime(iso?: string | null) { return iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—"; }
function formatBytes(bytes: number) { const absolute = Math.abs(bytes); if (absolute >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; if (absolute >= 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${bytes} B`; }
function formatTtl(seconds: number) { if (seconds >= 86_400 && seconds % 86_400 === 0) return `${seconds / 86_400} ${seconds === 86_400 ? "day" : "days"}`; if (seconds >= 3_600 && seconds % 3_600 === 0) return `${seconds / 3_600} ${seconds === 3_600 ? "hour" : "hours"}`; if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} ${seconds === 60 ? "minute" : "minutes"}`; return `${seconds} ${seconds === 1 ? "second" : "seconds"}`; }
function humanize(value?: string | null) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—"; }
function breadcrumbClass(level?: string) { if (["error", "critical", "alert", "emergency"].includes(level ?? "")) return "bg-error"; if (level === "warning") return "bg-amber-400"; return "bg-cyan-400"; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function barClass(node: TraceNode) { if (node.isError) return "bg-error"; if (node.isPartial) return "bg-amber-500"; if (node.kind === "run") return "bg-success"; if (node.kind === "query") return "bg-query"; if (node.kind === "request") return "bg-cyan-500"; if (node.kind === "cache" || node.kind === "redis") return "bg-amber-500"; if (node.kind === "transaction") return "bg-indigo-500"; if (node.kind === "mail" || node.kind === "notification") return "bg-fuchsia-500"; if (node.kind === "storage") return "bg-emerald-500"; if (node.kind === "process") return "bg-orange-500"; return "bg-charcoal-550"; }
function nodeDurationMs(node: TraceNode, totalDuration: number, queueOffset: number) {
  const duration = node.durationUs === null ? Math.max(0, totalDuration - node.offsetUs / 1_000) : node.durationUs / 1_000;
  return node.parentId === null ? Math.max(0, duration - queueOffset) : duration;
}
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function isAbort(reason: unknown) { return reason instanceof DOMException && reason.name === "AbortError"; }
function mergeRunUpdates(current: RunsPageDto["runs"], updates: RunsPageDto["runs"], statuses?: RunStatus[]) {
  const changed = new Map(updates.map((run) => [run.id, run]));
  return current.flatMap((run) => {
    const next = changed.get(run.id) ?? run;
    return statuses && !statuses.includes(next.status) ? [] : [next];
  });
}

function LoadingState({ label }: { label: string }) {
  return <div className="grid h-full min-h-48 place-items-center text-text-faint"><div className="flex items-center gap-2"><IconRefresh className="size-4 animate-spin" />{label}</div></div>;
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const forbidden = error instanceof SkylineApiError && error.status === 403;
  const message = error instanceof Error ? error.message : "Skyline could not load telemetry.";
  return (
    <div className="grid h-full min-h-48 place-items-center p-6 text-center">
      <div>
        <IconAlertTriangle className="mx-auto mb-3 size-6 text-error" />
        <div className="font-medium text-text-bright">{forbidden ? "Skyline access denied" : "Unable to load Skyline"}</div>
        <p className="mt-1 max-w-md text-sm text-text-faint">{message}</p>
        {!forbidden && <button className="mt-4 rounded border border-grid-bright px-3 py-1.5 text-xs hover:bg-background-hover" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}
