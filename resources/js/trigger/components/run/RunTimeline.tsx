/*!
 * Adapted from Trigger.dev apps/webapp/app/components/run/RunTimeline.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Host adaptation: local duration utility, embedded pinned tile, reached Run timeline only.
 */
import { ClockIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import { DateTime, DateTimeAccurate } from "../primitives/DateTime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/Tooltip";
import { LiveTimer } from "../runs/v3/LiveTimer";
import { cn } from "~/utils/cn";
import { formatDuration } from "~/utils/durations";

const tileBgPath = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAbUlEQVR4AaXOMQ6AIAyFYVoPYGLiysSmdxQv6eTkRdAykBAiCe91atJ8P4jrzO7DkZyLf/fvdgqDr+eOwmDbhcFNYBRXAQSXAIpzgME5sPmQUGyPK4Pt58pg25XBTWAUVwEElwCKbaZ1XgTFNi/fEmupf7blhAAAAABJRU5ErkJggg==";

type TimelineEventState = "complete" | "error" | "inprogress" | "delayed";
type TimelineLineVariant = "light" | "normal";
type TimelineEventVariant = "start-cap" | "dot-hollow" | "dot-solid" | "start-cap-thick" | "end-cap-thick" | "end-cap";

export type TimelineSpanRun = {
  createdAt: Date;
  startedAt?: Date | null;
  executedAt?: Date | null;
  updatedAt: Date;
  expiredAt?: Date | null;
  completedAt?: Date | null;
  delayUntil?: Date | null;
  ttl?: string | null;
  isFinished: boolean;
  isError: boolean;
};

type TimelineEventDefinition = {
  type: "event";
  id: string;
  title: string;
  date?: Date;
  previousDate?: Date;
  state: TimelineEventState;
  variant: TimelineEventVariant;
};
type TimelineLineDefinition = { type: "line"; id: string; title: ReactNode; state: TimelineEventState; variant: TimelineLineVariant };

export function RunTimeline({ run }: { run: TimelineSpanRun }) {
  return (
    <div data-run-timeline className="min-w-fit max-w-80">
      {buildTimelineItems(run).map((item) => item.type === "event" ? (
        <RunTimelineEvent
          key={item.id}
          title={item.title}
          subtitle={item.date ? <DateTimeAccurate date={item.date} previousDate={item.previousDate} /> : null}
          state={item.state}
          variant={item.variant}
          helpText={getRunTimelineHelpText(item.title)}
        />
      ) : (
        <RunTimelineLine key={item.id} title={item.title} state={item.state} variant={item.variant} />
      ))}
    </div>
  );
}

function buildTimelineItems(run: TimelineSpanRun): Array<TimelineEventDefinition | TimelineLineDefinition> {
  const state: TimelineEventState = run.isError || run.expiredAt ? "error" : run.isFinished ? "complete" : "inprogress";
  const items: Array<TimelineEventDefinition | TimelineLineDefinition> = [
    { type: "event", id: "triggered", title: "Triggered", date: run.createdAt, state, variant: "start-cap" },
  ];
  if (run.delayUntil && !run.startedAt && !run.expiredAt) {
    items.push({ type: "line", id: "waiting-to-dequeue", title: <span className="flex items-center gap-1"><ClockIcon className="size-4" /><span>Delayed until <DateTime date={run.delayUntil} /> {run.ttl && <>(TTL {run.ttl})</>}</span></span>, state, variant: "light" });
  } else if (run.startedAt) {
    items.push({ type: "line", id: "waiting-to-dequeue", title: formatDuration(run.createdAt, run.startedAt), state, variant: "light" });
  } else if (run.expiredAt) {
    items.push({ type: "line", id: "waiting-to-dequeue", title: formatDuration(run.createdAt, run.expiredAt), state, variant: "light" });
  } else {
    items.push({ type: "line", id: "waiting-to-dequeue", title: <><LiveTimer startTime={run.createdAt} endTime={run.startedAt ?? run.expiredAt ?? undefined} /> {run.ttl && <>(TTL {run.ttl})</>}</>, state, variant: "light" });
  }
  if (run.startedAt) {
    items.push({ type: "event", id: "dequeued", title: "Dequeued", date: run.startedAt, previousDate: run.createdAt, state, variant: "dot-hollow" });
  }
  if (run.startedAt && !run.expiredAt) {
    if (run.executedAt) {
      items.push({ type: "line", id: "waiting-to-execute", title: formatDuration(run.startedAt, run.executedAt), state, variant: "light" });
      items.push({ type: "event", id: "started", title: "Started", date: run.executedAt, previousDate: run.startedAt, state, variant: "start-cap-thick" });
      items.push({ type: "line", id: "executing", title: run.isFinished ? formatDuration(run.executedAt, run.completedAt ?? run.updatedAt) : <LiveTimer startTime={run.executedAt} />, state, variant: "normal" });
    } else {
      items.push({ type: "line", id: "legacy-executing", title: run.isFinished ? formatDuration(run.startedAt, run.completedAt ?? run.updatedAt) : <LiveTimer startTime={run.startedAt} />, state, variant: run.isFinished ? "normal" : "light" });
    }
  }
  if (run.isFinished && !run.expiredAt) {
    items.push({ type: "event", id: "finished", title: "Finished", date: run.completedAt ?? run.updatedAt, previousDate: run.executedAt ?? run.startedAt ?? undefined, state, variant: "end-cap-thick" });
  }
  if (run.expiredAt) {
    items.push({ type: "event", id: "expired", title: "Expired", date: run.expiredAt, previousDate: run.createdAt, state: "error", variant: "dot-solid" });
  }
  return items;
}

function RunTimelineEvent({ title, subtitle, state, variant = "dot-hollow", helpText: text }: { title: ReactNode; subtitle?: ReactNode; state?: TimelineEventState; variant?: TimelineEventVariant; helpText?: string }) {
  return (
    <div className="grid h-5 grid-cols-[1.125rem_1fr] gap-1 text-sm">
      <div className="relative flex flex-col items-center justify-center"><EventMarker variant={variant} state={state} /></div>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <TooltipProvider disableHoverableContent><Tooltip><TooltipTrigger className="min-w-0 max-w-full cursor-default text-left"><div className="truncate font-medium text-text-bright">{title}</div></TooltipTrigger>{text && <TooltipContent className="flex items-center gap-1 text-xs">{text}</TooltipContent>}</Tooltip></TooltipProvider>
        {subtitle ? <span className="whitespace-nowrap text-xs tabular-nums text-text-dimmed">{subtitle}</span> : null}
      </div>
    </div>
  );
}

function RunTimelineLine({ title, state, variant = "normal" }: { title: ReactNode; state?: TimelineEventState; variant?: TimelineLineVariant }) {
  return <div className="grid h-6 grid-cols-[1.125rem_1fr] gap-1 text-xs"><div className="flex items-stretch justify-center"><LineMarker state={state} variant={variant} /></div><div className="flex items-center justify-between gap-3"><span className="text-text-dimmed">{title}</span></div></div>;
}

function EventMarker({ variant, state }: { variant: TimelineEventVariant; state?: TimelineEventState }) {
  const bg = backgroundClass(state);
  const border = borderClass(state);
  const tile = state === "inprogress" ? <span className="absolute inset-0 animate-tile-scroll opacity-30" style={{ backgroundImage: `url(${tileBgPath})`, backgroundSize: "8px 8px" }} /> : null;
  if (variant === "start-cap") return <><span className={cn("h-full w-1.75 border-b", border)} /><span className={cn("relative h-full w-px", bg)}>{tile}</span></>;
  if (variant === "dot-hollow") return <><span className={cn("relative h-full w-px", bg)}>{tile}</span><span className={cn("size-1.25 min-h-1.25 rounded-full border", border)} /><span className={cn("relative h-full w-px", bg)}>{tile}</span></>;
  if (variant === "start-cap-thick") return <span className={cn("relative h-full w-1.75 rounded-t-xs", bg)}>{tile}</span>;
  if (variant === "end-cap-thick") return <span className={cn("h-full w-1.75 rounded-b-xs", bg)} />;
  return <span className={cn("size-1.25 rounded-full", bg)} />;
}

function LineMarker({ state, variant }: { state?: TimelineEventState; variant: TimelineLineVariant }) {
  return <span className={cn("relative", variant === "normal" ? "w-1.75" : "w-px", backgroundClass(state))}>{state === "inprogress" && <span className="absolute inset-0 animate-tile-scroll opacity-30" style={{ backgroundImage: `url(${tileBgPath})`, backgroundSize: "8px 8px" }} />}</span>;
}

function backgroundClass(state?: TimelineEventState) {
  return state === "complete" ? "bg-success" : state === "error" ? "bg-error" : state === "inprogress" ? "bg-pending" : "bg-text-dimmed";
}

function borderClass(state?: TimelineEventState) {
  return state === "complete" ? "border-success" : state === "error" ? "border-error" : state === "inprogress" ? "border-pending" : "border-text-dimmed";
}

export function getRunTimelineHelpText(title: string) {
  return title === "Triggered" ? "The run was triggered"
    : title === "Dequeued" ? "The run was dequeued from the queue"
    : title === "Started" ? "The run began executing"
    : title === "Finished" ? "The run completed execution"
    : title === "Expired" ? "The run expired before it could be started"
    : undefined;
}
