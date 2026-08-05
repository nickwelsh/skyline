/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.runs.$runParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server loaders, tenants, streaming, replay, cancellation, and deployment/runtime fields are external or omitted.
 */
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@heroicons/react/20/solid";
import { Link, useLoaderData, useRevalidator, useRouteError, useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Badge } from "~/components/primitives/Badge";
import { Button } from "~/components/primitives/Buttons";
import { CopyableText } from "~/components/primitives/CopyableText";
import { Header3 } from "~/components/primitives/Headers";
import { NavBar, PageAccessories, PageTitle } from "~/components/primitives/PageHeader";
import {
  RESIZABLE_PANEL_ANIMATION,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  collapsibleHandleClassName,
} from "~/components/primitives/Resizable";
import { SearchInput } from "~/components/primitives/SearchInput";
import { Slider } from "~/components/primitives/Slider";
import { Spinner } from "~/components/primitives/Spinner";
import { Switch } from "~/components/primitives/Switch";
import * as Timeline from "~/components/primitives/Timeline";
import { TaskRunStatusCombo, TaskRunStatusIcon, type RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { TreeView, type FlatTree, useTree } from "~/primitives/TreeView/TreeView";
import { cn } from "~/utils/cn";

type AttemptStatus = "running" | "completed" | "released" | "failed";
type TraceNode = {
  id: string;
  parentId: string | null;
  runId: string;
  kind: string;
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
  exception?: { class: string; message: string } | null;
  source?: { file: string; line: number; href: string | null } | null;
  metadata: { value: Record<string, unknown>; isTruncated: boolean };
};
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
};

const panels = {
  parent: { handle: "parent-handle", main: "run", inspector: "inspector" },
  tree: { handle: "tree-handle", tree: "tree", timeline: "timeline" },
};

