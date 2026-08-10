/*!
 * Adapted from Trigger.dev apps/webapp/app/components/runs/v3/TaskRunsList.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Live resource polling is external; retained source list and table composition.
 */
import { TaskRunsTable, type PresentedRun } from "./TaskRunsTable";

export type TaskRunsListData = {
  runs: PresentedRun[];
  hasAnyRuns: boolean;
  hasFilters: boolean;
};

export function TaskRunsList({ list, isLoading }: { list: TaskRunsListData; isLoading: boolean }) {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <TaskRunsTable
        total={list.runs.length}
        hasFilters={list.hasFilters}
        runs={list.runs}
        isLoading={isLoading}
        showTopBorder={false}
        stickyHeader
      />
    </div>
  );
}
