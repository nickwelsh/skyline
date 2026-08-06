/*!
 * Reached Queue-detail presenter composition from Trigger.dev
 * _app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.queues_.$queueParam/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline supplies recorded activity and Runs through QueueTargetDetailPresentation.
 */
import { ListPagination } from "~/components/ListPagination";
import { MetricsLayout } from "~/components/layout/MetricsLayout";
import { Button } from "~/components/primitives/Buttons";
import { Card, CardHeader } from "~/components/primitives/charts/Card";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { Header3 } from "~/components/primitives/Headers";
import { Spinner } from "~/components/primitives/Spinner";
import { TaskRunsTable, type PresentedRun } from "~/components/runs/v3/TaskRunsTable";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";
import { useLocation } from "@remix-run/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { QueueTargetCharts } from "./QueueTargetCharts";
import { QueueTargetFilters, type QueueTimeRangeOption } from "./QueueTargetFilters";
import { RecordedStatusBreakdown, type PresentedQueueTarget } from "./QueueTargetsPresenter";

type ActivityPoint = { timestamp: string; recordedRuns: number; recordedRunCounts: Record<RunStatus, number> };
type QueueTimePoint = { timestamp: string; sampleCount: number; medianUs: number; p95Us: number; maximumUs: number };

export type QueueTargetDetailPresentation = {
  generatedAt: string;
  queueTarget: PresentedQueueTarget;
  stats: {
    running: number;
    limit: number | null;
    queued: number;
    peakQueued: number;
    oldestWait: string;
    worstWait: string;
  };
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
  const location = useLocation();
  const [showRecordedRuns, setShowRecordedRuns] = useState(() => new URLSearchParams(location.search).has("cursor"));
  const recordedRunsControl = useRef<HTMLButtonElement>(null);
  const restoreRecordedRunsFocus = useRef(false);

  useEffect(() => {
    if (showRecordedRuns) return;
    if (!restoreRecordedRunsFocus.current) return;
    restoreRecordedRunsFocus.current = false;
    recordedRunsControl.current?.focus();
  }, [showRecordedRuns]);

  function closeRecordedRuns() {
    restoreRecordedRunsFocus.current = true;
    setShowRecordedRuns(false);
  }

  return (
    <MetricsLayout.Root>
      <MetricsLayout.Filters className="px-2">
        <QueueTargetFilters statuses={data.statusOptions} generatedAt={data.generatedAt} timeRanges={data.timeRanges} />
        {!showRecordedRuns && (
          <section data-skyline-extension="queue-recorded-runs" aria-label="Recorded runs">
            <Button
              ref={recordedRunsControl}
              variant="secondary/small"
              aria-controls="queue-recorded-runs-content"
              aria-expanded={false}
              onClick={() => setShowRecordedRuns(true)}
            >
              Recorded runs
            </Button>
          </section>
        )}
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
        <QueueTargetCharts
          activity={data.activity}
          queueTime={data.queueTime}
          recordedRuns={showRecordedRuns ? (
            <RecordedRunsCard data={data} loading={loading} onClose={closeRecordedRuns} />
          ) : undefined}
        />
      </MetricsLayout.Content>
    </MetricsLayout.Root>
  );
}

function RecordedRunsCard({
  data,
  loading,
  onClose,
}: {
  data: QueueTargetDetailPresentation;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <section
      id="queue-recorded-runs-panel"
      data-skyline-extension="queue-recorded-runs"
      aria-label="Recorded runs"
      className="h-52 min-w-0"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <Card className="h-full overflow-hidden">
        <CardHeader>
          <Button
            variant="secondary/small"
            aria-controls="queue-recorded-runs-content"
            aria-expanded={true}
            onClick={onClose}
          >
            Recorded runs
          </Button>
          <span className="flex items-center gap-1">
            <ListPagination list={data} />
            <Button variant="secondary/small" aria-label="Close recorded runs" onClick={onClose}>Close</Button>
          </span>
        </CardHeader>
        <div id="queue-recorded-runs-content" className="relative min-h-0 flex-1 overflow-auto">
          {data.runs.length > 0
            ? <TaskRunsTable runs={data.runs} isLoading={loading} />
            : <RunsEmpty filtered={data.hasAnyRuns && data.hasFilters} />}
          {loading && data.runs.length === 0 && (
            <div aria-label="Loading Queue-target Runs" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>
          )}
        </div>
      </Card>
    </section>
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
