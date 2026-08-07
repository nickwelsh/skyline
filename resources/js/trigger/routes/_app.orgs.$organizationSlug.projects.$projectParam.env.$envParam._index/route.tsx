/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, deployment, schedule, and source-definition concerns are external; Job guidance and test remain capability-dormant.
 */
import { ClockIcon, PlusIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { Link, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import type { PanelHandle } from "@window-splitter/react";
import { useCallback, useRef, useState } from "react";
import { Bar } from "recharts";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { ActivityBarChart } from "~/components/metrics/ActivityBarChart";
import { Button } from "~/components/primitives/Buttons";
import { Header2 } from "~/components/primitives/Headers";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Paragraph } from "~/components/primitives/Paragraph";
import {
  RESIZABLE_PANEL_ANIMATION,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  collapsibleHandleClassName,
} from "~/components/primitives/Resizable";
import { SearchInput } from "~/components/primitives/SearchInput";
import { Spinner } from "~/components/primitives/Spinner";
import { allTaskRunStatuses, getRunStatusChartColor } from "~/components/runs/v3/TaskRunStatus";
import {
  Table,
  TableBlankRow,
  TableBody,
  TableCell,
  TableCellMenu,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "~/components/primitives/Table";
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
  activity: Array<{ timestamp: string; total: number; statusCounts: Record<RunStatus, number> }>;
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
  const [showUsefulLinks, setShowUsefulLinks] = useState(data.showJobGuidance);
  const [isPanelAnimating, setIsPanelAnimating] = useState(false);
  const animatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usefulLinksPanelRef = useRef<PanelHandle>(null);
  const isLoading = navigation.state !== "idle";
  const hasItems = data.jobs.length > 0;
  const pageSize = 25;
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(data.jobs.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const jobs = data.jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const toggleUsefulLinks = useCallback((show: boolean) => {
    setShowUsefulLinks(show);
    setIsPanelAnimating(true);
    if (animatingTimerRef.current) clearTimeout(animatingTimerRef.current);
    animatingTimerRef.current = setTimeout(() => setIsPanelAnimating(false), 350);
    if (show) {
      usefulLinksPanelRef.current?.expand();
    } else {
      usefulLinksPanelRef.current?.collapse();
    }
    data.onJobGuidanceChange(show);
  }, [data]);
  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    page <= 1 ? next.delete("page") : next.set("page", String(page));
    setSearchParams(next);
  };

  return (
    <PageContainer>
      <NavBar><PageTitle title="Tasks" accessory="What is a task?" /></NavBar>
      <PageBody scrollable={false}>
        <ResizablePanelGroup orientation="horizontal" className="max-h-full">
          <ResizablePanel id="jobs-main" min="100px" className="max-h-full">
            <div className="grid h-full min-w-0 grid-rows-1">
              {hasItems ? <div className="flex min-w-0 max-w-full flex-col overflow-hidden">
              <div aria-label="Task filters" className="flex shrink-0 items-center justify-between gap-1.5 p-2">
                <div data-skyline-protected="jobs-list-search" className="relative flex flex-1 items-center gap-1.5">
                  <SearchInput placeholder="Search tasks…" resetParams={["page"]} />
                  <span aria-hidden="true" data-skyline-capability-boundary="jobs-list-task-type-filter" className="pointer-events-none absolute inset-y-0 left-0 w-1" />
                </div>
                <div className="flex items-center gap-1.5">
                  {(!data.jobGuidance || !showUsefulLinks) && <Button variant="primary/small" LeadingIcon={PlusIcon} leadingIconClassName="mr-[-0.7rem]" onClick={() => toggleUsefulLinks(true)} className="pl-1.5">New task…</Button>}
                  <div data-skyline-protected="jobs-list-pagination"><TaskPagination currentPage={currentPage} totalPages={totalPages} onPage={setPage} /></div>
                </div>
              </div>
              <JobsTable jobs={jobs} isPanelAnimating={isPanelAnimating} isLoading={isLoading} />
              </div> : <EmptyState filtered={data.hasAnyJobs && data.hasFilters} />}
              {isLoading && !hasItems ? <LoadingState /> : null}
            </div>
          </ResizablePanel>
          {data.jobGuidance && <>
            <ResizableHandle
              id="jobs-handle"
              aria-label="Resize Job guidance"
              className={collapsibleHandleClassName(hasItems && showUsefulLinks)}
            />
            <ResizablePanel
              id="jobs-inspector"
              handle={usefulLinksPanelRef}
              default="400px"
              min="400px"
              max="500px"
              className="overflow-hidden"
              collapsible
              collapsed={!hasItems || !showUsefulLinks}
              onCollapseChange={() => {}}
              collapsedSize="0px"
              collapseAnimation={RESIZABLE_PANEL_ANIMATION}
            >
              <div className="h-full" style={{ minWidth: 400 }}>
                {hasItems && <NewTaskPromptsPanel onClose={() => toggleUsefulLinks(false)} />}
              </div>
            </ResizablePanel>
          </>}
        </ResizablePanelGroup>
      </PageBody>
    </PageContainer>
  );
}

const CHAT_AGENT_CODE = `import { chat } from "@trigger.dev/sdk/ai";
import { streamText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const myChat = chat.agent({
  id: "my-chat",
  run: async ({ messages, signal }) => {
    return streamText({
      ...chat.toStreamTextOptions(),
      model: anthropic("claude-sonnet-4-5"),
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(15),
    });
  },
});`;

const STANDARD_TASK_CODE = `import { task } from "@trigger.dev/sdk";

export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { message: string }) => {
    console.log(payload.message);
  },
});`;

const SCHEDULED_TASK_CODE = `import { schedules } from "@trigger.dev/sdk";

export const firstScheduledTask = schedules.task({
  id: "first-scheduled-task",
  run: async (payload) => {
    console.log(payload.timestamp);
    console.log(payload.lastTimestamp);
  },
});`;

function NewTaskPromptsPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside aria-label="Job guidance" className="grid h-full max-h-full grid-rows-[auto_1fr] overflow-hidden bg-background-bright">
      <div className="flex items-center justify-between gap-2 border-b border-grid-dimmed px-3 py-2">
        <Header2>Create a new task</Header2>
        <Button
          onClick={onClose}
          aria-label="Close Job guidance"
          variant="minimal/small"
          TrailingIcon={ExitIcon}
          shortcut={{ key: "esc" }}
          shortcutPosition="before-trailing-icon"
          className="pl-1"
        />
      </div>
      <div className="overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
        <Paragraph variant="small/bright" className="mb-6">
          Copy any example below into your project's{" "}
          <code className="rounded bg-background-dimmed px-1 py-0.5 font-mono text-xs">trigger/</code>{" "}
          directory and customize it from there.
        </Paragraph>
        <PromptCard
          icon={<SparklesIcon className="size-4.5 shrink-0 text-agents" />}
          title="Chat agent"
          description="An AI agent you can chat with from your app. Streams responses, calls tools and keeps context across messages."
          code={CHAT_AGENT_CODE}
        />
        <PromptCard
          icon={<TaskIcon className="size-4.5 shrink-0 text-tasks" />}
          title="Standard task"
          description="A durable background function you can trigger from your code. Runs as long as it needs without timing out."
          code={STANDARD_TASK_CODE}
        />
        <PromptCard
          icon={<ClockIcon className="size-4.5 shrink-0 text-schedules" />}
          title="Scheduled task"
          description="A task that runs automatically on a recurring cron schedule: daily, weekly, or any interval you define."
          code={SCHEDULED_TASK_CODE}
        />
      </div>
    </aside>
  );
}

