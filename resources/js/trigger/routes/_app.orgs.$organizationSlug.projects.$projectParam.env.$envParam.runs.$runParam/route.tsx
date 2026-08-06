/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server loaders, tenants, streaming, replay, cancellation, and deployment/runtime fields are external or omitted.
 */
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/20/solid";
import { Link, useLoaderData, useNavigate, useRevalidator, useRouteError, useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Badge } from "~/components/primitives/Badge";
import { CopyableText } from "~/components/primitives/CopyableText";
import { Header3 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Popover, PopoverArrowTrigger, PopoverContent } from "~/components/primitives/Popover";
import {
  RESIZABLE_PANEL_ANIMATION,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  collapsibleHandleClassName,
  useFrozenValue,
} from "~/components/primitives/Resizable";
import { SearchInput } from "~/components/primitives/SearchInput";
import { Slider } from "~/components/primitives/Slider";
import { Spinner } from "~/components/primitives/Spinner";
import { Switch } from "~/components/primitives/Switch";
import * as Timeline from "~/components/primitives/Timeline";
import { RunIcon, type NodeKind } from "~/components/runs/v3/RunIcon";
import { TaskRunStatusCombo, TaskRunStatusIcon, type RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { TreeView, type FlatTree, useTree } from "~/primitives/TreeView/TreeView";
import { cn } from "~/utils/cn";
import { ExceptionPreview, type ExceptionPreviewData } from "~/ExceptionPreview";

type AttemptStatus = "running" | "completed" | "released" | "failed";
type TraceNode = {
  id: string;
  parentId: string | null;
  runId: string;
  kind: NodeKind;
  label: string;
  level: number;
  offsetUs: number;
  durationUs: number | null;
  status: RunStatus | AttemptStatus;
  isError: boolean;
  isPartial: boolean;
  hasErrorDescendant: boolean;
  children: string[];
  hasChildren: boolean;
  timelineEvents: Array<{ name: string; offsetUs: number }>;
  inspectorHref: string;
  telemetryEventHref: string | null;
};
type Inspector = TraceNode & {
  overview: Record<string, string | number | null>;
  context?: { value: unknown; isTruncated: boolean };
  exception?: ExceptionPreviewData | null;
  source?: { file: string; line: number; href: string | null } | null;
  metadata: { value: Record<string, unknown>; isTruncated: boolean };
  detailSections: Array<{ label: string; value: unknown }>;
};
type InspectorDetailsRenderer = ComponentType<{ inspector: Inspector }>;
type PanelHandle = NonNullable<React.ComponentProps<typeof ResizablePanel>["handle"]> extends React.Ref<infer Handle> ? Handle : never;
type RouteData = {
  generatedAt: string;
  run: {
    id: string;
    traceId: string;
    rootRunId: string | null;
    parentRunId: string | null;
    jobType: string;
    queueTarget: string;
    driverId: string | null;
    status: RunStatus;
    triggeredAt: string;
    queuedAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    queueDurationUs: number | null;
    queueTimeSource: string | null;
    durationUs: number | null;
    attemptCount: number;
  };
  attempts: Array<{
    id: string;
    number: number;
    status: AttemptStatus;
    startedAt: string;
    finishedAt: string | null;
    queueDurationUs: number | null;
    queueTimeSource: string | null;
    failure: { class: string; message: string; messageTruncated: boolean } | null;
    path: string;
  }>;
  relationships: {
    parent: { id: string; path: string } | null;
    children: Array<{ id: string; name?: string; status?: RunStatus; path: string }>;
  };
  trace: {
    revision: number;
    rootStatus: "executing" | "completed" | "failed";
    rootStartedAt: string;
    durationUs: number | null;
    activeDurationUs: number | null;
    queuedDurationUs: number | null;
    nodes: TraceNode[];
    nodeCount: number;
    isTruncated: boolean;
    polling: boolean;
    pollIntervalMs: number;
  };
  navigation: { previousPath: string | null; nextPath: string | null; runsPath: string };
  loadInspector: (nodeId: string, signal?: AbortSignal) => Promise<Inspector>;
  renderInspectorDetails: InspectorDetailsRenderer;
};

const panels = {
  parent: { handle: "parent-handle", main: "run", inspector: "inspector" },
  tree: { handle: "tree-handle", tree: "tree", timeline: "timeline" },
};

export default function RunDetailRoute() {
  const data = useLoaderData() as RouteData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [params, setParams] = useSearchParams();
  const rootNodeId = data.trace.nodes[0]?.id;
  const selectedParam = params.get("node") ?? undefined;
  const inspectorPanelHandle = useRef<PanelHandle>(null);
  const rememberedSelection = useRef<{ runId: string; nodeId?: string }>({ runId: data.run.id, nodeId: selectedParam });

  if (rememberedSelection.current.runId !== data.run.id) {
    rememberedSelection.current = { runId: data.run.id, nodeId: selectedParam };
  }

  const selectedId = selectedParam ?? (rememberedSelection.current.nodeId ? undefined : rootNodeId);

  useEffect(() => {
    if (selectedParam) rememberedSelection.current.nodeId = selectedParam;
  }, [selectedParam]);

  useEffect(() => {
    void (selectedId ? inspectorPanelHandle.current?.expand() : inspectorPanelHandle.current?.collapse());
  }, [selectedId]);

  useEffect(() => {
    if (selectedParam || rememberedSelection.current.nodeId || !rootNodeId) return;
    const next = new URLSearchParams(params);
    next.set("node", rootNodeId);
    setParams(next, { replace: true });
  }, [data.run.id, rootNodeId, selectedParam]);

  useEffect(() => {
    if (!data.trace.polling) return;
    const timer = window.setInterval(() => revalidator.revalidate(), data.trace.pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [data.trace.polling, data.trace.pollIntervalMs, revalidator.revalidate]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isEditable(event.target)) return;
      const tableState = params.get("tableState");
      const rootPath = data.run.rootRunId && data.run.rootRunId !== data.run.id
        ? `/runs/${encodeURIComponent(data.run.rootRunId)}${tableState ? `?tableState=${encodeURIComponent(tableState)}` : ""}`
        : null;
      const path = event.key.toLowerCase() === "j" ? data.navigation.previousPath
        : event.key.toLowerCase() === "k" ? data.navigation.nextPath
          : event.key.toLowerCase() === "p" ? data.relationships.parent?.path
            : event.key.toLowerCase() === "t" ? rootPath
            : null;
      if (!path) return;
      event.preventDefault();
      navigate(path, { replace: ["j", "k"].includes(event.key.toLowerCase()) });
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [data.run.id, data.run.rootRunId, data.navigation.previousPath, data.navigation.nextPath, data.relationships.parent?.path, navigate, params]);

  const select = useCallback((nodeId: string | undefined) => {
    const next = new URLSearchParams(params);
    nodeId ? next.set("node", nodeId) : next.delete("node");
    setParams(next);
  }, [params, setParams]);

  return (
    <PageContainer>
      <NavBar>
        <PageTitle
          backButton={{ to: data.navigation.runsPath, text: "Runs" }}
          title={
            <div className="flex items-center gap-x-0">
              <CopyableText
                value={data.run.id}
                variant="text-below"
                className="-ml-1.75 h-6 px-1.5 font-mono text-xs hover:text-text-bright"
              />
              {params.get("tableState") && (
                <div className="flex">
                  <AdjacentLink label="Previous Run" path={data.navigation.previousPath} icon={<ChevronUpIcon />} />
                  <AdjacentLink label="Next Run" path={data.navigation.nextPath} icon={<ChevronDownIcon />} />
                </div>
              )}
            </div>
          }
        />
      </NavBar>
      <PageBody scrollable={false} className="relative p-0">
        {revalidator.state !== "idle" && (
          <div role="status" className="absolute right-3 top-2 z-50 rounded bg-background-bright px-2 py-1 text-xs text-text-dimmed shadow">
            Refreshing Run…
          </div>
        )}
        <ResizablePanelGroup autosaveId="panel-run-parent-v3">
          <ResizablePanel id={panels.parent.main} min="100px">
            <TraceView key={data.run.id} data={data} selectedId={selectedId} onSelect={select} />
          </ResizablePanel>
          <ResizableHandle
            id={panels.parent.handle}
            className={collapsibleHandleClassName(Boolean(selectedId))}
          />
          <ResizablePanel
            id={panels.parent.inspector}
            handle={inspectorPanelHandle}
            default="500px"
            min="250px"
            collapsible
            defaultCollapsed={!selectedId}
            collapsedSize="0px"
            collapseAnimation={RESIZABLE_PANEL_ANIMATION}
            isStaticAtRest
            aria-hidden={!selectedId}
            {...(!selectedId ? { inert: "" } : {})}
            className={cn("max-w-full overflow-hidden transition-[max-width] duration-300 ease-in-out", !selectedId && "max-w-0")}
          >
            <InspectorPanel data={data} selectedId={selectedId} onClose={() => select(undefined)} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </PageBody>
    </PageContainer>
  );
}

function TraceView({ data, selectedId, onSelect }: { data: RouteData; selectedId?: string; onSelect: (id?: string) => void }) {
  const [params, setParams] = useSearchParams();
  const search = params.get("traceSearch") ?? "";
  const errorsOnly = params.get("errors") === "true";
  const showQueue = params.get("queue") === "true";
  const scale = Number(params.get("scale") ?? 0);
  const parentRef = useRef<HTMLDivElement>(null);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const tree = useMemo<FlatTree<TraceNode>>(() => data.trace.nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId ?? undefined,
    runId: node.runId,
    children: node.children,
    hasChildren: node.hasChildren,
    level: node.level,
    data: node,
  })), [data.trace.nodes]);
  const state = useTree({
    tree,
    selectedId,
    onSelectedIdChanged: (nextSelectedId) => {
      if (nextSelectedId !== selectedId) onSelect(nextSelectedId);
    },
    estimatedRowHeight: () => 32,
    parentRef,
    filter: {
      value: { search, errorsOnly },
      fn: (value, node) => (!value.errorsOnly || node.data.isError)
        && (!value.search || node.data.label.toLowerCase().includes(value.search.toLowerCase())),
    },
  });

  useEffect(() => {
    parentRef.current?.setAttribute("aria-label", "Run trace");
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isEditable(event.target)) return;
      if (event.key.toLowerCase() === "e") state.expandAllBelowDepth(0);
      else if (event.key.toLowerCase() === "w") state.collapseAllBelowDepth(1);
      else if (/^[0-9]$/.test(event.key)) state.toggleExpandLevel(Number(event.key));
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [state]);

  const update = (key: string, value: string | boolean | number | undefined) => {
    const next = new URLSearchParams(params);
    if (value === undefined || value === false || value === "" || value === 0) next.delete(key);
    else next.set(key, String(value));
    setParams(next, { replace: true });
  };

  return (
    <div className="grid h-full grid-rows-[2.5rem_1fr_3.25rem] overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-grid-dimmed px-1.5">
        <SearchInput placeholder="Search logs…" value={search} onValueChange={(value) => update("traceSearch", value)} />
        <div className="flex items-center gap-1.5">
          <Switch variant="secondary/small" label="Queue time" checked={showQueue} onCheckedChange={(checked) => update("queue", checked)} shortcut={{ key: "Q" }} />
          <Switch variant="secondary/small" label="Errors only" checked={errorsOnly} onCheckedChange={(checked) => update("errors", checked)} />
        </div>
      </div>
      <ResizablePanelGroup autosaveId="panel-run-tree">
        <ResizablePanel id={panels.tree.tree} default="50%" min="50px">
          <div className="grid h-full grid-rows-[2rem_1fr] overflow-hidden">
            <div className="flex items-center justify-between pl-1 pr-2 text-xs text-text-faint">
              <span className="flex min-w-0 items-center gap-3">
                <RelationshipLinks data={data} />
                {data.trace.isTruncated && <span role="status" className="truncate text-warning">Showing {data.trace.nodes.length} of {data.trace.nodeCount} nodes</span>}
              </span>
              {data.trace.polling && (
                <span className="flex shrink-0 items-center gap-1 text-blue-500"><span className="size-2 animate-pulse rounded-full bg-blue-500" />Live reloading</span>
              )}
              {data.trace.rootStatus === "executing" && !data.trace.polling && (
                <span className="shrink-0 text-text-faint">Live updates paused</span>
              )}
            </div>
            <TreeView
              parentRef={parentRef}
              scrollRef={treeScrollRef}
              virtualizer={state.virtualizer}
              autoFocus
              tree={tree}
              nodes={state.nodes}
              getNodeProps={state.getNodeProps}
              getTreeProps={state.getTreeProps}
              parentClassName="pl-3"
              onScroll={(top) => { if (timelineScrollRef.current) timelineScrollRef.current.scrollTop = top; }}
              renderNode={({ node, state: nodeState }) => (
                <TraceRow
                  node={node.data}
                  selected={nodeState.selected}
                  expanded={nodeState.expanded}
                  onSelect={() => state.selectNode(node.id)}
                  onToggle={(level) => level ? state.toggleExpandLevel(node.data.level) : state.toggleExpandNode(node.id)}
                />
              )}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle id={panels.tree.handle} />
        <ResizablePanel id={panels.tree.timeline} default="50%" min="50px">
          <TraceTimeline
            data={data}
            tree={tree}
            state={state}
            showQueue={showQueue}
            scale={Number.isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 0}
            treeScrollRef={treeScrollRef}
            timelineScrollRef={timelineScrollRef}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="flex items-center justify-between border-t border-grid-dimmed px-4 text-xs text-text-dimmed">
        <Popover>
          <PopoverArrowTrigger>Shortcuts</PopoverArrowTrigger>
          <PopoverContent className="min-w-80 p-2" align="start">
            <Header3 spacing>Keyboard shortcuts</Header3>
            <div className="flex flex-col gap-2 text-xs text-text-dimmed">
              <span>↑ ↓ ← → Navigate</span>
              <span>E / W Expand or collapse</span>
              <span>0–9 Toggle depth</span>
              <span>Esc Close · J / K Runs</span>
            </div>
          </PopoverContent>
        </Popover>
        <Slider
          aria-label="Timeline zoom"
          variant="tertiary"
          className="w-20"
          LeadingIcon={MagnifyingGlassMinusIcon}
          TrailingIcon={MagnifyingGlassPlusIcon}
          value={[scale]}
          onValueChange={([value]) => update("scale", value)}
          min={0}
          max={1}
          step={0.05}
        />
      </div>
    </div>
  );
}

