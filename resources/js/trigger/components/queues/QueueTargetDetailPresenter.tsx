/*!
 * Reached Queue-detail presenter composition from Trigger.dev
 * _app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline supplies captured Queue activity; Recorded Runs is the sole extension.
 */
import { ListPagination } from "~/components/ListPagination";
import { MetricsLayout } from "~/components/layout/MetricsLayout";
import { Button } from "~/components/primitives/Buttons";
import { Card, CardHeader } from "~/components/primitives/charts/Card";
import { Header3 } from "~/components/primitives/Headers";
import { Spinner } from "~/components/primitives/Spinner";
import { TaskRunsTable, type PresentedRun } from "~/components/runs/v3/TaskRunsTable";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { useLocation } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { QueueBigNumber } from "./QueueBigNumber";
import { QueueTargetCharts } from "./QueueTargetCharts";
import { QueuePeriodFilter, QueueRunStatusFilter, type QueueTimeRangeOption } from "./QueueTargetFilters";
import { RecordedStatusBreakdown, type PresentedQueueTarget } from "./QueueTargetsPresenter";

type ActivityPoint = { timestamp: string; recordedRuns: number; recordedRunCounts: Record<RunStatus, number> };
type QueueTimePoint = { timestamp: string; sampleCount: number; medianUs: number | null; p95Us: number | null; maximumUs: number | null };

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
  const location = useLocation();
  const [showRecordedRuns, setShowRecordedRuns] = useState(() => new URLSearchParams(location.search).has("cursor"));
  const recordedRunsControl = useRef<HTMLButtonElement>(null);
  const restoreRecordedRunsFocus = useRef(false);

  useEffect(() => {
    if (showRecordedRuns || !restoreRecordedRunsFocus.current) return;
    restoreRecordedRunsFocus.current = false;
    recordedRunsControl.current?.focus();
  }, [showRecordedRuns]);

  function closeRecordedRuns() {
    restoreRecordedRunsFocus.current = true;
    setShowRecordedRuns(false);
  }

  return (
    <MetricsLayout.Root>
      <MetricsLayout.Filters className="pl-1.5 pr-2">
        <div />
        <div className="flex items-center gap-1.5">
          {!showRecordedRuns && (
            <section data-skyline-extension="queue-recorded-runs" aria-label="Recorded runs">
              <Button ref={recordedRunsControl} variant="secondary/small" aria-controls="queue-recorded-runs-content" aria-expanded={false} onClick={() => setShowRecordedRuns(true)}>Recorded runs</Button>
            </section>
          )}
          <QueuePeriodFilter generatedAt={data.generatedAt} timeRanges={data.timeRanges} />
        </div>
      </MetricsLayout.Filters>
      <MetricsLayout.Grid>
        <QueueBigNumber title="Recorded Runs" formattedValue={data.queueTarget.recordedRuns} />
        <QueueBigNumber title="Queue-time samples" value={data.queueTarget.queueTimeSampleCount} />
        <QueueBigNumber title="Median queue time" formattedValue={data.queueTarget.medianQueueTime} />
        <QueueBigNumber title="Queue time p95" formattedValue={data.queueTarget.p95QueueTime} />
        <QueueBigNumber title="Maximum queue time" formattedValue={data.queueTarget.maximumQueueTime} />
      </MetricsLayout.Grid>
      <MetricsLayout.Content inset>
        <section className="rounded-lg border border-grid-bright bg-background-bright px-4 py-3">
          <Header3 className="mb-2">Recorded Run status counts</Header3>
          <RecordedStatusBreakdown counts={data.queueTarget.recordedRunCounts} />
        </section>
      </MetricsLayout.Content>
      <MetricsLayout.Content inset>
        <QueueTargetCharts activity={data.activity} queueTime={data.queueTime} recordedRuns={showRecordedRuns ? <RecordedRunsCard data={data} loading={loading} onClose={closeRecordedRuns} /> : undefined} />
      </MetricsLayout.Content>
    </MetricsLayout.Root>
  );
}

function RecordedRunsCard({ data, loading, onClose }: { data: QueueTargetDetailPresentation; loading: boolean; onClose: () => void }) {
  return (
    <section id="queue-recorded-runs-panel" data-skyline-extension="queue-recorded-runs" aria-label="Recorded runs" className="h-52 min-w-0 sm:col-span-2" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }}>
      <Card className="h-full overflow-hidden">
        <CardHeader>
          <Button variant="secondary/small" aria-controls="queue-recorded-runs-content" aria-expanded={true} onClick={onClose}>Recorded runs</Button>
          <span className="flex items-center gap-1"><QueueRunStatusFilter statuses={data.statusOptions} /><ListPagination list={data} /><Button variant="secondary/small" aria-label="Close recorded runs" onClick={onClose}>Close</Button></span>
        </CardHeader>
        <div id="queue-recorded-runs-content" className="relative min-h-0 flex-1 overflow-auto">
          {data.runs.length > 0 ? <TaskRunsTable runs={data.runs} isLoading={loading} /> : <RunsEmpty filtered={data.hasAnyRuns && data.hasFilters} />}
          {loading && data.runs.length === 0 && <div aria-label="Loading Queue-target Runs" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>}
        </div>
      </Card>
    </section>
  );
}

function RunsEmpty({ filtered }: { filtered: boolean }) {
  return <div className="grid min-h-32 place-items-center text-center"><div><h2 className="font-medium text-text-bright">{filtered ? "No matching Runs" : "No Runs in this range"}</h2><p className="mt-1 text-sm text-text-dimmed">{filtered ? "Change or clear filters to see recorded Runs." : "No confirmed Runs were observed for this Queue target."}</p></div></div>;
}
