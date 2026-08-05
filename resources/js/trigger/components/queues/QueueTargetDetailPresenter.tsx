/*!
 * Reached Queue-detail presenter composition from Trigger.dev
 * _app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline supplies recorded activity and Runs through QueueTargetDetailPresentation.
 */
import { ListPagination } from "~/components/ListPagination";
import { MetricsLayout } from "~/components/layout/MetricsLayout";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { Header3 } from "~/components/primitives/Headers";
import { Spinner } from "~/components/primitives/Spinner";
import { TaskRunsTable, type PresentedRun } from "~/components/runs/v3/TaskRunsTable";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import type { ReactNode } from "react";
import { QueueTargetCharts } from "./QueueTargetCharts";
import { QueueTargetFilters, type QueueTimeRangeOption } from "./QueueTargetFilters";
import { RecordedStatusBreakdown, type PresentedQueueTarget } from "./QueueTargetsPresenter";

type ActivityPoint = { timestamp: string; recordedRuns: number; recordedRunCounts: Record<RunStatus, number> };
type QueueTimePoint = { timestamp: string; sampleCount: number; medianUs: number; p95Us: number; maximumUs: number };

export type QueueTargetDetailPresentation = {
  generatedAt: string;
  queueTarget: PresentedQueueTarget;
  activity: ActivityPoint[];
  queueTime: QueueTimePoint[];
  runs: PresentedRun[];
  pagination: { previous?: string; next?: string };
  statusOptions: RunStatus[];
  timeRanges: QueueTimeRangeOption[];
  hasAnyRuns: boolean;
  hasFilters: boolean;
};

export function QueueTargetDetailPresenter({ data, loading }: { data: QueueTargetDetailPresentation; loading: boolean }) {
  const target = data.queueTarget;
  return (
    <MetricsLayout.Root>
      <MetricsLayout.Filters className="px-2">
        <QueueTargetFilters statuses={data.statusOptions} generatedAt={data.generatedAt} timeRanges={data.timeRanges} />
        <ListPagination list={data} />
      </MetricsLayout.Filters>
      <MetricsLayout.Grid columns={{ base: 2, lg: 4 }}>
        <ObservedStat label="Recorded Runs" value={target.recordedRuns} />
        <ObservedStat label="Queue-time samples" value={target.queueTimeSampleCount.toLocaleString()} />
        <ObservedStat label="Median" value={target.medianQueueTime} />
        <ObservedStat label="P95" value={target.p95QueueTime} />
        <ObservedStat label="Maximum" value={target.maximumQueueTime} />
        <ObservedStat label="First observed" value={target.firstObservedAt ? <DateTimeShort date={target.firstObservedAt} /> : "—"} />
        <ObservedStat label="Last observed" value={target.lastObservedAt ? <DateTimeShort date={target.lastObservedAt} /> : "—"} />
        <div className="rounded-lg border border-grid-bright bg-background-bright p-3">
          <Header3>Recorded Runs by status</Header3>
          <div className="mt-4 overflow-x-auto text-xs"><RecordedStatusBreakdown counts={target.recordedRunCounts} /></div>
        </div>
      </MetricsLayout.Grid>
      <MetricsLayout.Content inset>
        <QueueTargetCharts activity={data.activity} queueTime={data.queueTime} />
      </MetricsLayout.Content>
      <MetricsLayout.Content>
        <section aria-labelledby="queue-runs-heading" className="border-t border-grid-bright">
          <div className="px-3 py-3"><Header3 id="queue-runs-heading">Recorded Runs</Header3></div>
          <div className="relative min-h-32">
            {data.runs.length > 0
              ? <TaskRunsTable runs={data.runs} isLoading={loading} />
              : <RunsEmpty filtered={data.hasAnyRuns && data.hasFilters} />}
            {loading && data.runs.length === 0 && <div aria-label="Loading Queue-target Runs" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>}
          </div>
        </section>
      </MetricsLayout.Content>
    </MetricsLayout.Root>
  );
}

function ObservedStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-grid-bright bg-background-bright p-3">
      <Header3>{label}</Header3>
      <div className="mt-4 font-mono text-2xl tabular-nums text-text-bright">{value}</div>
    </div>
  );
}

function RunsEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid min-h-32 place-items-center text-center">
      <div>
        <h2 className="font-medium text-text-bright">{filtered ? "No matching Runs" : "No Runs in this range"}</h2>
        <p className="mt-1 text-sm text-text-dimmed">{filtered ? "Change or clear filters to see recorded Runs." : "No confirmed Runs were observed for this Queue target."}</p>
      </div>
    </div>
  );
}
