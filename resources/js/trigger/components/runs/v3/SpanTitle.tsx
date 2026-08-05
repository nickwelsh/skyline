/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/SpanTitle.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Replaced Trigger event/database types and sprite icons with Skyline presentation types.
 */
import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { Fragment } from "react";

import type { NodeKind } from "./RunIcon";
import { cn } from "../../../utils/cn";

export type SpanLevel = "TRACE" | "LOG" | "INFO" | "DEBUG" | "WARN" | "ERROR";

type AccessoryItem = { text: string };
export type SpanAccessoryStyle = {
  style: "codepath" | "pills" | "list";
  items: AccessoryItem[];
};

export type SpanTitleProps = {
  message: string;
  kind: NodeKind;
  isError: boolean;
  level: SpanLevel;
  isPartial: boolean;
  size: "small" | "large";
  accessory?: SpanAccessoryStyle;
  hideAccessory?: boolean;
  overrideDimmed?: boolean;
};

export function SpanTitle(event: SpanTitleProps) {
  const textClass = eventTextClassName(event);
  const finalTextClass =
    event.overrideDimmed && textClass === "text-text-dimmed" ? "text-text-bright" : textClass;
  const hoverClass =
    finalTextClass === "text-text-dimmed" ? "group-hover/spannode:text-text-bright" : undefined;

  return (
    <span className={cn("flex items-center gap-x-2 overflow-x-hidden", finalTextClass, hoverClass)}>
      <span className="truncate">{event.message}</span>{" "}
      {!event.hideAccessory && event.accessory && (
        <SpanAccessory accessory={event.accessory} size={event.size} />
      )}
    </span>
  );
}

function SpanAccessory({
  accessory,
  size,
}: {
  accessory: SpanAccessoryStyle;
  size: SpanTitleProps["size"];
}) {
  switch (accessory.style) {
    case "codepath":
      return (
        <SpanCodePathAccessory
          accessory={accessory}
          className={cn("overflow-x-hidden", size === "large" ? "text-sm" : "text-xs")}
        />
      );
    case "pills":
      return (
        <span className="flex items-center gap-1">
          {accessory.items.map((item, index) => (
            <SpanPill key={index} text={item.text} />
          ))}
        </span>
      );
    case "list":
      return (
        <span className="flex gap-1">
          {accessory.items.map((item, index) => (
            <span key={index} className="inline-flex items-center gap-1">
              {item.text}
            </span>
          ))}
        </span>
      );
  }
}

function SpanPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-grid-bright bg-background-dimmed px-1.5 py-px text-xxs text-text-dimmed">
      <span className="truncate">{text}</span>
    </span>
  );
}

export function SpanCodePathAccessory({
  accessory,
  className,
}: {
  accessory: SpanAccessoryStyle;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "inline-flex items-center gap-0.5 truncate rounded border border-grid-bright bg-background-bright px-1.5 py-0.5 font-mono text-text-dimmed",
        className
      )}
    >
      {accessory.items.map((item, index) => (
        <Fragment key={index}>
          <span className="truncate text-text-dimmed">{item.text}</span>
          {index < accessory.items.length - 1 && (
            <span className="text-text-dimmed">
              <ChevronRightIcon className="size-4" />
            </span>
          )}
        </Fragment>
      ))}
    </code>
  );
}

function eventTextClassName(event: Pick<SpanTitleProps, "kind" | "level">) {
  switch (event.level) {
    case "WARN":
      return "text-amber-400";
    case "ERROR":
      return "text-error";
    default:
      return textClassNameForKind(event.kind);
  }
}

type RunEvent = {
  kind: NodeKind;
  isError: boolean;
  level: SpanLevel;
  isPartial: boolean;
  isCancelled: boolean;
};

export function eventBackgroundClassName(event: RunEvent) {
  if (event.isError) return "bg-error";
  if (event.isCancelled) return "bg-surface-control";
  if (event.level === "WARN") return "bg-amber-400";
  if (event.level === "ERROR") return "bg-error";
  return backgroundClassNameForKind(event.kind, event.isPartial);
}

export function eventBorderClassName(event: RunEvent) {
  if (event.isError) return "border-error";
  if (event.isCancelled) return "border-border-bright";
  if (event.level === "WARN") return "border-amber-400";
  if (event.level === "ERROR") return "border-error";
  return borderClassNameForKind(event.kind, event.isPartial);
}

function isPrimaryKind(kind: NodeKind) {
  return kind === "run" || kind === "attempt";
}

function textClassNameForKind(kind: NodeKind) {
  return isPrimaryKind(kind) ? "text-blue-500 system:text-text-bright" : "text-text-dimmed";
}

function backgroundClassNameForKind(kind: NodeKind, isPartial: boolean) {
  if (!isPrimaryKind(kind)) return "bg-surface-control-active";
  return isPartial ? "bg-blue-500" : "bg-success";
}

function borderClassNameForKind(kind: NodeKind, isPartial: boolean) {
  if (!isPrimaryKind(kind)) return "border-border-brightest";
  return isPartial ? "border-blue-500" : "border-success";
}
