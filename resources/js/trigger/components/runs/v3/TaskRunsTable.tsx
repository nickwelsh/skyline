/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/TaskRunsTable.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Selection, write actions, deployment, machine, region, cost, delay, TTL, and tags remain external.
 */
import { ClockIcon, CpuChipIcon, RectangleStackIcon } from "@heroicons/react/20/solid";
import { Badge } from "~/components/primitives/Badge";
import { CopyableText } from "~/components/primitives/CopyableText";
import { DateTimeShort } from "~/components/primitives/DateTime";
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
import { TaskRunStatusCombo, type RunStatus } from "~/components/runs/v3/TaskRunStatus";

export type PresentedRun = {
  id: string;
  friendlyId?: string;
  path: string;
  isRoot?: boolean;
  jobType: string;
  version?: string | null;
  machine?: string | null;
  status: RunStatus;
  queueTarget: string;
  traceIdentity: string;
  attemptCount: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  queueDuration: string;
  duration: string;
  activeDuration?: string;
};

type TaskRunsTableProps = {
  total?: number;
  hasFilters?: boolean;
  runs: PresentedRun[];
  isLoading?: boolean;
};

export function TaskRunsTable({ total, hasFilters, runs, isLoading = false }: TaskRunsTableProps) {
  const resolvedTotal = total ?? runs.length;
  return (
    <Table variant="dimmed" className="max-h-full overflow-y-auto">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>ID</TableHeaderCell>
          <TableHeaderCell>Job</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Started</TableHeaderCell>
          <TableHeaderCell colSpan={3}>Duration</TableHeaderCell>
          <TableHeaderCell>Attempts</TableHeaderCell>
          <TableHeaderCell>Queue target</TableHeaderCell>
          <TableHeaderCell>Trace</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resolvedTotal === 0 ? (
          <TableBlankRow colSpan={10}>
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
                <RunId value={run.id} />
              </TableCell>
              <TableCell to={run.path}>
                <span className="flex items-center gap-x-1">
                  <span>{shortName(run.jobType)}</span>
                  {run.isRoot ? <Badge variant="extra-small">Root</Badge> : null}
                </span>
              </TableCell>
              <TableCell to={run.path}>
                <TaskRunStatusCombo status={run.status} />
              </TableCell>
              <TableCell to={run.path}>
                {run.startedAt ? <DateTimeShort date={run.startedAt} /> : "–"}
              </TableCell>
              <TableCell to={run.path} className="w-[1%]" actionClassName="pr-0 tabular-nums">
                <span className="flex items-center gap-1">
                  <RectangleStackIcon className="size-4 text-text-dimmed" />
                  {run.queueDuration}
                </span>
              </TableCell>
              <TableCell to={run.path} className="w-[1%]" actionClassName="px-4 tabular-nums">
                <span className="flex items-center gap-1">
                  <ClockIcon className="size-4 text-blue-500" />
                  {run.duration}
                </span>
              </TableCell>
              <TableCell to={run.path} actionClassName="pl-0 tabular-nums">
                <span className="flex items-center gap-1">
                  <CpuChipIcon className="size-4 text-success" />
                  {run.activeDuration ?? "–"}
                </span>
              </TableCell>
              <TableCell to={run.path} className="tabular-nums">{run.attemptCount}</TableCell>
              <TableCell to={run.path}>{run.queueTarget}</TableCell>
              <TableCell to={run.path} className="font-mono">{run.traceIdentity}</TableCell>
            </TableRow>
          ))
        )}
        {isLoading && (
          <TableBlankRow
            colSpan={10}
            className="absolute left-0 top-0 flex h-full w-full items-center justify-center gap-2 bg-background-dimmed"
          >
            <Spinner /> <span className="text-text-dimmed">Loading…</span>
          </TableBlankRow>
        )}
      </TableBody>
    </Table>
  );
}

function RunId({ value }: { value: string }) {
  return (
    <SimpleTooltip
      content={value}
      button={
        <span className="flex h-6 items-center gap-1">
          <CopyableText value={value.slice(-8)} copyValue={value} className="font-mono" />
        </span>
      }
      asChild
      disableHoverableContent
    />
  );
}

function shortName(name: string) {
  return name.split("\\").at(-1) ?? name;
}
