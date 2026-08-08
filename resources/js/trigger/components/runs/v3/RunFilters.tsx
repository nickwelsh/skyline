/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/RunFilters.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server-owned filters are removed; reached controls retain source Ariakit behavior over Skyline URLs.
 */
import * as Ariakit from "@ariakit/react";
import { CalendarIcon, PlusIcon, RectangleStackIcon } from "@heroicons/react/20/solid";
import { startTransition, useRef, useState, type ReactNode } from "react";
import { TasksIcon } from "~/assets/icons/TasksIcon";
import { AppliedFilter } from "~/components/primitives/AppliedFilter";
import { SearchInput } from "~/components/primitives/SearchInput";
import {
  ComboBox,
  ComboboxProvider,
  SelectButtonItem,
  SelectItem,
  SelectList,
  SelectPopover,
  SelectProvider,
  SelectTrigger,
  shortcutFromIndex,
} from "~/components/primitives/Select";
import { ShortcutKey } from "~/components/primitives/ShortcutKey";
import { Switch } from "~/components/primitives/Switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/primitives/Tooltip";
import { useSearchParams } from "~/hooks/useSearchParam";
import { useShortcutKeys } from "~/hooks/useShortcutKeys";
import {
  descriptionForTaskRunStatus,
  runStatusTitle,
  TaskRunStatusCombo,
  type RunStatus,
} from "~/components/runs/v3/TaskRunStatus";

export type RunFilterOptions = {
  statuses: RunStatus[];
  jobTypes: string[];
  queueTargets: Array<{ connection: string; queue: string }>;
  traceIdentities: string[];
};

export function RunsFilters({ options }: { options: RunFilterOptions }) {
  const { has } = useSearchParams();
  return (
    <div role="group" aria-label="Run filters" className="flex flex-row flex-wrap items-center gap-1.5">
      <SearchInput placeholder="Search Runs" />
      <PermanentStatusFilter statuses={options.statuses} />
      <PermanentJobFilter jobs={options.jobTypes} />
      <CreatedFilter />
      {!has("job") ? <RootOnlyToggle /> : null}
      <MoreFilters options={options} />
    </div>
  );
}

function PermanentStatusFilter({ statuses: options }: { statuses: RunStatus[] }) {
  const { values, replace, del } = useSearchParams();
  const statuses = values("status").filter((status): status is RunStatus => options.includes(status as RunStatus));
  const triggerRef = useRef<HTMLButtonElement>(null);
  useShortcutKeys({ shortcut: { key: "s" }, action: (event) => {
    event.preventDefault();
    event.stopPropagation();
    triggerRef.current?.click();
  } });

  return (
    <FilterMenuProvider>
      {(search, setSearch) => (
        <SelectProvider value={statuses} setValue={(next) => {
          setSearch("");
          replace({ status: next, cursor: undefined, direction: undefined });
        }} virtualFocus>
          <Ariakit.TooltipProvider timeout={200}>
            <Ariakit.TooltipAnchor
              render={<Ariakit.Select ref={triggerRef} aria-label="Status" render={<div className="group cursor-pointer focus-custom" />} />}
            >
              {statuses.length > 0 ? (
                <AppliedFilter
                  label="Status"
                  icon={statusIcon()}
                  value={appliedSummary(statuses.map(runStatusTitle))}
                  onRemove={() => del(["status", "cursor", "direction"])}
                  variant="secondary/small"
                  className="pl-1"
                />
              ) : (
                <div className="flex h-6 items-center gap-1 rounded border border-border-bright/50 bg-secondary pl-1 pr-2 text-xs text-text-bright shadow-xs transition group-hover:bg-background-raised">
                  {statusIcon()}<span>Status</span>
                </div>
              )}
            </Ariakit.TooltipAnchor>
            <Ariakit.Tooltip className={tooltipClassName}>
              <div className="flex items-center gap-2"><span>Filter by status</span><ShortcutKey className="size-4 flex-none" shortcut={{ key: "s" }} variant="small" /></div>
            </Ariakit.Tooltip>
          </Ariakit.TooltipProvider>
          <SelectPopover className="min-w-0 max-w-[min(240px,var(--popover-available-width))]">
            <ComboBox placeholder="Filter by status..." value={search} />
            <SelectList>
              {options.filter((status) => runStatusTitle(status).toLowerCase().includes(search.toLowerCase())).map((status) => (
                <SelectItem key={status} value={status} shortcut={shortcutFromIndex(sourceStatusIndex(status), { shortcutsEnabled: true })}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="group flex w-full flex-col py-0"><TaskRunStatusCombo status={status} iconClassName="animate-none" /></TooltipTrigger>
                      <TooltipContent side="right" sideOffset={50}><span className="text-xs">{descriptionForTaskRunStatus(status)}</span></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SelectItem>
              ))}
            </SelectList>
          </SelectPopover>
        </SelectProvider>
      )}
    </FilterMenuProvider>
  );
}

