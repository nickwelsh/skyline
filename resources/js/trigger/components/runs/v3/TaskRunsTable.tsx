/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/TaskRunsTable.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Selection, write actions, deployment, machine, region, cost, delay, TTL, and tags remain external.
 */
import { ClockIcon, CpuChipIcon, RectangleStackIcon } from "@heroicons/react/20/solid";
import { TasksIcon } from "~/assets/icons/TasksIcon";
import { TaskIcon } from "~/assets/icons/TaskIcon";
import { formatDurationMilliseconds } from "~/utils/durations";
import { Badge } from "~/components/primitives/Badge";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTime } from "~/components/primitives/DateTime";
import { Header3 } from "~/components/primitives/Headers";
import { Paragraph } from "~/components/primitives/Paragraph";
import { Spinner } from "~/components/primitives/Spinner";
import {
  Table,
  TableBlankRow,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "~/components/primitives/Table";
import { SimpleTooltip } from "~/components/primitives/Tooltip";
import { descriptionForTaskRunStatus, filterableTaskRunStatuses, TaskRunStatusCombo, type RunStatus } from "~/components/runs/v3/TaskRunStatus";

export type PresentedRun = {
  id: string;
  friendlyId?: string;
  path: string;
  isRoot?: boolean;
  jobType: string;
  taskIdentifier?: string;
  rootTaskRunId?: string | null;
  version?: string | null;
  machine?: string | null;
  status: RunStatus;
  queueTarget: string;
  queue?: { connection: string | null; name: string; type: "task" | "custom" } | null;
  startedAt?: string | null;
  queueDurationMs?: number | null;
  runDurationMs?: number | null;
  computeDurationMs?: number | null;
  queueDuration: string;
  duration: string;
  activeDuration?: string;
};

type TaskRunsTableProps = {
  total?: number;
  hasFilters?: boolean;
  runs: PresentedRun[];
  isLoading?: boolean;
  presentation?: "default" | "error";
  showVersions?: boolean;
  showMachines?: boolean;
  showTopBorder?: boolean;
  stickyHeader?: boolean;
};

export function TaskRunsTable({ total, hasFilters, runs, isLoading = false, presentation = "default", showVersions = false, showMachines = false, showTopBorder = true, stickyHeader = false }: TaskRunsTableProps) {
  if (presentation === "error") {
    return <ErrorRunsTable total={total} hasFilters={hasFilters} runs={runs} isLoading={isLoading} showVersions={showVersions} showMachines={showMachines} />;
  }
  const resolvedTotal = total ?? runs.length;
  return (
    <Table variant="dimmed" className="max-h-full overflow-y-auto" showTopBorder={showTopBorder} stickyHeader={stickyHeader}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>ID</TableHeaderCell>
          <TableHeaderCell>Job</TableHeaderCell>
          <TableHeaderCell
            disableTooltipHoverableContent
            tooltip={
              <div className="flex flex-col divide-y divide-grid-dimmed">
                {filterableTaskRunStatuses.map((status) => (
                  <div key={status} className="grid grid-cols-[8rem_1fr] gap-x-2 py-2 first:pt-1 last:pb-1">
                    <div className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap"><TaskRunStatusCombo status={status} /></div>
                    <Paragraph variant="extra-small" className="text-wrap! text-text-dimmed">{descriptionForTaskRunStatus(status)}</Paragraph>
                  </div>
                ))}
              </div>
            }
          >Status</TableHeaderCell>
          <TableHeaderCell>Started</TableHeaderCell>
          <TableHeaderCell
            colSpan={3}
            disableTooltipHoverableContent
            tooltip={
              <div className="flex max-w-xs flex-col gap-4 p-1">
                <div>
                  <div className="mb-0.5 flex items-center gap-1.5"><RectangleStackIcon className="size-4 text-text-dimmed" /><Header3>Queued duration</Header3></div>
                  <Paragraph variant="small" className="text-wrap! text-text-dimmed">The amount of time from when the run was created to it starting to run.</Paragraph>
                </div>
                <div>
                  <div className="mb-0.5 flex items-center gap-1.5"><ClockIcon className="size-4 text-blue-500" /><Header3>Run duration</Header3></div>
                  <Paragraph variant="small" className="text-wrap! text-text-dimmed">The total amount of time from the run starting to it finishing. This includes all time spent waiting.</Paragraph>
                </div>
                <div>
                  <div className="mb-0.5 flex items-center gap-1.5"><CpuChipIcon className="size-4 text-success" /><Header3>Compute duration</Header3></div>
                  <Paragraph variant="small" className="text-wrap! text-text-dimmed">The amount of compute time used in the run. This does not include time spent waiting.</Paragraph>
                </div>
              </div>
            }
          >Duration</TableHeaderCell>
          <TableHeaderCell>Queue</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resolvedTotal === 0 ? (
          <TableBlankRow colSpan={8}>
            {!isLoading && (
              <Paragraph className="w-auto">
                {hasFilters ? "No runs match your filters." : "No runs found"}
              </Paragraph>
            )}
          </TableBlankRow>
        ) : (
          runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell to={run.path} isTabbableCell>
                <RunId value={run.friendlyId ?? run.id} copyValue={run.id} />
              </TableCell>
              <TableCell to={run.path}>
                <span className="flex items-center gap-x-1">
                  <TaskIcon className="size-3.5 flex-none text-tasks" />
                  <span>{run.taskIdentifier ?? run.jobType}</span>
                  {run.rootTaskRunId === null || run.isRoot ? <Badge variant="extra-small">Root</Badge> : null}
                </span>
              </TableCell>
              <TableCell to={run.path}>
                <SimpleTooltip content={descriptionForTaskRunStatus(run.status)} disableHoverableContent button={<TaskRunStatusCombo status={run.status} />} />
              </TableCell>
              <TableCell to={run.path}>
                {run.startedAt ? <DateTime date={run.startedAt} /> : "–"}
              </TableCell>
              <TableCell to={run.path} className="w-[1%]" actionClassName="pr-0 tabular-nums">
                <div className="flex items-center gap-1">
                  <RectangleStackIcon className="size-4 text-text-dimmed" />
                  {run.queueDurationMs === null || run.queueDurationMs === undefined ? "–" : formatDurationMilliseconds(run.queueDurationMs, { style: "short" })}
                </div>
              </TableCell>
              <TableCell to={run.path} className="w-[1%]" actionClassName="px-4 tabular-nums">
                <div className="flex items-center gap-1">
                  <ClockIcon className="size-4 text-blue-500" />
                  {run.runDurationMs === null || run.runDurationMs === undefined ? "–" : formatDurationMilliseconds(run.runDurationMs, { style: "short" })}
                </div>
              </TableCell>
              <TableCell to={run.path} actionClassName="pl-0 tabular-nums">
                <div className="flex items-center gap-1">
                  <CpuChipIcon className="size-4 text-success" />
                  {run.computeDurationMs === null || run.computeDurationMs === undefined ? "–" : formatDurationMilliseconds(run.computeDurationMs, { style: "short" })}
                </div>
              </TableCell>
              <TableCell to={run.path}>{run.queueTarget}</TableCell>
            </TableRow>
          ))
        )}
        {isLoading && (
          <TableBlankRow
            colSpan={8}
            className="absolute left-0 top-0 flex h-full w-full items-center justify-center gap-2 bg-background-dimmed"
          >
            <Spinner /> <span className="text-text-dimmed">Loading…</span>
          </TableBlankRow>
        )}
      </TableBody>
    </Table>
  );
}


