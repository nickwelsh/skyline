/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/TaskRunStatus.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Replaced Trigger database/core status types with Skyline RunStatus.
 */
import {
  ArrowPathIcon,
  CheckCircleIcon,
  RectangleStackIcon,
  XCircleIcon,
} from "@heroicons/react/20/solid";
import assertNever from "assert-never";

import { Spinner } from "../../primitives/Spinner";
import { cn } from "../../../utils/cn";

export type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";

export const allTaskRunStatuses = [
  "queued",
  "running",
  "retrying",
  "completed",
  "failed",
] as const satisfies Readonly<Array<RunStatus>>;

export const filterableTaskRunStatuses = allTaskRunStatuses;

const taskRunStatusDescriptions: Record<RunStatus, string> = {
  queued: "Run is waiting to be executed.",
  running: "Run is currently being executed.",
  retrying: "Run is being reattempted after a failure.",
  completed: "Run has completed successfully.",
  failed: "Run has failed with errors.",
};

export const QUEUED_STATUSES = ["queued"] satisfies RunStatus[];
export const RUNNING_STATUSES = ["running", "retrying"] satisfies RunStatus[];

export function descriptionForTaskRunStatus(status: RunStatus): string {
  return taskRunStatusDescriptions[status];
}

export function TaskRunStatusCombo({
  status,
  className,
  iconClassName,
}: {
  status: RunStatus;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <TaskRunStatusIcon status={status} className={cn("h-4 w-4", iconClassName)} />
      <TaskRunStatusLabel status={status} />
    </span>
  );
}

export function TaskRunStatusLabel({ status }: { status: RunStatus }) {
  return (
    <span className={cn("system-mono-label", runStatusClassNameColor(status))}>
      {runStatusTitle(status)}
    </span>
  );
}

export function TaskRunStatusIcon({
  status,
  className,
}: {
  status: RunStatus;
  className: string;
}) {
  switch (status) {
    case "queued":
      return <RectangleStackIcon className={cn(runStatusClassNameColor(status), className)} />;
    case "running":
      return <Spinner className={cn(runStatusClassNameColor(status), className)} />;
    case "retrying":
      return <ArrowPathIcon className={cn(runStatusClassNameColor(status), className)} />;
    case "completed":
      return <CheckCircleIcon className={cn(runStatusClassNameColor(status), className)} />;
    case "failed":
      return <XCircleIcon className={cn(runStatusClassNameColor(status), className)} />;
    default:
      assertNever(status);
  }
}

export function runStatusClassNameColor(status: RunStatus): string {
  switch (status) {
    case "queued":
      return "text-text-faint";
    case "running":
    case "retrying":
      return "text-pending";
    case "completed":
      return "text-success";
    case "failed":
      return "text-error";
    default:
      return assertNever(status);
  }
}

export const runFriendlyStatus = ["Queued", "Executing", "Reattempting", "Completed", "Failed"] as const;
export type RunFriendlyStatus = (typeof runFriendlyStatus)[number];

export const runStatusTitleFromStatus: Record<RunStatus, RunFriendlyStatus> = {
  queued: "Queued",
  running: "Executing",
  retrying: "Reattempting",
  completed: "Completed",
  failed: "Failed",
};

export function runStatusTitle(status: RunStatus): RunFriendlyStatus {
  return runStatusTitleFromStatus[status];
}

const titlesStatusesArray = Object.entries(runStatusTitleFromStatus) as Array<
  [RunStatus, RunFriendlyStatus]
>;

export function runStatusFromFriendlyTitle(friendly: RunFriendlyStatus): RunStatus {
  const result = titlesStatusesArray.find(([, title]) => title === friendly);
  if (!result) throw new Error(`Unknown friendly status: ${friendly}`);
  return result[0];
}

export function isTaskRunStatus(value: unknown): value is RunStatus {
  return typeof value === "string" && allTaskRunStatuses.includes(value as RunStatus);
}

export function isRunFriendlyStatus(value: unknown): value is RunFriendlyStatus {
  return typeof value === "string" && runFriendlyStatus.includes(value as RunFriendlyStatus);
}

const RUN_STATUS_CHART_COLORS: Record<RunStatus, string> = {
  queued: "var(--color-run-pending)",
  running: "var(--color-run-executing)",
  retrying: "var(--color-run-retrying-after-failure)",
  completed: "var(--color-run-completed-successfully)",
  failed: "var(--color-run-completed-with-errors)",
};

export function getRunStatusChartColor(value: string): string | undefined {
  if (isTaskRunStatus(value)) return RUN_STATUS_CHART_COLORS[value];
  if (isRunFriendlyStatus(value)) return RUN_STATUS_CHART_COLORS[runStatusFromFriendlyTitle(value)];
  return undefined;
}