function PermanentJobFilter({ jobs }: { jobs: string[] }) {
  const { value, replace, del } = useSearchParams();
  const job = value("job");
  const triggerRef = useRef<HTMLButtonElement>(null);
  useShortcutKeys({ shortcut: { key: "t" }, action: (event) => {
    event.preventDefault();
    event.stopPropagation();
    triggerRef.current?.click();
  } });

  return (
    <FilterMenuProvider>
      {(search, setSearch) => (
        <SelectProvider value={job ? [job] : []} setValue={(next) => {
          setSearch("");
          const selected = next.at(-1);
          replace({ job: selected, rootOnly: undefined, cursor: undefined, direction: undefined });
        }} virtualFocus>
          <Ariakit.TooltipProvider timeout={200}>
            <Ariakit.TooltipAnchor
              render={<Ariakit.Select ref={triggerRef} aria-label="Job type" render={<div className="group cursor-pointer focus-custom" />} />}
            >
              {job ? (
                <AppliedFilter
                  label="Job"
                  icon={<TasksIcon className="size-4" />}
                  value={job}
                  onRemove={() => del(["job", "cursor", "direction", "rootOnly"])}
                  variant="secondary/small"
                  className="pl-1"
                />
              ) : (
                <div className="flex h-6 items-center gap-1.5 rounded border border-border-bright/50 bg-secondary pl-1 pr-2 text-xs text-text-bright shadow-xs transition group-hover:bg-background-raised">
                  <TasksIcon className="size-4" /><span>Jobs</span>
                </div>
              )}
            </Ariakit.TooltipAnchor>
            <Ariakit.Tooltip className={tooltipClassName}>
              <div className="flex items-center gap-2"><span>Filter by job</span><ShortcutKey className="size-4 flex-none" shortcut={{ key: "t" }} variant="small" /></div>
            </Ariakit.Tooltip>
          </Ariakit.TooltipProvider>
          <SelectPopover className="min-w-0 max-w-[min(360px,var(--popover-available-width))]">
            <ComboBox placeholder="Filter by job..." value={search} />
            <SelectList>
              {jobs.filter((candidate) => candidate.toLowerCase().includes(search.toLowerCase())).map((candidate, index) => (
                <SelectItem key={candidate} value={candidate} shortcut={shortcutFromIndex(index, { shortcutsEnabled: true })} icon={<TasksIcon className="size-4 flex-none" />} className="text-text-bright">
                  <span className="truncate">{candidate}</span>
                </SelectItem>
              ))}
            </SelectList>
          </SelectPopover>
        </SelectProvider>
      )}
    </FilterMenuProvider>
  );
}

