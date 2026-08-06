/*!
 * Derived from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam._index/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server, tenant, deployment, schedule, and source-definition concerns are external; Job guidance and test remain capability-dormant.
 */
import { ClockIcon, PlusIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { Link, useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import type { PanelHandle } from "@window-splitter/react";
import { useCallback, useRef, useState } from "react";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Button } from "~/components/primitives/Buttons";
import { DateTimeShort } from "~/components/primitives/DateTime";
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
  const [showUsefulLinks, setShowUsefulLinks] = useState(data.showJobGuidance);
  const [isPanelAnimating, setIsPanelAnimating] = useState(false);
  const animatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usefulLinksPanelRef = useRef<PanelHandle>(null);
  const isLoading = navigation.state !== "idle";
  const hasItems = data.jobs.length > 0;
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
  const updatePeriod = (period: string) => {
    const next = new URLSearchParams(searchParams);
    period === "all" ? next.delete("period") : next.set("period", period);
    next.delete("cursor");
    setSearchParams(next);
  };

  return (
    <PageContainer>
      <NavBar><PageTitle title={<><TaskIcon className="size-4 text-tasks" />Jobs</>} />{data.testJob && <button type="button" className="rounded px-2 py-1 text-xs text-tests hover:bg-background-hover focus-custom">Test</button>}</NavBar>
      <PageBody scrollable={false} className="min-h-0 p-0">
        <ResizablePanelGroup orientation="horizontal" className="max-h-full">
          <ResizablePanel id="jobs-main" min="100px" className="max-h-full">
            <div className="grid h-full min-w-0 grid-rows-[auto_1fr]">
              <div aria-label="Job filters" className="flex h-12 items-center justify-between gap-2 border-b border-grid-bright p-2">
                <SearchInput placeholder="Search Jobs…" />
                <div className="flex items-center gap-1.5">
                  {data.jobGuidance && !showUsefulLinks && hasItems && <button type="button" onClick={() => toggleUsefulLinks(true)} className="flex h-6 items-center gap-1 rounded border border-indigo-500 bg-indigo-600 px-2 text-xs text-white hover:bg-indigo-500 focus-custom"><PlusIcon className="size-3.5" />New task…</button>}
                  <select
                    aria-label="Time range"
                    className="h-8 rounded border border-grid-bright bg-background-bright px-2 text-xs text-text-bright"
                    value={searchParams.get("period") ?? "all"}
                    onChange={(event) => updatePeriod(event.currentTarget.value)}
                  >
                    {data.timeRanges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="relative min-h-0 overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-control">
                {hasItems ? <JobsTable jobs={data.jobs} isPanelAnimating={isPanelAnimating} /> : <EmptyState filtered={data.hasAnyJobs && data.hasFilters} />}
                {isLoading && !hasItems ? <LoadingState /> : null}
              </div>
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

function JobsTable({ jobs, isPanelAnimating }: { jobs: PresentedJob[]; isPanelAnimating: boolean }) {
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
            <Cell><div hidden={isPanelAnimating}><StatusActivity counts={job.statusCounts} /></div></Cell>
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
