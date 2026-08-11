/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server loaders, tenants, streaming, replay, cancellation, and deployment/runtime fields are external or omitted.
 */
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/20/solid";
import { Link, useLoaderData, useNavigate, useRevalidator, useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ExitIcon } from "~/assets/icons/ExitIcon";
import { ChevronExtraSmallDown } from "~/assets/icons/ChevronExtraSmallDown";
import { ChevronExtraSmallUp } from "~/assets/icons/ChevronExtraSmallUp";
import { QueuesIcon } from "~/assets/icons/QueuesIcon";
import { RunsIcon } from "~/assets/icons/RunsIcon";
import { TaskIcon } from "~/assets/icons/TaskIcon";
import { CodeBlock } from "~/CodeBlock";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Badge } from "~/components/primitives/Badge";
import { Button } from "~/components/primitives/Buttons";
import { CopyableText } from "~/components/primitives/CopyableText";
import { Header3 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Paragraph } from "~/components/primitives/Paragraph";
import * as PropertyTable from "~/components/primitives/PropertyTable";
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
import { ShortcutKey, variants as shortcutVariants } from "~/components/primitives/ShortcutKey";
import { Spinner } from "~/components/primitives/Spinner";
import { Switch } from "~/components/primitives/Switch";
import * as Timeline from "~/components/primitives/Timeline";
import { RunTimeline, type TimelineSpanRun } from "~/components/run/RunTimeline";
import { RunIcon, type NodeKind } from "~/components/runs/v3/RunIcon";
import { SpanTitle, type SpanLevel } from "~/components/runs/v3/SpanTitle";
import { TaskRunStatusCombo, TaskRunStatusIcon, type RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { TreeView, type FlatTree, useTree } from "~/primitives/TreeView/TreeView";
import { TabButton, TabContainer } from "~/Tabs";
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
  logLevel?: string;
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
type RouteData = {
  generatedAt: string;
  run: {
    id: string;
    jobId: string;
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
  const rememberedSelection = useRef<{ runId: string; nodeId?: string }>({ runId: data.run.id, nodeId: selectedParam });

  if (rememberedSelection.current.runId !== data.run.id) {
    rememberedSelection.current = { runId: data.run.id, nodeId: selectedParam };
  }

  const selectedId = selectedParam;

  useEffect(() => {
    if (selectedParam) rememberedSelection.current.nodeId = selectedParam;
  }, [selectedParam]);

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
      const path = ["j", "["].includes(event.key.toLowerCase()) ? data.navigation.previousPath
        : ["k", "]"].includes(event.key.toLowerCase()) ? data.navigation.nextPath
          : event.key.toLowerCase() === "p" ? data.relationships.parent?.path
            : event.key.toLowerCase() === "t" ? rootPath
            : null;
      if (!path) return;
      event.preventDefault();
      navigate(path, { replace: ["j", "k", "[", "]"].includes(event.key.toLowerCase()) });
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
          favoriteLabel={data.run.id}
          title={
            <div className="flex items-center gap-x-0">
              <CopyableText
                value={data.run.id}
                variant="text-below"
                className="-ml-1.75 h-6 px-1.5 font-mono text-xs hover:text-text-bright"
              />
              {params.get("tableState") && (
                <div className="flex">
                  <AdjacentLink label="Previous Run" path={data.navigation.previousPath} icon={<ChevronExtraSmallUp />} />
                  <AdjacentLink label="Next Run" path={data.navigation.nextPath} icon={<ChevronExtraSmallDown />} />
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
        <ResizablePanelGroup autosaveId="panel-run-parent-v3" className="h-full max-h-full">
          <ResizablePanel id={panels.parent.main} min="100px">
            <TraceView key={data.run.id} data={data} selectedId={selectedId} onSelect={select} />
          </ResizablePanel>
          <ResizableHandle
            id={panels.parent.handle}
            className={collapsibleHandleClassName(Boolean(selectedId))}
          />
          <ResizablePanel
            id={panels.parent.inspector}
            default="500px"
            min="250px"
            className="overflow-hidden"
            collapsible
            collapsed={!selectedId}
            onCollapseChange={() => {}}
            collapsedSize="0px"
            collapseAnimation={RESIZABLE_PANEL_ANIMATION}
            aria-hidden={!selectedId}
            {...(!selectedId ? { inert: "" } : {})}
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
  const [scale, setScale] = useState(0);
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
                  onToggle={(all) => {
                    if (all) {
                      nodeState.expanded
                        ? state.collapseAllBelowDepth(node.data.level)
                        : state.expandAllBelowDepth(node.data.level);
                    } else {
                      state.toggleExpandNode(node.id);
                    }
                    state.scrollToNode(node.id);
                  }}
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
      <div className="flex items-center justify-between gap-2 border-t border-grid-dimmed px-4 text-xs text-text-dimmed">
        <div className="flex min-w-0 items-center gap-4 overflow-x-auto scrollbar-hide">
          <ArrowKeyShortcuts />
          <AdjacentRunsShortcuts />
          <ShortcutLabel shortcut="e" title="Expand all" />
          <ShortcutLabel shortcut="w" title="Collapse all" />
          <NumberShortcuts />
          <ShortcutLabel shortcut="Q" title="Queue time" />
        </div>
        <Slider
          aria-label="Timeline zoom"
          variant="tertiary"
          className="w-20"
          LeadingIcon={MagnifyingGlassMinusIcon}
          TrailingIcon={MagnifyingGlassPlusIcon}
          value={[scale]}
          onValueChange={([value]) => setScale(value)}
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
        selected ? "bg-grid-dimmed hover:bg-grid-bright" : "bg-transparent hover:bg-grid-dimmed",
      )}
      onClick={onSelect}
    >
      <div className="flex h-8 items-center">
        {Array.from({ length: node.level }).map((_, index) => <TaskLine key={index} />)}
        <div
          className={cn("flex h-8 w-4 items-center", node.hasChildren && "hover:bg-surface-control")}
          onClick={(event) => { event.stopPropagation(); onToggle(event.altKey); }}
        >
          {node.hasChildren
            ? expanded ? <ChevronDownIcon className="h-4 w-4 text-text-dimmed" /> : <ChevronRightIcon className="h-4 w-4 text-text-dimmed" />
            : <div className="h-8 w-4" />}
        </div>
      </div>
      <div className="flex w-full items-center justify-between gap-2 pl-1">
        <div className="flex items-center gap-1.5 overflow-x-hidden">
          <RunIcon kind={node.kind} className="size-5 min-h-5 min-w-5" />
          <Paragraph variant="small" className="truncate">
            <SpanTitle
              message={node.label}
              kind={node.kind}
              isError={node.isError}
              level={spanLevel(node.logLevel)}
              isPartial={node.isPartial}
              size="small"
            />
          </Paragraph>
          {node.kind === "run" && node.level === 0 && <Badge variant="extra-small">Root</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <TaskRunStatusIcon status={nodeStatus(node)} className="size-4" />
        </div>
      </div>
    </div>
  );
}

function TaskLine() {
  return <div className="h-8 w-2 border-r border-grid-bright" />;
}

function spanLevel(value: string | undefined): SpanLevel {
  return value === "LOG" || value === "INFO" || value === "DEBUG" || value === "WARN" || value === "ERROR" ? value : "TRACE";
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
        <CurrentTimeIndicator
          durationUs={coordinateUs}
          rootStartedAt={data.trace.rootStartedAt}
          shiftUs={shiftUs}
        />
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
              const visibleEvents = node.data.timelineEvents
                .map((event) => ({ ...event, visibleOffsetUs: event.offsetUs - shiftUs }))
                .filter((event) => event.visibleOffsetUs >= 0 && event.visibleOffsetUs <= visibleUs);
              const firstEvent = visibleEvents[0];
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
                        className={cn("relative flex h-4 min-w-0.5 items-center overflow-hidden rounded-sm", nodeColor(node.data))}
                        style={node.data.kind === "run" ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 2px, rgb(255 255 255 / 0.16) 2px 4px)" } : undefined}
                        layoutId={data.trace.rootStatus === "executing" ? node.id : undefined}
                      >
                        {node.data.isPartial && <span className="absolute inset-0 animate-pulse bg-white/10" />}
                        <span className="sticky left-0 z-10 flex h-full items-center whitespace-nowrap px-1 text-xxs text-text-bright text-shadow-custom">{formatDuration(durationUs)}</span>
                      </motion.div>
                    </Timeline.Span>
                  )}
                  {firstEvent && firstEvent.visibleOffsetUs < startUs ? (
                    <Timeline.Span startMs={firstEvent.visibleOffsetUs / 1_000} durationMs={(startUs - firstEvent.visibleOffsetUs) / 1_000} className="top-1/2">
                      <motion.span data-timeline-lifecycle-line={node.id} className={cn("block h-px w-full", nodeColor(node.data))} layoutId={data.trace.rootStatus === "executing" ? `mark-${node.id}` : undefined} />
                    </Timeline.Span>
                  ) : null}
                  {visibleEvents.map((event, index) => {
                    return (
                      <Timeline.Point key={`${event.name}-${index}`} ms={event.visibleOffsetUs / 1_000} className={index === 0 ? undefined : "z-10"}>
                        {() => index === 0
                          ? <motion.span data-timeline-event={event.name} title={`${event.name} · ${formatDuration(event.visibleOffsetUs)}`} className={cn("ml-[-0.5px] block h-2.25 w-px", nodeColor(node.data))} />
                          : <motion.span data-timeline-event={event.name} title={`${event.name} · ${formatDuration(event.visibleOffsetUs)}`} className={cn("ml-[-0.1562rem] block size-1.25 rounded-full border bg-background-bright", nodeBorderColor(node.data))} />}
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

  if (!selectedId || !frozenId) return null;

  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(params);
    nextTab === "overview" ? next.delete("tab") : next.set("tab", nextTab);
    setParams(next);
  };
  const failure = data.attempts.find((attempt) => attempt.id === frozenId)?.failure;
  const sourceSpan = node && !["run", "attempt"].includes(node.kind);

  if (sourceSpan) {
    return (
      <section className="grid h-full max-h-full grid-rows-[2.5rem_1fr] overflow-hidden bg-background-bright" aria-label="Run inspector">
        <InspectorHeader node={node} onClose={onClose} bordered />
        <div className="scrollbar-gutter-stable overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
          {!inspector && !error && <div className="grid h-full place-items-center" aria-label="Loading inspector"><Spinner /></div>}
          {error && <div role="alert" className="p-3 text-error">{error.message}</div>}
          {inspector && <data.renderInspectorDetails inspector={inspector} />}
        </div>
      </section>
    );
  }

  return (
    <section className="grid h-full grid-rows-[2.5rem_2rem_1fr_minmax(3.25rem,auto)] overflow-hidden bg-background-bright" aria-label="Run inspector">
      <InspectorHeader node={node} onClose={onClose} />
      <div className="h-fit overflow-x-auto px-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <TabContainer>
          {[{ id: "overview", label: "Overview", key: "o" }, { id: "detail", label: "Detail", key: "d" }, { id: "context", label: "Context", key: "x" }, { id: "metadata", label: "Metadata", key: "m" }].map((item) => (
            <TabButton key={item.id} active={tab === item.id} layoutId="span-run" shortcut={item.key} disabled={!selectedId} aria-label={item.label} onClick={() => setTab(item.id)}>{item.label}</TabButton>
          ))}
        </TabContainer>
      </div>
      <div role="tabpanel" aria-label={tab[0].toUpperCase() + tab.slice(1)} className="overflow-y-auto px-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        {!inspector && !error && <div className="grid h-full place-items-center" aria-label="Loading inspector"><Spinner /></div>}
        {error && <div role="alert" className="text-error">{error.message}</div>}
        {inspector && tab === "overview" && <InspectorOverview data={data} node={node} inspector={inspector} failure={failure} />}
        {inspector && tab === "detail" && <InspectorDetails data={data} node={node} inspector={inspector} renderDetails={data.renderInspectorDetails} />}
        {inspector && tab === "context" && (
          <div className="py-3">
            {inspector.context?.isTruncated && <p role="status" className="mb-2 text-xs text-warning">Context was truncated when captured.</p>}
            <CodeBlock
              label="Context"
              code={JSON.stringify(inspector.context?.value ?? {}, null, 2)}
              language="json"
              jsonValue={inspector.context?.value ?? {}}
              showLineNumbers={false}
              showTextWrapping
            />
          </div>
        )}
        {inspector && tab === "metadata" && (
          <div className="py-3">
            {inspector.metadata.isTruncated && <p role="status" className="mb-2 text-xs text-warning">Metadata was truncated when captured.</p>}
            <CodeBlock
              label="Metadata"
              code={JSON.stringify(inspector.metadata.value, null, 2)}
              language="json"
              jsonValue={inspector.metadata.value}
              showLineNumbers={false}
              showTextWrapping
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-grid-dimmed px-2 py-2" />
    </section>
  );
}

function InspectorHeader({ node, onClose, bordered = false }: { node?: TraceNode; onClose: () => void; bordered?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 overflow-x-hidden px-3 pr-2", bordered && "border-b border-grid-bright")}>
      <div className="flex min-w-0 items-center gap-1">
        <RunIcon kind={node?.kind ?? "run"} className="size-5 min-h-5 min-w-5" />
        <Header3 className="truncate text-blue-500">{node?.label ?? "Inspector"}</Header3>
      </div>
      <Button
        onClick={onClose}
        variant="minimal/small"
        TrailingIcon={ExitIcon}
        shortcut={{ key: "esc" }}
        shortcutPosition="before-trailing-icon"
        className="pl-1"
      />
    </div>
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
  const missingAttemptException = inspector.kind === "attempt" && inspector.status === "failed" && !inspector.exception;
  if (attempt && inspector.exception) {
    const attemptRun = { ...data.run, status: nodeStatus(inspector), startedAt: attempt.startedAt, finishedAt: attempt.finishedAt, durationUs: inspector.durationUs };
    return (
      <div className="flex flex-col gap-4 pt-3">
        <div className="border-b border-grid-bright pb-3">
          <TaskRunStatusCombo status={nodeStatus(inspector)} className="text-sm" />
        </div>
        <RunTimeline run={timelineRun(attemptRun)} />
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
        <RunTimeline run={timelineRun(data.run)} />
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
        : (failure || missingAttemptException) && (
          <div role="status" className="rounded border border-grid-bright bg-background-bright p-3 text-sm text-text-dimmed">
            Exception evidence unavailable.{failure && <> Skyline retained only the captured {failure.class} summary.</>}
          </div>
        )}
    </div>
  );
}

function timelineRun(run: RouteData["run"]): TimelineSpanRun {
  const dequeuedAt = run.queuedAt ?? run.startedAt;
  return {
    createdAt: new Date(run.triggeredAt),
    startedAt: dequeuedAt ? new Date(dequeuedAt) : null,
    executedAt: run.startedAt ? new Date(run.startedAt) : null,
    updatedAt: new Date(run.finishedAt ?? run.startedAt ?? run.triggeredAt),
    completedAt: run.finishedAt ? new Date(run.finishedAt) : null,
    isFinished: run.finishedAt !== null,
    isError: run.status === "failed",
  };
}

function InspectorDetails({ data, node, inspector, renderDetails: RenderDetails }: { data: RouteData; node?: TraceNode; inspector: Inspector; renderDetails: InspectorDetailsRenderer }) {
  const isRouteRun = inspector.runId === data.run.id;
  const attempt = node?.kind === "attempt" ? data.attempts.find((candidate) => candidate.id === node.id) : undefined;
  return (
    <div className="flex flex-col gap-4 py-3">
      <PropertyTable.Table>
        <PropertyTable.Item>
          <PropertyTable.Label>Status</PropertyTable.Label>
          <PropertyTable.Value><TaskRunStatusCombo status={nodeStatus(inspector)} /></PropertyTable.Value>
        </PropertyTable.Item>
        <PropertyTable.Item>
          <PropertyTable.Label>Job</PropertyTable.Label>
          <PropertyTable.Value>
            {isRouteRun ? <Link to={`/jobs/${encodeURIComponent(data.run.jobId)}`} className="flex w-fit items-center gap-1.5 text-text-link transition-colors hover:text-text-bright focus-custom"><TaskIcon className="size-4 text-tasks" /><span>{data.run.jobType}</span></Link> : "—"}
          </PropertyTable.Value>
        </PropertyTable.Item>
        <PropertyTable.Item>
          <PropertyTable.Label>Run ID</PropertyTable.Label>
          <PropertyTable.Value><span className="flex items-center gap-1.5"><RunsIcon className="size-4 shrink-0 text-runs" /><CopyableText value={inspector.runId} copyValue={inspector.runId} asChild /></span></PropertyTable.Value>
        </PropertyTable.Item>
        {isRouteRun && <PropertyTable.Item><PropertyTable.Label>Trace ID</PropertyTable.Label><PropertyTable.Value><CopyableText value={data.run.traceId} copyValue={data.run.traceId} asChild /></PropertyTable.Value></PropertyTable.Item>}
        {data.relationships.parent && isRouteRun && <PropertyTable.Item><PropertyTable.Label>Parent run</PropertyTable.Label><PropertyTable.Value><Link to={data.relationships.parent.path} className="text-text-link hover:text-text-bright focus-custom">{data.relationships.parent.id}</Link></PropertyTable.Value></PropertyTable.Item>}
        {isRouteRun && <PropertyTable.Item><PropertyTable.Label>Queue</PropertyTable.Label><PropertyTable.Value><span className="flex items-center gap-1.5"><QueuesIcon className="size-4 shrink-0 text-queues" />{data.run.queueTarget}</span></PropertyTable.Value></PropertyTable.Item>}
        {isRouteRun && <PropertyTable.Item><PropertyTable.Label>Driver</PropertyTable.Label><PropertyTable.Value>{data.run.driverId ?? "—"}</PropertyTable.Value></PropertyTable.Item>}
        {isRouteRun && <PropertyTable.Item><PropertyTable.Label>Attempts</PropertyTable.Label><PropertyTable.Value>{data.run.attemptCount}</PropertyTable.Value></PropertyTable.Item>}
        {attempt && <PropertyTable.Item><PropertyTable.Label>Attempt</PropertyTable.Label><PropertyTable.Value>{attempt.number}</PropertyTable.Value></PropertyTable.Item>}
        {isRouteRun && <PropertyTable.Item><PropertyTable.Label>Triggered</PropertyTable.Label><PropertyTable.Value><time dateTime={data.run.triggeredAt}>{formatTimestamp(new Date(data.run.triggeredAt), true)}</time></PropertyTable.Value></PropertyTable.Item>}
        {isRouteRun && data.run.queuedAt && <PropertyTable.Item><PropertyTable.Label>Dequeued</PropertyTable.Label><PropertyTable.Value><time dateTime={data.run.queuedAt}>{formatTimestamp(new Date(data.run.queuedAt), true)}</time></PropertyTable.Value></PropertyTable.Item>}
        {(attempt?.startedAt ?? (isRouteRun ? data.run.startedAt : null)) && <PropertyTable.Item><PropertyTable.Label>Started</PropertyTable.Label><PropertyTable.Value><time dateTime={attempt?.startedAt ?? data.run.startedAt ?? undefined}>{formatTimestamp(new Date(attempt?.startedAt ?? data.run.startedAt ?? ""), true)}</time></PropertyTable.Value></PropertyTable.Item>}
        {(attempt?.finishedAt ?? (isRouteRun ? data.run.finishedAt : null)) && <PropertyTable.Item><PropertyTable.Label>Finished</PropertyTable.Label><PropertyTable.Value><time dateTime={attempt?.finishedAt ?? data.run.finishedAt ?? undefined}>{formatTimestamp(new Date(attempt?.finishedAt ?? data.run.finishedAt ?? ""), true)}</time></PropertyTable.Value></PropertyTable.Item>}
        {isRouteRun && <PropertyTable.Item><PropertyTable.Label>Queue duration</PropertyTable.Label><PropertyTable.Value>{formatDuration(attempt?.queueDurationUs ?? data.run.queueDurationUs)}</PropertyTable.Value></PropertyTable.Item>}
        <PropertyTable.Item><PropertyTable.Label>Duration</PropertyTable.Label><PropertyTable.Value>{formatDuration(node?.durationUs ?? data.run.durationUs)}</PropertyTable.Value></PropertyTable.Item>
      </PropertyTable.Table>
      <div className="flex flex-wrap gap-3 border-t border-grid-bright pt-3 text-sm">
        {inspector.source && (inspector.source.href
          ? <a href={inspector.source.href} className="text-text-link">{inspector.source.file}:{inspector.source.line}</a>
          : <span className="font-mono text-text-dimmed">{inspector.source.file}:{inspector.source.line}</span>)}
        {inspector.telemetryEventHref && <a href={inspector.telemetryEventHref} className="text-text-link">Telemetry event</a>}
      </div>
      <div className="border-t border-grid-bright pt-3"><RenderDetails inspector={inspector} /></div>
    </div>
  );
}

function Property({ name, value }: { name: string; value: unknown }) {
  return <><dt className="text-text-faint">{name}</dt><dd className="min-w-0 break-words font-mono text-text-bright">{value === null || value === undefined ? "—" : String(value)}</dd></>;
}

function RelationshipLinks({ data }: { data: RouteData }) {
  return (
    <span data-skyline-extension="run-relationships" className="flex items-center gap-3">
      {data.relationships.parent ? <Link className="text-text-link" to={data.relationships.parent.path}>Parent Run</Link> : <span>This is the root Run</span>}
      {data.relationships.children.map((child) => <Link key={child.id} className="text-text-link" to={child.path}>Child: {child.name ?? child.id}</Link>)}
    </span>
  );
}

function CurrentTimeIndicator({ durationUs, rootStartedAt, shiftUs }: { durationUs: number; rootStartedAt: string; shiftUs: number }) {
  return (
    <Timeline.FollowCursor>
      {(milliseconds) => {
        const ratio = milliseconds / (durationUs / 1_000);
        const edge = 0.17;
        const offset = ratio < edge ? ratio / edge / 2 : ratio > 1 - edge ? 0.5 + ((ratio - (1 - edge)) / edge) / 2 : 0.5;
        const preciseTime = new Date(new Date(rootStartedAt).getTime() + ((shiftUs / 1_000) + milliseconds));
        return (
          <div data-timeline-playhead className="relative z-50 flex h-full flex-col">
            <div className="relative flex h-6 items-end">
              <div
                className="absolute w-fit whitespace-nowrap rounded-sm border border-border-bright bg-background-hover px-1 py-0.5 text-xxs tabular-nums text-text-bright"
                style={{ left: `${offset * 100}%`, transform: `translateX(-${offset * 100}%)` }}
              >
                {formatDuration(milliseconds * 1_000)}<span className="mx-1 text-text-dimmed">–</span>{formatTimestamp(preciseTime, false)}
              </div>
            </div>
            <div className="w-px grow border-r border-border-bright" />
          </div>
        );
      }}
    </Timeline.FollowCursor>
  );
}

function ArrowKeyShortcuts() {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {(["arrowup", "arrowdown", "arrowleft", "arrowright"] as const).map((key) => <ShortcutKey key={key} shortcut={{ key }} variant="medium" className="ml-0 mr-0" />)}
      <Paragraph variant="extra-small" className="ml-1.5 whitespace-nowrap">Navigate</Paragraph>
    </div>
  );
}

function AdjacentRunsShortcuts() {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <ShortcutKey shortcut={{ key: "[" }} variant="medium" className="ml-0 mr-0 px-1" />
      <ShortcutKey shortcut={{ key: "]" }} variant="medium" className="ml-0 mr-0 px-1" />
      <Paragraph variant="extra-small" className="ml-1.5 whitespace-nowrap">Next/previous run</Paragraph>
    </div>
  );
}

function ShortcutLabel({ shortcut, title }: { shortcut: string; title: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <ShortcutKey shortcut={{ key: shortcut }} variant="medium" className="ml-0 mr-0" />
      <Paragraph variant="extra-small" className="ml-1.5 whitespace-nowrap">{title}</Paragraph>
    </div>
  );
}

function NumberShortcuts() {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <span className={cn(shortcutVariants.medium, "ml-0 mr-0")}>0</span>
      <span className="text-[0.65rem] text-text-dimmed">–</span>
      <span className={cn(shortcutVariants.medium, "ml-0 mr-0")}>9</span>
      <Paragraph variant="extra-small" className="ml-1.5 whitespace-nowrap">Toggle level</Paragraph>
    </div>
  );
}

function AdjacentLink({ label, path, icon }: { label: string; path: string | null; icon: React.ReactElement }) {
  return path
    ? <Link aria-label={label} title={label} to={path} replace className="group/button flex size-6 max-w-6 items-center justify-center rounded text-text-dimmed transition-colors hover:bg-tertiary hover:text-text-bright">{cloneElement(icon, { className: "size-3 transition-colors group-hover/button:text-text-bright" })}</Link>
    : <span aria-label={`${label} unavailable`} className="flex size-6 max-w-6 items-center justify-center text-text-dimmed opacity-50">{cloneElement(icon, { className: "size-3" })}</span>;
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

function nodeBorderColor(node: TraceNode): string {
  return nodeColor(node).replace(/^bg-/, "border-");
}

function formatDuration(microseconds: number | null): string {
  if (microseconds === null) return "—";
  if (microseconds < 1_000) return `${Math.round(microseconds)}µs`;
  const milliseconds = microseconds / 1_000;
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)}s`;
}

function formatTimestamp(date: Date, includeDate: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    ...(includeDate ? { month: "short", day: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(date);
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}