function CreatedFilter() {
  const { value, replace } = useSearchParams();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const period = inferPeriod(value("triggeredFrom"), value("triggeredTo"));
  useShortcutKeys({ shortcut: { key: "d" }, action: (event) => {
    event.preventDefault();
    event.stopPropagation();
    triggerRef.current?.click();
  } });
  return (
    <SelectProvider value={period.value} setValue={(next) => {
      const selected = timePeriods.find(({ value: candidate }) => candidate === next);
      if (!selected) return;
      const to = new Date();
      const from = new Date(to.getTime() - selected.milliseconds);
      replace({ triggeredFrom: from.toISOString(), triggeredTo: to.toISOString(), cursor: undefined, direction: undefined });
    }}>
      <Ariakit.TooltipProvider timeout={200}>
        <Ariakit.TooltipAnchor render={<Ariakit.Select ref={triggerRef} aria-label="Created range" render={<div className="group cursor-pointer focus-custom" />} />}>
          <AppliedFilter label="Created" icon={<CalendarIcon className="size-4" />} value={period.label} removable={false} variant="secondary/small" />
        </Ariakit.TooltipAnchor>
        <Ariakit.Tooltip className={tooltipClassName}><div className="flex items-center gap-2"><span>Filter by time period</span><ShortcutKey className="size-4 flex-none" shortcut={{ key: "d" }} variant="small" /></div></Ariakit.Tooltip>
      </Ariakit.TooltipProvider>
      <SelectPopover>
        <SelectList>
          {timePeriods.map((option, index) => <SelectItem key={option.value} value={option.value} shortcut={shortcutFromIndex(index, { shortcutsEnabled: true })}>{option.label}</SelectItem>)}
        </SelectList>
      </SelectPopover>
    </SelectProvider>
  );
}

function RootOnlyToggle() {
  const { value, replace } = useSearchParams();
  return <Ariakit.TooltipProvider timeout={200}>
    <Ariakit.TooltipAnchor render={<div />}>
      <Switch variant="secondary/small" label="Root only" checked={value("rootOnly") === "true"} shortcut={{ key: "o" }} onCheckedChange={(checked) => replace({ rootOnly: checked ? "true" : "false", cursor: undefined, direction: undefined })} />
    </Ariakit.TooltipAnchor>
    <Ariakit.Tooltip className={tooltipClassName}><div className="flex items-center gap-2"><span>Toggle root only</span><ShortcutKey className="size-4 flex-none" shortcut={{ key: "o" }} variant="small" /></div></Ariakit.Tooltip>
  </Ariakit.TooltipProvider>;
}