function ErrorRunsTable({ total, hasFilters, runs, isLoading, showVersions, showMachines }: Required<Pick<TaskRunsTableProps, "runs" | "isLoading" | "showVersions" | "showMachines">> & Pick<TaskRunsTableProps, "total" | "hasFilters">) {
  const resolvedTotal = total ?? runs.length;
  const columnCount = 8 + Number(showVersions) + Number(showMachines);
  return (
    <Table variant="dimmed" className="max-h-full overflow-y-auto">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>ID</TableHeaderCell>
          <TableHeaderCell>Task</TableHeaderCell>
          {showVersions ? <TableHeaderCell>Version</TableHeaderCell> : null}
          <TableHeaderCell tooltip="Run has failed with errors.">Status</TableHeaderCell>
          <TableHeaderCell>Started</TableHeaderCell>
          <TableHeaderCell colSpan={3} tooltip="Queued, run, and compute duration.">Duration</TableHeaderCell>
          {showMachines ? <TableHeaderCell>Machine</TableHeaderCell> : null}
          <TableHeaderCell>Queue</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resolvedTotal === 0 ? (
          <TableBlankRow colSpan={columnCount}>
            {!isLoading && <Paragraph className="w-auto">{hasFilters ? "No runs match your filters." : "No runs found"}</Paragraph>}
          </TableBlankRow>
        ) : runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell to={run.path} isTabbableCell><RunId value={run.friendlyId ?? run.id} copyValue={run.id} /></TableCell>
            <TableCell to={run.path}>
              <span className="flex items-center gap-x-1">
                <span>{run.jobType}</span>
                {run.isRoot ? <Badge variant="extra-small">Root</Badge> : null}
              </span>
            </TableCell>
            {showVersions ? <TableCell to={run.path}>{run.version ?? "–"}</TableCell> : null}
            <TableCell to={run.path}>
              <SimpleTooltip content={descriptionForTaskRunStatus(run.status)} disableHoverableContent button={<TaskRunStatusCombo status={run.status} />} />
            </TableCell>
            <TableCell to={run.path}>{run.startedAt ? <DateTime date={run.startedAt} /> : "–"}</TableCell>
            <TableCell to={run.path} className="w-[1%]" actionClassName="pr-0 tabular-nums">
              <span className="flex items-center gap-1"><RectangleStackIcon className="size-4 text-text-dimmed" />{run.queueDuration}</span>
            </TableCell>
            <TableCell to={run.path} className="w-[1%]" actionClassName="px-4 tabular-nums">
              <span className="flex items-center gap-1"><ClockIcon className="size-4 text-blue-500" />{run.duration}</span>
            </TableCell>
            <TableCell to={run.path} actionClassName="pl-0 tabular-nums">
              <span className="flex items-center gap-1"><CpuChipIcon className="size-4 text-success" />{run.activeDuration ?? "–"}</span>
            </TableCell>
            {showMachines ? <TableCell to={run.path}>{run.machine ?? "–"}</TableCell> : null}
            {run.queue ? (
              <TableCell to={run.path} leadingContent={<ErrorRunQueue queue={run.queue} />}>
                <span className="sr-only">{run.queue.connection ? `${run.queue.connection} / ${run.queue.name}` : run.queue.name}</span>
              </TableCell>
            ) : <TableCell to={run.path}>–</TableCell>}
          </TableRow>
        ))}
        {isLoading ? (
          <TableBlankRow colSpan={columnCount} className="absolute left-0 top-0 flex h-full w-full items-center justify-center gap-2 bg-background-dimmed">
            <Spinner /> <span className="text-text-dimmed">Loading…</span>
          </TableBlankRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

function ErrorRunQueue({ queue }: { queue: NonNullable<PresentedRun["queue"]> }) {
  const task = queue.type === "task";
  return (
    <SimpleTooltip
      buttonClassName="w-fit"
      button={
        <span className="flex items-center gap-1">
          {task
            ? <TasksIcon className="size-[1.125rem] text-blue-500" />
            : <RectangleStackIcon className="size-[1.125rem] text-purple-500" />}
          <span>{queue.name}</span>
        </span>
      }
      content={task
        ? `This queue was automatically created from your "${queue.name}" task`
        : "This is a custom queue you added in your code."}
      disableHoverableContent
    />
  );
}

function RunId({ value, copyValue = value }: { value: string; copyValue?: string }) {
  return (
    <SimpleTooltip
      content={value}
      button={
        <span className="flex h-6 items-center gap-1">
          <CopyableText value={value.slice(-8)} copyValue={copyValue} className="font-mono" />
        </span>
      }
      asChild
      disableHoverableContent
    />
  );
}
