/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, deployment, schedule, and source-definition concerns are external; Job guidance and test remain capability-dormant.
 */
import { Link, useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { DateTimeShort } from "~/components/primitives/DateTime";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { SearchInput } from "~/components/primitives/SearchInput";
import { Spinner } from "~/components/primitives/Spinner";
import { getRunStatusChartColor, TaskRunStatusCombo } from "~/components/runs/v3/TaskRunStatus";
import { ExitIcon } from "~/assets/icons/ExitIcon";
import { TaskIcon } from "~/assets/icons/TaskIcon";
import { CodeBlock } from "~/CodeBlock";

type RunStatus = "queued" | "running" | "retrying" | "completed" | "failed";
type PresentedJob = {
  id: string;
  path: string;
  name: string;
  firstObservedAt: string;
  lastObservedAt: string;
  runCount: number;
  statusCounts: Record<RunStatus, number>;
  latestRun: { id: string; status: RunStatus; triggeredAt: string; path: string };
};
type JobsRouteData = {
  jobs: PresentedJob[];
  timeRanges: Array<{ value: string; label: string }>;
  hasAnyJobs: boolean;
  hasFilters: boolean;
  jobGuidance: boolean;
  showJobGuidance: boolean;
  onJobGuidanceChange: (show: boolean) => void;
  testJob: boolean;
};

export default function JobsRoute() {
  const data = useLoaderData() as JobsRouteData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLoading = navigation.state !== "idle";
  const updatePeriod = (period: string) => {
    const next = new URLSearchParams(searchParams);
    period === "all" ? next.delete("period") : next.set("period", period);
    next.delete("cursor");
    setSearchParams(next);
  };

  return (
    <PageContainer>
      <NavBar><PageTitle title={<><TaskIcon className="size-4 text-tasks" />Jobs</>} />{data.jobGuidance && !data.showJobGuidance && <button type="button" onClick={() => data.onJobGuidanceChange(true)} className="rounded px-2 py-1 text-xs text-text-dimmed hover:bg-background-hover focus-custom">New Job…</button>}{data.testJob && <button type="button" className="rounded px-2 py-1 text-xs text-tests hover:bg-background-hover focus-custom">Test</button>}</NavBar>
      <PageBody scrollable={false} className="flex min-h-0 p-0">
        <div className="grid min-w-0 flex-1 grid-rows-[auto_1fr]">
          <div aria-label="Job filters" className="flex h-12 items-center justify-between gap-2 border-b border-grid-bright p-2">
            <SearchInput placeholder="Search Jobs…" />
            <select
              aria-label="Time range"
              className="h-8 rounded border border-grid-bright bg-background-bright px-2 text-xs text-text-bright"
              value={searchParams.get("period") ?? "all"}
              onChange={(event) => updatePeriod(event.currentTarget.value)}
            >
              {data.timeRanges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="relative min-h-0 overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
            {data.jobs.length > 0 ? <JobsTable jobs={data.jobs} /> : <EmptyState filtered={data.hasAnyJobs && data.hasFilters} />}
            {isLoading && data.jobs.length === 0 ? <LoadingState /> : null}
          </div>
        </div>
        {data.jobGuidance && data.showJobGuidance && <JobGuidancePanel onClose={() => data.onJobGuidanceChange(false)} />}
      </PageBody>
    </PageContainer>
  );
}

const JOB_EXAMPLE = `<?php

namespace App\\Jobs;

final class ProcessInvoice implements ShouldQueue
{
    public function handle(): void
    {
        // Process the invoice.
    }
}`;

function JobGuidancePanel({ onClose }: { onClose: () => void }) {
  return <aside aria-label="Job guidance" className="grid h-full w-[400px] shrink-0 grid-rows-[auto_1fr] overflow-hidden border-l border-grid-bright bg-background-bright">
    <div className="flex items-center justify-between gap-2 border-b border-grid-dimmed px-3 py-2">
      <h2 className="text-sm font-semibold text-text-bright">Create a new Job</h2>
      <button type="button" onClick={onClose} aria-label="Close Job guidance" className="rounded p-1 text-text-dimmed hover:bg-background-hover hover:text-text-bright focus-custom"><ExitIcon className="size-4" /></button>
    </div>
    <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
      <p className="mb-6 text-sm text-text-dimmed">Copy this example into your Application's <code className="rounded bg-background-dimmed px-1 py-0.5 font-mono text-xs">app/Jobs</code> directory and customize it.</p>
      <div className="mb-2 flex items-center gap-1.5"><TaskIcon className="size-4 text-tasks" /><h3 className="text-sm font-semibold text-text-bright">Queued Job</h3></div>
      <p className="mb-2 text-sm text-text-dimmed">A durable background operation handled by your configured Laravel Queue.</p>
      <CodeBlock code={JOB_EXAMPLE} language="php" showCopyButton showLineNumbers={false} />
    </div>
  </aside>;
}

function JobsTable({ jobs }: { jobs: PresentedJob[] }) {
  return (
    <table className="w-full whitespace-nowrap">
      <thead className="sticky top-0 z-10 bg-background-dimmed">
        <tr className="border-b border-grid-dimmed text-left">
          <HeaderCell>Job</HeaderCell>
          <HeaderCell>Recent status</HeaderCell>
          <HeaderCell>Activity</HeaderCell>
          <HeaderCell>Runs</HeaderCell>
          <HeaderCell>First observed</HeaderCell>
          <HeaderCell>Last observed</HeaderCell>
          <HeaderCell>Latest Run</HeaderCell>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} className="group border-b border-grid-dimmed">
            <Cell className="max-w-md">
              <Link to={job.path} className="flex min-w-0 items-center gap-2 rounded outline-hidden focus-custom">
                <TaskIcon className="size-4 shrink-0 text-tasks" />
                <span className="truncate font-medium text-text-bright group-hover:underline">{shortName(job.name)}</span>
              </Link>
              <div className="ml-6 truncate font-mono text-xs text-text-faint">{job.name}</div>
            </Cell>
            <Cell><TaskRunStatusCombo status={job.latestRun.status} /></Cell>
            <Cell><StatusActivity counts={job.statusCounts} /></Cell>
            <Cell className="font-mono tabular-nums text-text-bright">{job.runCount.toLocaleString()}</Cell>
            <Cell><DateTimeShort date={job.firstObservedAt} /></Cell>
            <Cell><DateTimeShort date={job.lastObservedAt} /></Cell>
            <Cell>
              <Link to={job.latestRun.path} className="rounded font-mono text-text-bright hover:underline focus-custom">{job.latestRun.id}</Link>
            </Cell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusActivity({ counts }: { counts: PresentedJob["statusCounts"] }) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  const peak = Math.max(1, ...entries.map(([, count]) => count));
  return (
    <div role="img" aria-label="Recorded Runs by status" className="flex h-5 w-32 items-end gap-px">
      {entries.length > 0 ? entries.map(([status, count]) => (
        <span
          key={status}
          data-status={status}
          title={`${status}: ${count}`}
          className="min-w-2 flex-1"
          style={{ backgroundColor: getRunStatusChartColor(status), height: `${Math.max(20, count / peak * 100)}%` }}
        />
      )) : <span className="h-px w-full bg-grid-bright" />}
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-sm font-normal text-text-dimmed">{children}</th>;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 text-xs group-hover:bg-background-bright ${className}`}>{children}</td>;
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid h-full min-h-64 place-items-center text-center">
      <div><h2 className="font-medium text-text-bright">{filtered ? "No matching Jobs" : "No Jobs yet"}</h2><p className="mt-1 text-sm text-text-dimmed">{filtered ? "Change or clear filters to see more Jobs." : "Job types appear after Skyline confirms their first Run."}</p></div>
    </div>
  );
}

function LoadingState() {
  return <div aria-label="Loading Jobs" className="absolute inset-0 grid place-items-center bg-background-dimmed/80"><Spinner /></div>;
}

export function JobsErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "The Jobs list could not be loaded.";
  return (
    <PageContainer><NavBar><PageTitle title="Jobs" /></NavBar><PageBody className="grid place-items-center"><div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center"><h1 className="font-medium text-text-bright">Unable to load Jobs</h1><p className="mt-1 text-sm text-text-dimmed">{message}</p></div></PageBody></PageContainer>
  );
}

function shortName(name: string) {
  return name.split("\\").at(-1) ?? name;
}