function MoreFilters({ options }: { options: RunFilterOptions }) {
  const { value, replace, del } = useSearchParams();
  const [filterType, setFilterType] = useState<"queue" | "trace">();
  const [open, setOpen] = useState(false);
  const trigger = <SelectTrigger aria-label="More filters" icon={<div className="flex size-4 items-center justify-center"><PlusIcon className="size-3.5" /></div>} variant="secondary/small" shortcut={{ key: "f" }} tooltipTitle="More filters" className="pl-1 pr-2">More filters</SelectTrigger>;
  const queue = queueValue(value("connection"), value("queue"));
  const trace = value("trace") ?? "";
  return (
    <>
      {queue ? <AppliedFilter label="Queue" icon={<RectangleStackIcon className="size-4" />} value={queue.replace("\u0000", " / ")} onRemove={() => del(["connection", "queue", "cursor", "direction"])} variant="secondary/small" /> : null}
      {trace ? <AppliedFilter label="Trace" value={trace} onRemove={() => del(["trace", "cursor", "direction"])} variant="secondary/small" /> : null}
      <FilterMenuProvider onClose={() => setFilterType(undefined)}>
        {(search, setSearch) => filterType === "queue" ? (
          <SelectProvider open={open} setOpen={setOpen} value={queue} setValue={(selected) => {
            const [connection, selectedQueue] = selected ? selected.split("\u0000") : [undefined, undefined];
            replace({ connection, queue: selectedQueue, cursor: undefined, direction: undefined });
            setSearch(""); setFilterType(undefined); setOpen(false);
          }} virtualFocus>
            {trigger}<SelectPopover><ComboBox placeholder="Filter by queue..." value={search} /><SelectList>{options.queueTargets.filter((target) => `${target.connection} / ${target.queue}`.toLowerCase().includes(search.toLowerCase())).map((target, index) => <SelectItem key={`${target.connection}\u0000${target.queue}`} value={`${target.connection}\u0000${target.queue}`} shortcut={shortcutFromIndex(index, { shortcutsEnabled: true })}>{target.connection} / {target.queue}</SelectItem>)}</SelectList></SelectPopover>
          </SelectProvider>
        ) : filterType === "trace" ? (
          <SelectProvider open={open} setOpen={setOpen} value={trace} setValue={(selected) => {
            replace({ trace: selected || undefined, cursor: undefined, direction: undefined });
            setSearch(""); setFilterType(undefined); setOpen(false);
          }} virtualFocus>
            {trigger}<SelectPopover><ComboBox placeholder="Filter by trace..." value={search} /><SelectList>{options.traceIdentities.filter((identity) => identity.toLowerCase().includes(search.toLowerCase())).map((identity, index) => <SelectItem key={identity} value={identity} shortcut={shortcutFromIndex(index, { shortcutsEnabled: true })}>{identity}</SelectItem>)}</SelectList></SelectPopover>
          </SelectProvider>
        ) : (
          <SelectProvider open={open} setOpen={setOpen} virtualFocus>
            {trigger}<SelectPopover><ComboBox placeholder="Filter by..." value={search} shortcut={{ key: "f" }} /><SelectList>
              <SelectButtonItem icon={<RectangleStackIcon className="size-4" />} shortcut={{ key: "1" }} onClick={() => { setSearch(""); setFilterType("queue"); setOpen(true); }}>Queues</SelectButtonItem>
              <SelectButtonItem shortcut={{ key: "2" }} onClick={() => { setSearch(""); setFilterType("trace"); setOpen(true); }}>Trace</SelectButtonItem>
            </SelectList></SelectPopover>
          </SelectProvider>
        )}
      </FilterMenuProvider>
    </>
  );
}

function FilterMenuProvider({ children, onClose }: { children: (search: string, setSearch: (value: string) => void) => ReactNode; onClose?: () => void }) {
  const [search, setSearch] = useState("");
  return <ComboboxProvider resetValueOnHide setValue={(value) => startTransition(() => setSearch(value))} setOpen={(next) => { if (!next) onClose?.(); }}>{children(search, setSearch)}</ComboboxProvider>;
}

function appliedSummary(values: string[]) { return values.join(", "); }
function statusIcon() { return <div className="grid size-4 place-items-center"><div className="size-[75%] rounded-full border-2 border-text-bright" /></div>; }
function queueValue(connection?: string, queue?: string) { return connection && queue ? `${connection}\u0000${queue}` : ""; }
function sourceStatusIndex(status: RunStatus) { return ({ queued: 2, running: 4, retrying: 5, completed: 6, failed: 7 } as const)[status]; }

const timePeriods = [
  ["1 min", "1m", 60_000], ["5 mins", "5m", 300_000], ["30 mins", "30m", 1_800_000],
  ["1 hr", "1h", 3_600_000], ["6 hrs", "6h", 21_600_000], ["12 hrs", "12h", 43_200_000],
  ["1 day", "1d", 86_400_000], ["3 days", "3d", 259_200_000], ["5 days", "5d", 432_000_000],
  ["7 days", "7d", 604_800_000], ["14 days", "14d", 1_209_600_000], ["30 days", "30d", 2_592_000_000],
].map(([label, value, milliseconds]) => ({ label: String(label), value: String(value), milliseconds: Number(milliseconds) }));

function inferPeriod(from?: string, to?: string) {
  if (!from || !to) return timePeriods[9];
  const duration = Date.parse(to) - Date.parse(from);
  return timePeriods.find(({ milliseconds }) => milliseconds === duration) ?? { label: "Custom", value: "custom", milliseconds: duration };
}

const tooltipClassName = "z-40 cursor-default rounded border border-grid-bright bg-background-bright px-2 py-1.5 text-xs";
