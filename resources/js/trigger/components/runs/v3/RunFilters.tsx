/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/RunFilters.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Server-owned filters are removed; reached controls retain source Ariakit behavior over Skyline URLs.
 */
import * as Ariakit from "@ariakit/react";
import { CalendarIcon, PlusIcon } from "@heroicons/react/20/solid";
import { startTransition, useRef, useState, type ReactNode } from "react";
import { TasksIcon } from "~/assets/icons/TasksIcon";
import { AppliedFilter } from "~/components/primitives/AppliedFilter";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/primitives/Popover";
import { SearchInput } from "~/components/primitives/SearchInput";
import {
  ComboBox,
  ComboboxProvider,
  SelectItem,
  SelectList,
  SelectPopover,
  SelectProvider,
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
                <SelectItem key={status} value={status}>
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
              {jobs.filter((candidate) => candidate.toLowerCase().includes(search.toLowerCase())).map((candidate) => (
                <SelectItem key={candidate} value={candidate} icon={<TasksIcon className="size-4 flex-none" />} className="text-text-bright">
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
  const custom = value("triggeredFrom") || value("triggeredTo");
  useShortcutKeys({ shortcut: { key: "d" }, action: (event) => {
    event.preventDefault();
    event.stopPropagation();
    triggerRef.current?.click();
  } });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button ref={triggerRef} type="button" aria-label="Created range" className="group cursor-pointer focus-custom">
          <AppliedFilter label="Created" icon={<CalendarIcon className="size-4" />} value={custom ? "Custom" : "7 days"} removable={false} variant="secondary/small" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex gap-2 p-2">
        <label className="flex items-center gap-1 text-xs text-text-dimmed">From<input aria-label="Triggered from" type="datetime-local" className="h-8 rounded border border-grid-bright bg-input-bg px-2" value={toLocal(value("triggeredFrom"))} onChange={(event) => replace({ triggeredFrom: fromLocal(event.currentTarget.value), cursor: undefined, direction: undefined })} /></label>
        <label className="flex items-center gap-1 text-xs text-text-dimmed">To<input aria-label="Triggered to" type="datetime-local" className="h-8 rounded border border-grid-bright bg-input-bg px-2" value={toLocal(value("triggeredTo"))} onChange={(event) => replace({ triggeredTo: fromLocal(event.currentTarget.value), cursor: undefined, direction: undefined })} /></label>
      </PopoverContent>
    </Popover>
  );
}

function RootOnlyToggle() {
  const { value, replace } = useSearchParams();
  return <Switch variant="secondary/small" label="Root only" checked={value("rootOnly") === "true"} shortcut={{ key: "o" }} onCheckedChange={(checked) => replace({ rootOnly: checked ? "true" : "false", cursor: undefined, direction: undefined })} />;
}

function MoreFilters({ options }: { options: RunFilterOptions }) {
  const { value, replace } = useSearchParams();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="More filters" className={filterButtonClassName}>
          <div className="flex min-w-0 grow items-center gap-0.5 overflow-hidden">
            <div className="flex-none"><div className="flex size-4 items-center justify-center"><PlusIcon className="size-3.5" /></div></div>
            <div className="min-w-0 truncate">More filters</div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid min-w-72 gap-2 p-2">
        <FilterSelect label="Queue target" value={queueValue(value("connection"), value("queue"))} onChange={(selected) => {
          const [connection, queue] = selected ? selected.split("\u0000") : [undefined, undefined];
          replace({ connection, queue, cursor: undefined, direction: undefined });
        }}>
          {options.queueTargets.map((target) => <option key={`${target.connection}\u0000${target.queue}`} value={`${target.connection}\u0000${target.queue}`}>{target.connection} / {target.queue}</option>)}
        </FilterSelect>
        <FilterSelect label="Trace" value={value("trace") ?? ""} onChange={(trace) => replace({ trace: trace || undefined, cursor: undefined, direction: undefined })}>
          {options.traceIdentities.map((trace) => <option key={trace} value={trace}>{trace}</option>)}
        </FilterSelect>
      </PopoverContent>
    </Popover>
  );
}

function FilterMenuProvider({ children }: { children: (search: string, setSearch: (value: string) => void) => ReactNode }) {
  const [search, setSearch] = useState("");
  return <ComboboxProvider resetValueOnHide setValue={(value) => startTransition(() => setSearch(value))}>{children(search, setSearch)}</ComboboxProvider>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <select aria-label={label} className="h-8 rounded border border-grid-bright bg-input-bg px-2 text-xs text-text-bright" value={value} onChange={(event) => onChange(event.currentTarget.value)}><option value="">{label}</option>{children}</select>;
}

function appliedSummary(values: string[]) { return values.join(", "); }
function statusIcon() { return <div className="grid size-4 place-items-center"><div className="size-[75%] rounded-full border-2 border-text-bright" /></div>; }
function queueValue(connection?: string, queue?: string) { return connection && queue ? `${connection}\u0000${queue}` : ""; }
function fromLocal(value: string) { return value ? new Date(value).toISOString() : undefined; }
function toLocal(value?: string) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }

const tooltipClassName = "z-40 cursor-default rounded border border-grid-bright bg-background-bright px-2 py-1.5 text-xs";
const filterButtonClassName = "group flex h-6 items-center gap-1 rounded border border-border-bright/50 bg-secondary px-2 pl-1 pr-2 text-xs text-text-bright shadow-xs hover:bg-background-raised focus-custom";
