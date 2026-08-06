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
import { useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { QueueBigNumber } from "./QueueBigNumber";
import { QueueTargetCharts } from "./QueueTargetCharts";
import { QueuePeriodFilter, QueueRunStatusFilter, type QueueTimeRangeOption } from "./QueueTargetFilters";
import type { PresentedQueueTarget } from "./QueueTargetsPresenter";

type ActivityPoint = { timestamp: string; recordedRuns: number; recordedRunCounts: Record<RunStatus, number> };
type QueueTimePoint = { timestamp: string; sampleCount: number; medianUs: number | null; p95Us: number | null; maximumUs: number | null };

export type QueueTargetDetailPresentation = {
  generatedAt: string;
  queueTarget: PresentedQueueTarget;
  stats: { running: number; limit: number | null; queued: number; peakQueued: number; oldestWait: string; worstWait: string };
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
  const navigate = useNavigate();
  const view = new URLSearchParams(location.search).get("view") === "keys" ? "keys" : "overview";
  const [showRecordedRuns, setShowRecordedRuns] = useState(() => new URLSearchParams(location.search).has("cursor"));
  const recordedRunsControl = useRef<HTMLButtonElement>(null);
  const restoreRecordedRunsFocus = useRef(false);

  useEffect(() => {
    if (showRecordedRuns || !restoreRecordedRunsFocus.current) return;
    restoreRecordedRunsFocus.current = false;
    recordedRunsControl.current?.focus();
  }, [showRecordedRuns]);

  function selectView(nextView: "overview" | "keys") {
    const params = new URLSearchParams(location.search);
    nextView === "keys" ? params.set("view", "keys") : params.delete("view");
    navigate(`${location.pathname}${params.size ? `?${params}` : ""}`);
  }

  function closeRecordedRuns() {
    restoreRecordedRunsFocus.current = true;
    setShowRecordedRuns(false);
  }

  return (
    <MetricsLayout.Root>
      <MetricsLayout.Filters className="pl-1.5 pr-2">
        <div className="translate-y-px self-end pl-2">
          <div className="flex gap-x-6 border-b border-grid-bright">
            <QueueTab active={view === "overview"} onClick={() => selectView("overview")}>Overview</QueueTab>
            <QueueTab active={view === "keys"} onClick={() => selectView("keys")}>Concurrency keys</QueueTab>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <QueuePeriodFilter generatedAt={data.generatedAt} timeRanges={data.timeRanges} />
          {!showRecordedRuns && (
            <section data-skyline-extension="queue-recorded-runs" aria-label="Recorded runs">
              <Button ref={recordedRunsControl} variant="secondary/small" aria-controls="queue-recorded-runs-content" aria-expanded={false} onClick={() => setShowRecordedRuns(true)}>Recorded runs</Button>
            </section>
          )}
        </div>
      </MetricsLayout.Filters>
      <MetricsLayout.Grid>
        <ConcurrencyBlock running={data.stats.running} limit={data.stats.limit} />
        <QueueBigNumber title="Queued" value={data.stats.queued} suffix={data.stats.peakQueued > 0 ? `peak ${data.stats.peakQueued.toLocaleString()}` : undefined} />
        <QueueBigNumber title="Oldest wait" formattedValue={data.stats.oldestWait} suffix={data.stats.worstWait !== "0" ? `worst ${data.stats.worstWait}` : undefined} />
      </MetricsLayout.Grid>
      <MetricsLayout.Content inset>
        {view === "overview" ? (
          <QueueTargetCharts activity={data.activity} queueTime={data.queueTime} recordedRuns={showRecordedRuns ? <RecordedRunsCard data={data} loading={loading} onClose={closeRecordedRuns} /> : undefined} />
        ) : (
          <div className="grid min-h-64 place-items-center text-center"><div><h2 className="font-medium text-text-bright">No concurrency keys configured</h2><p className="mt-1 text-sm text-text-dimmed">This queue does not use captured concurrency keys.</p></div></div>
        )}
      </MetricsLayout.Content>
    </MetricsLayout.Root>
  );
}

function QueueTab({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center pt-1 focus-custom">
      <span className="text-sm text-text-bright">{children}</span>
      <span className={`mt-1 h-0.5 w-full ${active ? "bg-indigo-500" : "bg-surface-control-active opacity-0 group-hover:opacity-100"}`} />
    </button>
  );
}

function ConcurrencyBlock({ running, limit }: { running: number; limit: number | null }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-lg border border-grid-bright bg-background-bright p-4">
      <Header3 className="leading-6">Concurrency</Header3>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[3.75rem] font-normal leading-none tabular-nums text-text-bright">{running.toLocaleString()}</span>
        <span className="text-xl tabular-nums text-text-dimmed">/ {limit === null ? "∞" : limit.toLocaleString()}</span>
      </div>
    </div>
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
