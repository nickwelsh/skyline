/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/TaskRunsTable.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Trigger execution, selection, machine, region, version, cost, replay, and cancel columns are omitted.
 */
import { ClockIcon } from "@heroicons/react/20/solid";
import { Link } from "@remix-run/react";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { TaskRunStatusCombo, type RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { cn } from "~/utils/cn";

export type PresentedRun = {
  id: string;
  path: string;
  jobType: string;
  status: RunStatus;
  queueTarget: string;
  traceIdentity: string;
  attemptCount: number;
  triggeredAt: string;
  queueDuration: string;
  duration: string;
};

type TaskRunsTableProps = {
  runs: PresentedRun[];
  isLoading?: boolean;
};

export function TaskRunsTable({ runs, isLoading = false }: TaskRunsTableProps) {
  return (
    <div className="max-h-full overflow-auto whitespace-nowrap border-t border-grid-dimmed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background-dimmed">
          <tr className="border-b border-grid-dimmed text-left">
            <HeaderCell>Run</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell>Queue target</HeaderCell>
            <HeaderCell>Trace</HeaderCell>
            <HeaderCell>Attempts</HeaderCell>
            <HeaderCell>Triggered</HeaderCell>
            <HeaderCell>Queue time</HeaderCell>
            <HeaderCell className="text-right">Duration</HeaderCell>
          </tr>
        </thead>
        <tbody aria-busy={isLoading} className={cn(isLoading && "opacity-50")}>
          {runs.map((run) => (
            <tr key={run.id} className="group/table-row border-b border-grid-dimmed">
              <Cell className="max-w-md">
                <Link to={run.path} className="group/run block outline-hidden focus-custom">
                  <div className="truncate font-medium text-text-bright group-hover/run:underline">{shortName(run.jobType)}</div>
                  <div className="truncate font-mono text-xs text-text-faint">{run.id}</div>
                </Link>
              </Cell>
              <Cell><TaskRunStatusCombo status={run.status} /></Cell>
              <Cell className="font-mono text-xs text-text-bright">{run.queueTarget}</Cell>
              <Cell className="max-w-40 truncate font-mono text-xs text-text-dimmed">{run.traceIdentity}</Cell>
              <Cell className="tabular-nums">{run.attemptCount}</Cell>
              <Cell className="tabular-nums text-text-bright"><DateTimeShort date={run.triggeredAt} /></Cell>
              <Cell className="tabular-nums"><span className="flex items-center gap-1"><ClockIcon className="size-3 text-text-faint" />{run.queueDuration}</span></Cell>
              <Cell className="text-right font-mono tabular-nums text-text-bright">{run.duration}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2.5 pb-3 text-sm font-normal text-text-dimmed", className)}>{children}</th>;
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 text-xs group-hover/table-row:bg-background-bright", className)}>{children}</td>;
}

function shortName(name: string) {
  return name.split("\\").at(-1) ?? name;
}
