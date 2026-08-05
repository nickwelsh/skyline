/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/RunIcon.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Narrowed to Skyline NodeKind values and package-local icon assets.
 */
import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  BellIcon,
  CircleStackIcon,
  CommandLineIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import assertNever from "assert-never";

export type NodeKind = "run" | "attempt" | "breadcrumb" | "query" | "request" | "cache" | "redis" | "custom" | "transaction" | "mail" | "notification" | "storage" | "process" | "span";
import { AttemptIcon } from "../../../assets/icons/AttemptIcon";
import { InfoIcon } from "../../../assets/icons/InfoIcon";
import { TaskIcon } from "../../../assets/icons/TaskIcon";
import { cn } from "../../../utils/cn";

export type RunIconProps = {
  kind: NodeKind;
  className?: string;
};

const dimmedClassName = "text-text-dimmed group-hover/spannode:text-text-bright";

export function RunIcon({ kind, className }: RunIconProps) {
  switch (kind) {
    case "run":
      return <TaskIcon className={cn(className, "text-tasks")} />;
    case "attempt":
      return <AttemptIcon className={cn(className, dimmedClassName)} />;
    case "query":
      return <TableCellsIcon className={cn(className, "text-query")} />;
    case "request":
      return <GlobeAltIcon className={cn(className, dimmedClassName)} />;
    case "cache":
      return <ArchiveBoxIcon className={cn(className, dimmedClassName)} />;
    case "redis":
      return <CircleStackIcon className={cn(className, "text-queues")} />;
    case "transaction":
      return <ArrowsRightLeftIcon className={cn(className, dimmedClassName)} />;
    case "mail":
      return <EnvelopeIcon className={cn(className, dimmedClassName)} />;
    case "notification":
      return <BellIcon className={cn(className, dimmedClassName)} />;
    case "storage":
      return <RectangleStackIcon className={cn(className, dimmedClassName)} />;
    case "process":
      return <CommandLineIcon className={cn(className, dimmedClassName)} />;
    case "breadcrumb":
      return <InfoIcon className={cn(className, dimmedClassName)} />;
    case "custom":
    case "span":
      return <Squares2X2Icon className={cn(className, dimmedClassName)} />;
    default:
      assertNever(kind);
  }
}