function TraceRow({ node, selected, expanded, onSelect, onToggle }: { node: TraceNode; selected: boolean; expanded: boolean; onSelect: () => void; onToggle: (level: boolean) => void }) {
  return (
    <div
      data-node-id={node.id}
      data-node-kind={node.kind}
      className={cn(
        "group/spannode flex h-8 cursor-pointer items-center overflow-hidden rounded-l-sm pr-2",
        selected ? "bg-grid-dimmed hover:bg-grid-bright" : "hover:bg-grid-dimmed",
      )}
      onClick={onSelect}
    >
      <span className="flex h-8 shrink-0">
        {Array.from({ length: node.level }).map((_, index) => <span key={index} className="h-8 w-2 border-r border-grid-bright" />)}
      </span>
      {node.hasChildren ? (
        <button
          type="button"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`}
          className="flex size-4 shrink-0 items-center hover:bg-surface-control"
          onClick={(event) => { event.stopPropagation(); onToggle(event.altKey); }}
        >
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>
      ) : <span className="size-4 shrink-0" />}
      <span className="ml-1 flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <RunIcon kind={node.kind} className="size-5 min-h-5 min-w-5" />
          <span className={cn("truncate", node.isError ? "text-error" : node.kind === "attempt" ? "text-text-dimmed group-hover/spannode:text-text-bright" : "text-text-link")}>{node.label}</span>
          {node.kind === "run" && node.level === 0 && <Badge variant="extra-small">Root</Badge>}
        </span>
        <TaskRunStatusIcon status={nodeStatus(node)} className="size-4 shrink-0" />
      </span>
    </div>
  );
}

function TraceTimeline({ data, tree, state, showQueue, scale, treeScrollRef, timelineScrollRef }: {
  data: RouteData;
  tree: FlatTree<TraceNode>;
  state: ReturnType<typeof useTree<TraceNode, { search: string; errorsOnly: boolean }>>;
  showQueue: boolean;
  scale: number;
  treeScrollRef: React.RefObject<HTMLDivElement>;
  timelineScrollRef: React.RefObject<HTMLDivElement>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalUs = traceDuration(data);
  const queueUs = boundedQueueDuration(data, totalUs);
  const shiftUs = showQueue ? 0 : queueUs;
  const visibleUs = Math.max(1, totalUs - shiftUs);
  const coordinateUs = visibleUs;
  const width = containerRef.current?.clientWidth ?? 300;

  return (
    <div ref={containerRef} className="h-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <Timeline.Root durationMs={coordinateUs / 1_000} scale={scale} minWidth={width} maxWidth={width * 10} className="h-full" >
        <Timeline.EquallyDistribute count={5}>
          {(milliseconds, index) => (
            <Timeline.Point ms={milliseconds} className="top-0 h-8">
              {() => (
                <span className="relative block h-full border-l border-grid-dimmed">
                  {index < 4 && <span className="absolute left-1 top-2 whitespace-nowrap text-xxs text-text-faint">{formatDuration(milliseconds * 1_000)}</span>}
                </span>
              )}
            </Timeline.Point>
          )}
        </Timeline.EquallyDistribute>
        {data.trace.rootStatus !== "executing" && (
          <Timeline.Point ms={visibleUs / 1_000} className="bottom-0 top-8 z-10">
            {() => <span data-timeline-terminal className="block h-full border-l border-grid-bright" />}
          </Timeline.Point>
        )}
        <Timeline.Row className="grid h-full grid-rows-[2rem_1fr]">
          <div className="border-b border-grid-dimmed" />
          <TreeView
            scrollRef={timelineScrollRef}
            virtualizer={state.virtualizer}
            tree={tree}
            nodes={state.nodes}
            getNodeProps={state.getNodeProps}
            getTreeProps={state.getTreeProps}
            parentClassName="h-full scrollbar-hide"
            onScroll={(top) => { if (treeScrollRef.current) treeScrollRef.current.scrollTop = top; }}
            renderNode={({ node, state: nodeState }) => {
              const startUs = Math.max(0, node.data.offsetUs - shiftUs);
              const durationUs = Math.max(0, Math.min(node.data.durationUs ?? visibleUs - startUs, visibleUs - startUs));
              const point = durationUs / coordinateUs < 0.01;
              return (
                <Timeline.Row
                  data-timeline-row-kind={node.data.kind}
                  className={cn("group flex h-8 items-center", nodeState.selected ? "bg-grid-dimmed" : "hover:bg-grid-dimmed")}
                  onClick={() => state.toggleNodeSelection(node.id)}
                >
                  {point ? (
                    <Timeline.Point ms={startUs / 1_000}>
                      {() => <span className="flex items-center gap-1">
                        <span data-timeline-node-point-id={node.id} title={`${node.data.label} · Started ${formatDuration(startUs)} · Duration ${formatDuration(durationUs)}`} className={cn("block h-4 w-0.5", nodeColor(node.data))} />
                        <span className="whitespace-nowrap text-xxs text-text-bright">{formatDuration(durationUs)}</span>
                      </span>}
                    </Timeline.Point>
                  ) : (
                    <Timeline.Span startMs={startUs / 1_000} durationMs={durationUs / 1_000}>
                      <motion.div
                        data-timeline-node-id={node.id}
                        title={`${node.data.label} · Started ${formatDuration(startUs)} · Duration ${formatDuration(durationUs)}`}
                        className={cn("relative h-4 min-w-0.5 overflow-hidden rounded-sm", nodeColor(node.data))}
                        style={node.data.kind === "run" ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 2px, rgb(255 255 255 / 0.16) 2px 4px)" } : undefined}
                        layoutId={data.trace.rootStatus === "executing" ? node.id : undefined}
                      >
                        {node.data.isPartial && <span className="absolute inset-0 animate-pulse bg-white/10" />}
                        <span className="relative z-10 px-1 text-xxs text-text-bright">{formatDuration(durationUs)}</span>
                      </motion.div>
                    </Timeline.Span>
                  )}
                  {node.data.timelineEvents.map((event, index) => {
                    const eventUs = event.offsetUs - shiftUs;
                    if (eventUs < 0 || eventUs > visibleUs) return null;
                    return (
                      <Timeline.Point key={`${event.name}-${index}`} ms={eventUs / 1_000}>
                        {() => <span data-timeline-event={event.name} title={`${event.name} · ${formatDuration(eventUs)}`} className="block h-4 w-px bg-text-dimmed" />}
                      </Timeline.Point>
                    );
                  })}
                </Timeline.Row>
              );
            }}
          />
        </Timeline.Row>
      </Timeline.Root>
    </div>
  );
}

function InspectorPanel({ data, selectedId, onClose }: { data: RouteData; selectedId?: string; onClose: () => void }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const [inspector, setInspector] = useState<Inspector>();
  const [error, setError] = useState<Error>();
  const frozenId = useFrozenValue(selectedId);
  const node = data.trace.nodes.find((candidate) => candidate.id === frozenId);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    let active = true;
    setInspector(undefined);
    setError(undefined);
    void data.loadInspector(selectedId, controller.signal)
      .then((nextInspector) => { if (active) setInspector(nextInspector); })
      .catch((reason) => {
        if (!controller.signal.aborted && active) {
          setInspector(undefined);
          setError(reason instanceof Error ? reason : new Error("Inspector unavailable."));
        }
      });
    return () => { active = false; controller.abort(); };
  }, [data.generatedAt, data.trace.revision, selectedId]);

  useEffect(() => {
    if (tab !== "context" || !inspector || inspector.context) return;
    const next = new URLSearchParams(params);
    next.delete("tab");
    setParams(next, { replace: true });
  }, [inspector, params, setParams, tab]);

  if (!frozenId) return null;

  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(params);
    nextTab === "overview" ? next.delete("tab") : next.set("tab", nextTab);
    setParams(next);
  };
  const failure = data.attempts.find((attempt) => attempt.id === frozenId)?.failure;

  return (
    <section className="grid h-full grid-rows-[2.5rem_2rem_1fr] overflow-hidden bg-background-bright" aria-label="Run inspector">
      <div className="flex items-center justify-between gap-2 overflow-x-hidden px-3 pr-2">
        <div className="flex min-w-0 items-center gap-1">
          <RunIcon kind={node?.kind ?? "run"} className="size-5 min-h-5 min-w-5" />
          <Header3 className="truncate text-blue-500">{node?.label ?? "Inspector"}</Header3>
        </div>
        <button type="button" aria-label="Close inspector" title="Close inspector (Esc)" className="flex h-6 shrink-0 items-center gap-1 rounded px-1 text-xxs text-text-faint hover:bg-background-raised hover:text-text-bright" onClick={onClose}>
          <kbd className="rounded-sm border border-border-bright px-1 font-mono">Esc</kbd><span>→</span>
        </button>
      </div>
      <div role="tablist" className="flex gap-6 border-b border-grid-bright px-3">
        {[{ id: "overview", label: "Overview", key: "o" }, { id: "detail", label: "Detail", key: "d" }, ...(inspector?.context ? [{ id: "context", label: "Context", key: "x" }] : []), { id: "metadata", label: "Metadata", key: "m" }].map((item) => (
          <InspectorTab key={item.id} active={tab === item.id} enabled={Boolean(selectedId)} shortcut={item.key} onClick={() => setTab(item.id)}>{item.label}</InspectorTab>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab[0].toUpperCase() + tab.slice(1)} className="overflow-y-auto px-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        {!inspector && !error && <div className="grid h-full place-items-center" aria-label="Loading inspector"><Spinner /></div>}
        {error && <div role="alert" className="text-error">{error.message}</div>}
        {inspector && tab === "overview" && <InspectorOverview data={data} node={node} inspector={inspector} failure={failure} />}
        {inspector && tab === "detail" && <InspectorDetails inspector={inspector} renderDetails={data.renderInspectorDetails} />}
        {inspector?.context && tab === "context" && (
          <div className="py-3">
            {inspector.context.isTruncated && <p role="status" className="mb-2 text-xs text-warning">Context was truncated when captured.</p>}
            <pre className="overflow-auto whitespace-pre-wrap rounded border border-grid-bright bg-background-dimmed p-3 font-mono text-xs text-text-dimmed">{JSON.stringify(inspector.context.value, null, 2)}</pre>
          </div>
        )}
        {inspector && tab === "metadata" && (
          <pre className="my-3 overflow-auto whitespace-pre-wrap rounded border border-grid-bright bg-background-dimmed p-3 font-mono text-xs text-text-dimmed">{JSON.stringify(inspector.metadata.value, null, 2)}</pre>
        )}
      </div>
    </section>
  );
}

function InspectorOverview({ data, node, inspector, failure }: {
  data: RouteData;
  node?: TraceNode;
  inspector: Inspector;
  failure?: { class: string; message: string; messageTruncated: boolean } | null;
}) {
  const isRouteRun = inspector.runId === data.run.id;
  const attempt = node?.kind === "attempt" ? data.attempts.find((candidate) => candidate.id === node.id) : undefined;
  if (attempt && inspector.exception) {
    const attemptRun = { ...data.run, startedAt: attempt.startedAt, finishedAt: attempt.finishedAt, durationUs: inspector.durationUs };
    return (
      <div className="flex flex-col gap-4 pt-3">
        <div className="border-b border-grid-bright pb-3">
          <TaskRunStatusCombo status={nodeStatus(inspector)} className="text-sm" />
        </div>
        <RunLifecycleTimeline run={attemptRun} />
        <div className="-mt-[1.1875rem]">
          <ExceptionPreview key={inspector.id} exception={inspector.exception} extensionId="attempt-exception-evidence" />
        </div>
      </div>
    );
  }
  if (node?.kind === "run" && isRouteRun) {
    return (
      <div className="flex flex-col gap-4 pt-3">
        <div className="border-b border-grid-bright pb-3">
          <TaskRunStatusCombo status={nodeStatus(inspector)} className="text-sm" />
        </div>
        <RunLifecycleTimeline run={data.run} />
        {inspector.exception && <ExceptionPreview key={inspector.id} exception={inspector.exception} extensionId="attempt-exception-evidence" />}
      </div>
    );
  }
  return (
    <div className="space-y-4 py-3">
      <div className="flex items-center justify-between">
        <Header3>{node?.label ?? inspector.label}</Header3>
        <TaskRunStatusCombo status={nodeStatus(inspector)} />
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
        <Property name="Run" value={inspector.runId} />
        <Property name="Job type" value={isRouteRun ? data.run.jobType : null} />
        <Property name="Queue target" value={isRouteRun ? data.run.queueTarget : null} />
        <Property name="Driver" value={isRouteRun ? data.run.driverId : null} />
        <Property name="Queue-time source" value={isRouteRun ? data.run.queueTimeSource : null} />
        <Property name="Attempts" value={isRouteRun ? data.run.attemptCount : null} />
        <Property name="Triggered" value={isRouteRun ? data.run.triggeredAt : null} />
        <Property name="Queued" value={isRouteRun ? data.run.queuedAt : null} />
        <Property name="Started" value={attempt ? attempt.startedAt : (isRouteRun ? data.run.startedAt : null)} />
        <Property name="Finished" value={attempt ? attempt.finishedAt : (isRouteRun ? data.run.finishedAt : null)} />
        <Property name="Queue duration" value={formatDuration(attempt ? attempt.queueDurationUs : (isRouteRun ? data.run.queueDurationUs : null))} />
        {attempt && <Property name="Attempt" value={attempt.number} />}
        {attempt && <Property name="Attempt queue source" value={attempt.queueTimeSource} />}
        <Property name="Duration" value={formatDuration(node ? node.durationUs : data.run.durationUs)} />
      </dl>
      {inspector.exception
        ? <ExceptionPreview key={inspector.id} exception={inspector.exception} extensionId="attempt-exception-evidence" />
        : failure && (
          <div role="status" className="rounded border border-grid-bright bg-background-bright p-3 text-sm text-text-dimmed">
            Exception evidence unavailable. Skyline retained only the captured {failure.class} summary.
          </div>
        )}
    </div>
  );
}

function RunLifecycleTimeline({ run }: { run: RouteData["run"] }) {
  const entries = [
    { label: "Triggered", value: run.triggeredAt },
    { label: "Dequeued", value: run.startedAt },
    { label: "Started", value: run.startedAt },
    { label: "Finished", value: run.finishedAt },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

  return (
    <ol className="max-w-80">
      {entries.map((entry, index) => {
        const previous = index > 0 ? new Date(entries[index - 1].value) : null;
        const current = new Date(entry.value);
        const elapsed = previous ? Math.max(0, current.getTime() - previous.getTime()) : null;
        return (
          <li key={entry.label} className="grid min-h-11 grid-cols-[1rem_1fr_auto] gap-x-2">
            <span className="relative flex justify-center">
              {index < entries.length - 1 && <span className="absolute bottom-0 top-3 w-1 bg-green-500" />}
              <span className={cn("relative z-10 mt-1 size-2 rounded-full border-2 border-green-500 bg-background-bright", index === 0 || index === entries.length - 1 ? "rounded-sm" : "")} />
            </span>
            <span className="text-sm text-text-bright">
              {entry.label}
              {elapsed !== null && <span className="block text-xs text-text-faint">{formatMilliseconds(elapsed)}</span>}
            </span>
            <time className="text-xs tabular-nums text-text-dimmed" dateTime={entry.value}>{formatTimestamp(current, index === 0)}</time>
          </li>
        );
      })}
    </ol>
  );
}

function InspectorDetails({ inspector, renderDetails: RenderDetails }: { inspector: Inspector; renderDetails: InspectorDetailsRenderer }) {
  return (
    <div className="space-y-5">
      <div>
        <Header3>Node detail</Header3>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-2 text-sm">
          {Object.entries(inspector.overview).map(([key, value]) => <Property key={key} name={key} value={value} />)}
        </dl>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {inspector.source && (inspector.source.href
          ? <a href={inspector.source.href} className="text-text-link">{inspector.source.file}:{inspector.source.line}</a>
          : <span className="font-mono text-text-dimmed">{inspector.source.file}:{inspector.source.line}</span>)}
        {inspector.telemetryEventHref && <a href={inspector.telemetryEventHref} className="text-text-link">Telemetry event</a>}
      </div>
      <RenderDetails inspector={inspector} />
    </div>
  );
}

function Property({ name, value }: { name: string; value: unknown }) {
  return <><dt className="text-text-faint">{name}</dt><dd className="min-w-0 break-words font-mono text-text-bright">{value === null || value === undefined ? "—" : String(value)}</dd></>;
}

function InspectorTab({ active, enabled, shortcut, onClick, children }: { active: boolean; enabled: boolean; shortcut: string; onClick: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isEditable(event.target)) return;
      if (event.key.toLowerCase() === shortcut) { event.preventDefault(); ref.current?.click(); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled, shortcut]);
  return (
    <button ref={ref} type="button" role="tab" aria-label={String(children)} aria-selected={active} onClick={onClick} className="group flex h-10 flex-col items-center focus-custom">
      <span className={cn("flex flex-1 items-center gap-1 text-sm", active ? "text-text-bright" : "text-text-dimmed group-hover:text-text-bright")}>{children}<kbd className="rounded-sm border border-border-bright px-1 font-mono text-xxs text-text-faint">{shortcut.toUpperCase()}</kbd></span>
      <span className={cn("h-0.5 w-full", active ? "bg-indigo-500" : "bg-transparent group-hover:bg-surface-control-active")} />
    </button>
  );
}

function RelationshipLinks({ data }: { data: RouteData }) {
  return (
    <span className="flex items-center gap-3">
      {data.relationships.parent ? <Link className="text-text-link" to={data.relationships.parent.path}>Parent Run</Link> : <span>This is the root Run</span>}
      {data.relationships.children.map((child) => <Link key={child.id} className="text-text-link" to={child.path}>Child: {child.name ?? child.id}</Link>)}
    </span>
  );
}

function AdjacentLink({ label, path, icon }: { label: string; path: string | null; icon: React.ReactElement }) {
  return path
    ? <Link aria-label={label} title={label} to={path} replace className="flex size-6 max-w-6 items-center justify-center rounded hover:bg-background-raised">{icon}</Link>
    : <span aria-label={`${label} unavailable`} className="flex size-6 max-w-6 items-center justify-center opacity-50">{icon}</span>;
}

function traceDuration(data: RouteData): number {
  const representedEnd = Math.max(1, ...data.trace.nodes.map((node) => node.offsetUs + (node.durationUs ?? 0)));
  return Math.max(1, data.trace.durationUs ?? data.trace.activeDurationUs ?? representedEnd, representedEnd);
}

function boundedQueueDuration(data: RouteData, totalUs: number): number {
  const firstAttemptOffset = data.trace.nodes.find((node) => node.kind === "attempt")?.offsetUs;
  if (!data.trace.queuedDurationUs || firstAttemptOffset === undefined || firstAttemptOffset <= 0) return 0;
  return Math.min(data.trace.queuedDurationUs, firstAttemptOffset, totalUs - 1);
}

function nodeStatus(node: Pick<TraceNode, "status">): RunStatus {
  if (node.status === "released") return "retrying";
  return node.status;
}

function nodeColor(node: TraceNode): string {
  if (node.isError) return "bg-error";
  if (node.kind === "run" || node.kind === "attempt") return node.isPartial ? "bg-blue-500" : "bg-success";
  if (node.kind === "query") return "bg-query";
  if (node.kind === "request") return "bg-cyan-500";
  return "bg-surface-control-active";
}

function formatDuration(microseconds: number | null): string {
  if (microseconds === null) return "—";
  if (microseconds < 1_000) return `${Math.round(microseconds)}µs`;
  const milliseconds = microseconds / 1_000;
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)}s`;
}

function formatMilliseconds(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds} milliseconds`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)} seconds`;
}

function formatTimestamp(date: Date, includeDate: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    ...(includeDate ? { month: "short", day: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

export function RunDetailErrorBoundary() {
  const error = useRouteError() as { status?: number; message?: string } | undefined;
  const notFound = error?.status === 404;
  return (
    <PageContainer>
      <NavBar><PageTitle backButton={{ to: "/runs", text: "Runs" }} title={notFound ? "Run not found" : "Unable to load Run"} /></NavBar>
      <PageBody className="grid place-items-center">
        <div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center">
          <ExclamationTriangleIcon className="mx-auto size-6 text-error" />
          <p className="mt-2 font-medium text-text-bright">{notFound ? "Run not found" : "Unable to load Run"}</p>
          <p className="mt-1 text-sm text-text-dimmed">{error?.message ?? "Skyline could not load this Run."}</p>
        </div>
      </PageBody>
    </PageContainer>
  );
}
