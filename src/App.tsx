import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { scenarios } from "./fixtures";
import type { RunStatus, RunSummary, Scenario, TraceNode } from "./types";
import * as Timeline from "./trigger/Timeline";

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

function currentScenario(location: string): Scenario {
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  return scenarios.find((scenario) => scenario.key === params.get("scenario")) ?? scenarios[0];
}

export function App() {
  const { location, navigate } = useLocation();
  const scenario = currentScenario(location);
  const runMatch = window.location.pathname.match(/\/skyline\/runs\/([^/]+)/);

  return (
    <div className="h-screen overflow-hidden bg-background-dimmed text-[0.8125rem] text-text-dimmed">
      {runMatch ? (
        <TracePage scenario={scenario} runId={decodeURIComponent(runMatch[1])} navigate={navigate} />
      ) : (
        <RunsPage scenario={scenario} navigate={navigate} />
      )}
      <ScenarioBar scenario={scenario} navigate={navigate} />
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="grid h-full overflow-hidden" style={{ gridTemplateColumns: collapsed ? "44px 1fr" : "224px 1fr" }}>
      <aside className="relative flex min-w-0 flex-col border-r border-grid-bright bg-background-bright">
        <button
          className="flex h-11 items-center gap-2 border-b border-grid-bright px-3 text-left text-text-bright hover:bg-background-hover"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-amber-400 font-bold text-charcoal-950">S</span>
          {!collapsed && <span className="font-semibold">Skyline</span>}
          {!collapsed && <IconChevronLeft className="ml-auto size-4 text-text-faint" />}
        </button>

        <div className="px-2 py-3">
          {!collapsed && <div className="mb-1 px-1 text-xs text-text-faint">Environment</div>}
          <div className="flex h-8 items-center gap-2 rounded px-1 text-prod">
            <span className="flex size-5 shrink-0 items-center justify-center rounded border border-prod/40 bg-prod/10">★</span>
            {!collapsed && <span className="font-medium">Local</span>}
          </div>
        </div>

        <nav className="px-2">
          <button
            className={`flex h-8 w-full items-center gap-2 rounded px-1 ${current === "runs" ? "bg-background-raised text-text-bright" : "hover:bg-background-hover"}`}
            onClick={() => navigate("/skyline/?scenario=retry")}
          >
            <IconPlayerPlayFilled className="size-5 shrink-0 text-runs" />
            {!collapsed && <span>Runs</span>}
          </button>
        </nav>

        <div className="mt-auto border-t border-grid-bright p-2">
          <div className="flex h-8 items-center gap-2 px-1 text-text-faint">
            <IconBrandLaravel className="size-5 shrink-0" />
            {!collapsed && <span>Laravel queue monitoring</span>}
          </div>
        </div>
      </aside>
      <main className="min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}

function PageHeader({ children }: { children: React.ReactNode }) {
  return <header className="flex h-11 items-center border-b border-grid-bright bg-background-dimmed px-3 text-sm">{children}</header>;
}

function RunsPage({ scenario, navigate }: { scenario: Scenario; navigate: (to: string) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunStatus | "all">("all");
  const filteredRuns = scenario.runs.filter((run) => {
    const matchesSearch = !search || run.name.toLowerCase().includes(search.toLowerCase()) || run.id.includes(search);
    return matchesSearch && (status === "all" || run.status === status);
  });

  return (
    <Shell current="runs" navigate={navigate}>
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader>
          <div className="flex items-center gap-2 text-text-bright">
            <IconPlayerPlayFilled className="size-4 text-runs" />
            <span className="font-medium">Runs</span>
          </div>
          <button className="ml-auto flex h-7 items-center gap-1 rounded border border-grid-bright bg-background-bright px-2 text-xs hover:bg-background-hover">
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
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {(["all", "running", "retrying", "completed", "failed"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
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
              {filteredRuns.map((run) => (
                <tr
                  key={run.id}
                  className="h-12 cursor-pointer border-b border-grid-dimmed hover:bg-background-hover"
                  onClick={() => {
                    const targetScenario = run.id === scenario.runs[3].id ? "failure" : run.id === scenario.runs[1].id ? "success" : "retry";
                    navigate(`/skyline/runs/${encodeURIComponent(run.id)}?scenario=${targetScenario}&node=${encodeURIComponent(run.id)}&tableState=runs`);
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
                  <td className="px-3 tabular-nums">{run.triggeredAt}</td>
                  <td className="px-3 tabular-nums">{run.queueDuration}</td>
                  <td className="px-3 text-right font-mono tabular-nums text-text-bright">{run.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRuns.length === 0 && <div className="grid h-48 place-items-center text-text-faint">No Runs match these filters.</div>}
        </div>

        <div className="flex h-11 items-center border-t border-grid-bright px-3 text-xs">
          <button disabled className="rounded border border-grid-bright px-2 py-1 opacity-50">Previous</button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-text-faint">1–{filteredRuns.length}</span>
            <button className="rounded border border-grid-bright px-2 py-1 hover:bg-background-hover">Next</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function TracePage({ scenario, runId, navigate }: { scenario: Scenario; runId: string; navigate: (to: string, replace?: boolean) => void }) {
  const run = scenario.runs.find((candidate) => candidate.id === runId) ?? scenario.runs.find((candidate) => candidate.id === scenario.selectedRunId) ?? scenario.runs[0];
  const [search, setSearch] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [queueTime, setQueueTime] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get("node") ?? scenario.nodes[0]?.id);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [treeWidth, setTreeWidth] = useState(42);
  const [inspectorWidth, setInspectorWidth] = useState(33);

  useEffect(() => {
    setSelectedId(new URLSearchParams(window.location.search).get("node") ?? scenario.nodes[0]?.id);
    setCollapsed(new Set());
  }, [scenario.key, runId]);

  const childrenByParent = useMemo(() => {
    const result = new Map<string, TraceNode[]>();
    for (const node of scenario.nodes) {
      if (!node.parentId) continue;
      result.set(node.parentId, [...(result.get(node.parentId) ?? []), node]);
    }
    return result;
  }, [scenario.nodes]);

  const visibleNodes = useMemo(() => {
    const query = search.toLowerCase();
    const match = new Set<string>();
    for (const node of scenario.nodes) {
      if ((!query || node.label.toLowerCase().includes(query)) && (!errorsOnly || node.isError || node.isPartial)) {
        match.add(node.id);
        let parent = node.parentId;
        while (parent) {
          match.add(parent);
          parent = scenario.nodes.find((candidate) => candidate.id === parent)?.parentId;
        }
      }
    }
    return scenario.nodes.filter((node) => {
      if (!match.has(node.id)) return false;
      let parent = node.parentId;
      while (parent) {
        if (collapsed.has(parent)) return false;
        parent = scenario.nodes.find((candidate) => candidate.id === parent)?.parentId;
      }
      return true;
    });
  }, [scenario.nodes, search, errorsOnly, collapsed]);

  const selectedNode = scenario.nodes.find((node) => node.id === selectedId);
  const totalDuration = Math.max(...scenario.nodes.map((node) => node.offsetMs + node.durationMs), 1);
  const queueOffset = queueTime ? 0 : Math.min(312, totalDuration / 4);
  const displayedDuration = Math.max(1, totalDuration - queueOffset);

  const selectNode = useCallback((id?: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("node", id); else params.delete("node");
    navigate(`${window.location.pathname}?${params.toString()}`, true);
  }, [navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "Escape") selectNode(undefined);
      if (event.key.toLowerCase() === "q") setQueueTime((value) => !value);
      if (event.key.toLowerCase() === "e") setCollapsed(new Set());
      if (event.key.toLowerCase() === "w") setCollapsed(new Set(scenario.nodes.filter((node) => childrenByParent.has(node.id)).map((node) => node.id)));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const index = Math.max(0, visibleNodes.findIndex((node) => node.id === selectedId));
        const next = event.key === "ArrowDown" ? Math.min(visibleNodes.length - 1, index + 1) : Math.max(0, index - 1);
        selectNode(visibleNodes[next]?.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [childrenByParent, scenario.nodes, selectNode, selectedId, visibleNodes]);

  return (
    <Shell current="runs" navigate={navigate}>
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader>
          <button className="text-text-faint hover:text-text-bright" onClick={() => navigate("/skyline/?scenario=retry")}>Runs</button>
          <span className="mx-2 text-text-faint">/</span>
          <span className="font-mono text-text-bright">{run.id}</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="flex h-7 items-center gap-1 rounded border border-grid-bright bg-background-bright px-2 text-xs hover:bg-background-hover"><IconRefresh className="size-3.5" /> Refresh</button>
          </div>
        </PageHeader>

        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-grid-bright px-3">
          {scenario.key === "success" ? (
            <button className="flex items-center gap-1 text-xs text-text-faint hover:text-text-bright" onClick={() => navigate(`/skyline/runs/${scenario.runs[0].id}?scenario=retry&node=${scenario.runs[1].id}`)}>
              <IconStack2 className="size-4" /> Root/parent Run <span className="rounded border border-grid-bright px-1 font-mono text-xxs">P</span>
            </button>
          ) : <div className="text-xs text-text-faint">Root Run</div>}
          <label className="ml-auto flex h-7 w-64 items-center gap-2 rounded border border-grid-bright bg-input-bg px-2">
            <IconSearch className="size-3.5 text-text-faint" />
            <input className="w-full border-0 bg-transparent p-0 text-xs text-text-bright placeholder:text-text-faint focus:ring-0" placeholder="Search Trace" value={search} onChange={(event) => setSearch(event.target.value)} />
            {search && <button onClick={() => setSearch("")}><IconX className="size-3.5" /></button>}
          </label>
          <Toggle label="Queue time" value={queueTime} onChange={setQueueTime} shortcut="Q" />
          <Toggle label="Errors only" value={errorsOnly} onChange={setErrorsOnly} />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden" style={{ display: "grid", gridTemplateColumns: selectedNode ? `minmax(0, 1fr) 3px minmax(320px, ${inspectorWidth}%)` : "1fr 0 0" }}>
          <div className="min-w-0 overflow-hidden bg-background-dimmed">
            <div className="grid h-full min-w-0 overflow-hidden" style={{ gridTemplateColumns: `${treeWidth}% 3px minmax(0, 1fr)` }}>
              <div className="min-w-0 overflow-hidden">
                <div className="flex h-8 items-center border-b border-grid-bright px-3 text-xs text-text-faint">Trace</div>
                <div className="h-[calc(100%-2rem)] overflow-auto">
                  {visibleNodes.map((node) => (
                    <TreeRow key={node.id} node={node} selected={selectedId === node.id} hasChildren={childrenByParent.has(node.id)} collapsed={collapsed.has(node.id)} onToggle={() => setCollapsed((current) => toggleSet(current, node.id))} onSelect={() => selectNode(node.id)} />
                  ))}
                </div>
              </div>
              <DragHandle onDrag={(delta) => setTreeWidth((value) => clamp(value + delta / 12, 25, 70))} />
              <div className="min-w-0 overflow-auto">
                <Timeline.Root durationMs={displayedDuration} scale={0.08} minWidth={700} maxWidth={1800} className="min-h-full">
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
            </div>
          </div>
          <DragHandle onDrag={(delta) => setInspectorWidth((value) => clamp(value - delta / 12, 24, 52))} hidden={!selectedNode} />
          {selectedNode && <Inspector node={selectedNode} run={scenario.runs.find((candidate) => candidate.id === selectedNode.runId) ?? run} onClose={() => selectNode(undefined)} />}
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

function TreeRow({ node, selected, hasChildren, collapsed, onToggle, onSelect }: { node: TraceNode; selected: boolean; hasChildren: boolean; collapsed: boolean; onToggle: () => void; onSelect: () => void }) {
  return (
    <div data-node-id={node.id} className={`flex h-8 cursor-pointer items-center border-b border-grid-dimmed pr-2 ${selected ? "bg-indigo-500/10 text-text-bright" : "hover:bg-background-hover"}`} onClick={onSelect}>
      <div style={{ width: `${node.level * 20 + 6}px` }} className="shrink-0" />
      <button className={`mr-1 grid size-5 shrink-0 place-items-center ${hasChildren ? "text-text-faint" : "invisible"}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
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

function Inspector({ node, run, onClose }: { node: TraceNode; run: RunSummary; onClose: () => void }) {
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
        <div className="flex h-9 shrink-0 items-end border-b border-grid-bright px-3">
          {tabs.map((value) => <button key={value} onClick={() => setTab(value)} className={`mr-5 h-9 border-b-2 text-xs ${tab === value ? "border-indigo-500 text-text-bright" : "border-transparent text-text-faint"}`}>{value}</button>)}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tab === "Overview" && <Overview node={node} run={run} />}
          {tab === "Detail" && <Detail node={node} run={run} />}
          {tab === "Context" && <PropertyList values={{ runId: node.runId, nodeId: node.id, parentId: node.parentId ?? "—", kind: node.kind }} />}
          {tab === "Metadata" && <pre className="overflow-auto rounded border border-grid-bright bg-background-deep p-3 font-mono text-xs leading-5 text-text-bright">{JSON.stringify(node.metadata, null, 2)}</pre>}
        </div>
      </div>
    </aside>
  );
}

function Overview({ node, run }: { node: TraceNode; run: RunSummary }) {
  return (
    <div className="space-y-4">
      <Status status={node.status} />
      {node.kind === "run" && (
        <div className="rounded border border-grid-bright bg-background-dimmed p-3">
          <Lifecycle label="Triggered" value={run.triggeredAt} first />
          <Lifecycle label="Queued" value={run.queueDuration === "—" ? "Waiting" : `${run.queueDuration} queue time`} />
          <Lifecycle label="Started" value={run.attemptCount ? "Worker received Job" : "Not started"} />
          <Lifecycle label={run.status === "failed" ? "Failed" : "Finished"} value={run.duration} last />
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

function Detail({ node, run }: { node: TraceNode; run: RunSummary }) {
  if (node.kind === "query") return <div><div className="mb-2 text-xs text-text-faint">Parameterized SQL</div><pre className="whitespace-pre-wrap rounded border border-grid-bright bg-background-deep p-3 font-mono text-xs leading-5 text-text-bright">{node.sql}</pre></div>;
  return <PropertyList values={{ Job: run.name, Connection: run.connection, Queue: run.queue, Attempts: run.attemptCount, Duration: run.duration }} />;
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

function DragHandle({ onDrag, hidden }: { onDrag: (delta: number) => void; hidden?: boolean }) {
  return <div data-testid="resize-handle" className={`group relative z-20 cursor-col-resize bg-grid-bright ${hidden ? "pointer-events-none opacity-0" : ""}`} onPointerDown={(event) => { const start = event.clientX; const move = (moveEvent: PointerEvent) => onDrag(moveEvent.clientX - start); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }}><div className="absolute inset-y-0 -left-1 w-3 group-hover:bg-indigo-500/30" /></div>;
}

function ScenarioBar({ scenario, navigate }: { scenario: Scenario; navigate: (to: string, replace?: boolean) => void }) {
  const switchScenario = (next: Scenario) => {
    const isDetail = window.location.pathname.includes("/runs/");
    navigate(isDetail ? `/skyline/runs/${next.selectedRunId}?scenario=${next.key}&node=${next.nodes[0].id}` : `/skyline/?scenario=${next.key}`, true);
  };
  const index = scenarios.findIndex((candidate) => candidate.key === scenario.key);
  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-charcoal-500 bg-charcoal-950/95 p-1 shadow-2xl backdrop-blur">
      <button className="grid size-7 place-items-center rounded-full hover:bg-charcoal-700" onClick={() => switchScenario(scenarios[(index - 1 + scenarios.length) % scenarios.length])}><IconArrowLeft className="size-4" /></button>
      <div className="min-w-40 px-2 text-center text-xs text-charcoal-200"><span className="mr-1 text-amber-400">PROTOTYPE</span> {scenario.label}</div>
      <button className="grid size-7 place-items-center rounded-full hover:bg-charcoal-700" onClick={() => switchScenario(scenarios[(index + 1) % scenarios.length])}><IconArrowRight className="size-4" /></button>
    </div>
  );
}

function shortName(name: string) { return name.split("\\").at(-1) ?? name; }
function formatDuration(ms: number) { return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s` : `${Math.round(ms)}ms`; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function toggleSet(current: Set<string>, key: string) { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }
function barClass(node: TraceNode) { if (node.isError) return "bg-error"; if (node.isPartial) return "bg-amber-500"; if (node.kind === "run") return "bg-success"; return "bg-charcoal-550"; }