export default function RunDetailRoute() {
  const data = useLoaderData() as RouteData;
  const revalidator = useRevalidator();
  const [params, setParams] = useSearchParams();
  const rootNodeId = data.trace.nodes[0]?.id;
  const selectedId = params.get("node") ?? undefined;
  const rememberedSelection = useRef(selectedId);

  useEffect(() => {
    if (selectedId) rememberedSelection.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (selectedId || rememberedSelection.current || !rootNodeId) return;
    const next = new URLSearchParams(params);
    next.set("node", rootNodeId);
    setParams(next, { replace: true });
  }, [rootNodeId, selectedId]);

  useEffect(() => {
    if (!data.trace.polling) return;
    const timer = window.setInterval(() => revalidator.revalidate(), data.trace.pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [data.trace.polling, data.trace.pollIntervalMs, revalidator.revalidate]);

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
            <span className="flex items-center gap-2">
              <TaskRunStatusIcon status={data.run.status} className="size-4" />
              <CopyableText value={data.run.id} />
            </span>
          }
        />
        <PageAccessories>
          <AdjacentLink label="Previous Run" path={data.navigation.previousPath} icon={<ChevronLeftIcon />} />
          <AdjacentLink label="Next Run" path={data.navigation.nextPath} icon={<ChevronRightIcon />} />
          <Button
            variant="secondary/small"
            LeadingIcon={ArrowPathIcon}
            onClick={() => revalidator.revalidate()}
            disabled={revalidator.state !== "idle"}
          >
            Refresh
          </Button>
        </PageAccessories>
      </NavBar>
      <PageBody scrollable={false} className="relative p-0">
        {revalidator.state !== "idle" && (
          <div role="status" className="absolute right-3 top-2 z-50 rounded bg-background-bright px-2 py-1 text-xs text-text-dimmed shadow">
            Refreshing Run…
          </div>
        )}
        <ResizablePanelGroup autosaveId="panel-run-parent-v3">
          <ResizablePanel id={panels.parent.main} min="100px">
            <TraceView data={data} selectedId={selectedId} onSelect={select} />
          </ResizablePanel>
          {selectedId && (
            <>
              <ResizableHandle
                id={panels.parent.handle}
                className={collapsibleHandleClassName(true)}
              />
              <ResizablePanel
                id={panels.parent.inspector}
                default="500px"
                min="250px"
                collapseAnimation={RESIZABLE_PANEL_ANIMATION}
                isStaticAtRest
              >
                <InspectorPanel data={data} selectedId={selectedId} />
              </ResizablePanel>
            </>
          )}
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

  const update = (key: string, value: string | boolean | number | undefined) => {
    const next = new URLSearchParams(params);
    if (value === undefined || value === false || value === "" || value === 0) next.delete(key);
    else next.set(key, String(value));
    setParams(next, { replace: true });
  };

  return (
    <div className="grid h-full grid-rows-[2.5rem_2rem_1fr_3.25rem] overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-grid-dimmed px-1.5">
        <SearchInput placeholder="Search logs…" value={search} onValueChange={(value) => update("traceSearch", value)} />
        <div className="flex items-center gap-1.5">
          <Switch variant="secondary/small" label="Queue time" checked={showQueue} onCheckedChange={(checked) => update("queue", checked)} shortcut={{ key: "Q" }} />
          <Switch variant="secondary/small" label="Errors only" checked={errorsOnly} onCheckedChange={(checked) => update("errors", checked)} />
        </div>
      </div>
      <div className="flex items-center justify-between px-3 text-xs text-text-faint">
        <RelationshipLinks data={data} />
        {data.trace.rootStatus === "executing" && (
          <span className="flex items-center gap-1 text-blue-500"><span className="size-2 animate-pulse rounded-full bg-blue-500" />Live reloading</span>
        )}
      </div>
      <ResizablePanelGroup autosaveId="panel-run-tree">
        <ResizablePanel id={panels.tree.tree} default="50%" min="50px">
          <TreeView
            parentRef={parentRef}
            scrollRef={treeScrollRef}
            virtualizer={state.virtualizer}
            autoFocus
            tree={tree}
            nodes={state.nodes}
            getNodeProps={state.getNodeProps}
            getTreeProps={state.getTreeProps}
            parentClassName="h-full pl-3"
            onScroll={(top) => { if (timelineScrollRef.current) timelineScrollRef.current.scrollTop = top; }}
            renderNode={({ node, state: nodeState }) => (
              <TraceRow
                node={node.data}
                selected={nodeState.selected}
                expanded={nodeState.expanded}
                onSelect={() => state.selectNode(node.id)}
                onToggle={() => state.toggleExpandNode(node.id)}
              />
            )}
          />
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
        <span>↑ ↓ ← → Navigate · Esc Close inspector · Q Queue time</span>
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

function TraceRow({ node, selected, expanded, onSelect, onToggle }: { node: TraceNode; selected: boolean; expanded: boolean; onSelect: () => void; onToggle: () => void }) {
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
      <span style={{ width: `${node.level * 16}px` }} className="shrink-0" />
      <button
        type="button"
        aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`}
        className={cn("flex size-4 shrink-0 items-center", node.hasChildren && "hover:bg-surface-control")}
        onClick={(event) => { event.stopPropagation(); if (node.hasChildren) onToggle(); }}
      >
        {node.hasChildren ? (expanded ? <ChevronDownIcon /> : <ChevronRightIcon />) : null}
      </button>
      <span className="ml-1.5 flex min-w-0 flex-1 items-center gap-2">
        <TaskRunStatusIcon status={nodeStatus(node)} className="size-4 shrink-0" />
        <span className={cn("truncate", node.isError ? "text-error" : "text-text-dimmed group-hover/spannode:text-text-bright")}>{node.label}</span>
        {node.kind === "run" && node.level === 0 && <Badge variant="extra-small">Root</Badge>}
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
  const width = containerRef.current?.clientWidth ?? 300;

  return (
    <div ref={containerRef} className="h-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <Timeline.Root durationMs={visibleUs / 1_000} scale={scale} minWidth={width} maxWidth={width * 10} className="h-full" >
        <Timeline.Row className="grid h-full grid-rows-[2rem_1fr]">
          <div className="flex items-center justify-between border-b border-grid-dimmed px-2 text-xxs text-text-faint">
            <span>0ms</span><span>{formatDuration(visibleUs)}</span>
          </div>
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
              const point = durationUs / visibleUs < 0.002;
              return (
                <Timeline.Row
                  data-timeline-row-kind={node.data.kind}
                  className={cn("group flex h-8 items-center", nodeState.selected ? "bg-grid-dimmed" : "hover:bg-grid-dimmed")}
                  onClick={() => state.toggleNodeSelection(node.id)}
                >
                  {point ? (
                    <Timeline.Point ms={startUs / 1_000}>
                      {() => <span data-timeline-node-point-id={node.id} title={`${node.data.label} · Started ${formatDuration(startUs)} · Duration ${formatDuration(durationUs)}`} className={cn("block size-2 rounded-full border border-background-bright", nodeColor(node.data))} />}
                    </Timeline.Point>
                  ) : (
                    <Timeline.Span startMs={startUs / 1_000} durationMs={durationUs / 1_000}>
                      <motion.div
                        data-timeline-node-id={node.id}
                        title={`${node.data.label} · Started ${formatDuration(startUs)} · Duration ${formatDuration(durationUs)}`}
                        className={cn("relative h-4 min-w-0.5 rounded-sm", nodeColor(node.data))}
                        layoutId={data.trace.rootStatus === "executing" ? node.id : undefined}
                      >
                        {node.data.isPartial && <span className="absolute inset-0 animate-pulse bg-white/10" />}
                      </motion.div>
                    </Timeline.Span>
                  )}
                </Timeline.Row>
              );
            }}
          />
        </Timeline.Row>
      </Timeline.Root>
    </div>
  );
}

function InspectorPanel({ data, selectedId }: { data: RouteData; selectedId?: string }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const [inspector, setInspector] = useState<Inspector>();
  const [error, setError] = useState<Error>();
  const node = data.trace.nodes.find((candidate) => candidate.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setError(undefined);
    void data.loadInspector(selectedId, controller.signal)
      .then(setInspector)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error("Inspector unavailable.")); });
    return () => controller.abort();
  }, [data.trace.revision, selectedId]);

  if (!selectedId) return null;

  const setTab = (nextTab: string) => {
    const next = new URLSearchParams(params);
    nextTab === "overview" ? next.delete("tab") : next.set("tab", nextTab);
    setParams(next);
  };
  const failure = data.attempts.find((attempt) => attempt.id === selectedId)?.failure;

  return (
    <section className="grid h-full grid-rows-[auto_1fr] overflow-hidden bg-background-dimmed" aria-label="Run inspector">
      <div role="tablist" className="flex gap-6 border-b border-grid-bright px-4">
        {[{ id: "overview", label: "Overview", key: "o" }, { id: "detail", label: "Detail", key: "d" }, { id: "metadata", label: "Metadata", key: "m" }].map((item) => (
          <InspectorTab key={item.id} active={tab === item.id} shortcut={item.key} onClick={() => setTab(item.id)}>{item.label}</InspectorTab>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab[0].toUpperCase() + tab.slice(1)} className="overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        {!inspector && !error && <div className="grid h-full place-items-center" aria-label="Loading inspector"><Spinner /></div>}
        {error && <div role="alert" className="text-error">{error.message}</div>}
        {(failure || inspector?.exception) && (
          <div className="mb-4 rounded border border-error/40 bg-error/10 p-3">
            <Header3>{failure?.class ?? inspector?.exception?.class}</Header3>
            <p className="mt-1 text-sm text-text-dimmed">{failure?.message ?? inspector?.exception?.message}</p>
          </div>
        )}
        {inspector && tab === "overview" && <InspectorOverview data={data} node={node} inspector={inspector} />}
        {inspector && tab === "detail" && (
          <div className="space-y-4">
            <Header3>Node detail</Header3>
            <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
              {Object.entries(inspector.overview).map(([key, value]) => <Property key={key} name={key} value={value} />)}
            </dl>
            {inspector.source && (
              <a href={inspector.source.href ?? undefined} className="text-text-link">{inspector.source.file}:{inspector.source.line}</a>
            )}
          </div>
        )}
        {inspector && tab === "metadata" && (
          <pre className="overflow-auto whitespace-pre-wrap rounded border border-grid-bright bg-background-bright p-3 font-mono text-xs text-text-dimmed">{JSON.stringify(inspector.metadata.value, null, 2)}</pre>
        )}
      </div>
    </section>
  );
}

function InspectorOverview({ data, node, inspector }: { data: RouteData; node?: TraceNode; inspector: Inspector }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Header3>{node?.label ?? inspector.label}</Header3>
        <TaskRunStatusCombo status={nodeStatus(inspector)} />
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
        <Property name="Run" value={inspector.runId} />
        <Property name="Job type" value={data.run.jobType} />
        <Property name="Queue target" value={data.run.queueTarget} />
        <Property name="Driver" value={data.run.driverId} />
        <Property name="Queue-time source" value={data.run.queueTimeSource} />
        <Property name="Attempts" value={data.run.attemptCount} />
        <Property name="Duration" value={formatDuration(node?.durationUs ?? data.run.durationUs)} />
      </dl>
    </div>
  );
}

function Property({ name, value }: { name: string; value: unknown }) {
  return <><dt className="text-text-faint">{name}</dt><dd className="min-w-0 break-words font-mono text-text-bright">{value === null || value === undefined ? "—" : String(value)}</dd></>;
}

function InspectorTab({ active, shortcut, onClick, children }: { active: boolean; shortcut: string; onClick: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isEditable(event.target)) return;
      if (event.key.toLowerCase() === shortcut) { event.preventDefault(); ref.current?.click(); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [shortcut]);
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
    ? <Link aria-label={label} title={label} to={path} className="flex size-7 items-center justify-center rounded hover:bg-background-raised">{icon}</Link>
    : <span aria-label={`${label} unavailable`} className="flex size-7 items-center justify-center opacity-30">{icon}</span>;
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