function PromptCard({ icon, title, description, code }: { icon: React.ReactNode; title: string; description: string; code: string }) {
  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center gap-1.5">{icon}<Header2>{title}</Header2></div>
      <Paragraph variant="small" className="mb-2 text-text-dimmed">{description}</Paragraph>
      <CodeBlock code={code} language="typescript" showCopyButton showLineNumbers={false} />
    </div>
  );
}

function JobsTable({ jobs, isPanelAnimating, isLoading }: { jobs: PresentedJob[]; isPanelAnimating: boolean; isLoading: boolean }) {
  return (
    <Table containerClassName="min-h-0 flex-1" showTopBorder>
      <TableHeader><TableRow>
        <TableHeaderCell capabilityBoundary="jobs-list-type-header">ID</TableHeaderCell>
        <TableHeaderCell capabilityBoundary="jobs-list-file-header">Running</TableHeaderCell>
        <TableHeaderCell>Activity (24h)</TableHeaderCell>
        <TableHeaderCell hiddenLabel>Go to page</TableHeaderCell>
      </TableRow></TableHeader>
      <TableBody>
        {jobs.length ? jobs.map((job, index) => <TaskRow key={job.id} job={job} row={index + 1} isPanelAnimating={isPanelAnimating} />) :
          <TableBlankRow colSpan={4}><Paragraph variant="small">No tasks match your filters</Paragraph></TableBlankRow>}
      </TableBody>
      {isLoading ? <caption className="sr-only">Loading Tasks</caption> : null}
    </Table>
  );
}

function TaskRow({ job, row, isPanelAnimating }: { job: PresentedJob; row: number; isPanelAnimating: boolean }) {
  return <TableRow className="group">
    <TableCell to={job.path} isTabbableCell capabilityBoundary={`jobs-list-type-row-${row}`}><div className="flex items-center gap-2"><TaskIcon className="size-4 shrink-0 text-tasks" /><span>{job.name}</span></div></TableCell>
    <TableCell to={job.path} capabilityBoundary={`jobs-list-file-row-${row}`}>{job.statusCounts.running ?? 0}</TableCell>
    <TableCell to={job.path} actionClassName="py-1.5"><div style={{ width: 146, height: 24 }}><div hidden={isPanelAnimating}><StatusActivity activity={job.activity} /></div></div></TableCell>
    <TableCellMenu isSticky popoverContent={<Link to={`/runs?job=${encodeURIComponent(job.name)}`} className="block rounded px-2 py-1.5 text-xs text-text-dimmed hover:bg-background-raised hover:text-text-bright">View runs</Link>} />
  </TableRow>;
}

function StatusActivity({ activity }: { activity: PresentedJob["activity"] }) {
  const data = activity.map((point) => ({ timestamp: point.timestamp, total: point.total, ...point.statusCounts }));
  const peak = Math.max(0, ...activity.map((point) => point.total));

  return (
    <ActivityBarChart
      data={data}
      max={peak}
      tooltip={<span />}
      peak={peak.toLocaleString()}
      peakTooltip="Peak runs in a single hour"
    >
      {allTaskRunStatuses.map((status) => (
        <Bar key={status} data-status={status} dataKey={status} stackId="status" fill={getRunStatusChartColor(status)} strokeWidth={0} isAnimationActive={false} />
      ))}
    </ActivityBarChart>
  );
}

function TaskPagination({ currentPage, totalPages, onPage }: { currentPage: number; totalPages: number; onPage: (page: number) => void }) {
  return <div className="flex h-6 items-center overflow-hidden rounded border border-grid-bright bg-background-bright text-xs">
    <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)} className="h-full border-r border-grid-bright px-2 text-text-dimmed disabled:opacity-30">‹</button>
    <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => onPage(currentPage + 1)} className="h-full px-2 text-text-dimmed disabled:opacity-30">›</button>
  </div>;
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
