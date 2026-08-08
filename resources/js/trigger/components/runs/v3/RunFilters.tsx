/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/RunFilters.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Inputs are narrowed to the read-only filter dimensions supplied by the host.
 */
import { CalendarIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useSearchParams } from "@remix-run/react";
import { AppliedFilter } from "~/components/primitives/AppliedFilter";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/primitives/Popover";
import { SearchInput } from "~/components/primitives/SearchInput";
import { Switch } from "~/components/primitives/Switch";
import { TasksIcon } from "~/assets/icons/TasksIcon";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";

export type RunFilterOptions = {
  statuses: RunStatus[];
  jobTypes: string[];
  queueTargets: Array<{ connection: string; queue: string }>;
  traceIdentities: string[];
};

export function RunsFilters({ options }: { options: RunFilterOptions }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const commit = (next: URLSearchParams) => {
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    commit(next);
  };

  return (
    <div role="group" aria-label="Run filters" className="flex flex-row flex-wrap items-center gap-1.5">
      <SearchInput placeholder="Search Runs" />
      <SourceSelect label="Status">
        <div className="grid size-4 place-items-center"><div className="size-[75%] rounded-full border-2 border-text-bright" /></div>
        <span>Status</span>
        <select aria-label="Status" className="absolute inset-0 cursor-pointer opacity-0" value={searchParams.get("status") ?? ""} onChange={(event) => update("status", event.currentTarget.value)}>
          <option value="">Status</option>
          {options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </SourceSelect>
      <SourceSelect label="Job type" gap="gap-1.5">
        <TasksIcon className="size-4" />
        <span>Jobs</span>
        <select aria-label="Job type" className="absolute inset-0 cursor-pointer opacity-0" value={searchParams.get("job") ?? ""} onChange={(event) => {
          const next = new URLSearchParams(searchParams);
          event.currentTarget.value ? next.set("job", event.currentTarget.value) : next.delete("job");
          if (event.currentTarget.value) next.delete("rootOnly");
          commit(next);
        }}>
          <option value="">Jobs</option>
          {options.jobTypes.map((job) => <option key={job} value={job}>{job}</option>)}
        </select>
      </SourceSelect>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Created range" className="group cursor-pointer focus-custom">
            <AppliedFilter label="Created" icon={<CalendarIcon className="size-4" />} value="7 days" removable={false} variant="secondary/small" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex gap-2 p-2">
          <label className="flex items-center gap-1 text-xs text-text-dimmed">From<input aria-label="Triggered from" type="datetime-local" className="h-8 rounded border border-grid-bright bg-input-bg px-2" value={toLocal(searchParams.get("triggeredFrom"))} onChange={(event) => update("triggeredFrom", fromLocal(event.currentTarget.value))} /></label>
          <label className="flex items-center gap-1 text-xs text-text-dimmed">To<input aria-label="Triggered to" type="datetime-local" className="h-8 rounded border border-grid-bright bg-input-bg px-2" value={toLocal(searchParams.get("triggeredTo"))} onChange={(event) => update("triggeredTo", fromLocal(event.currentTarget.value))} /></label>
        </PopoverContent>
      </Popover>
      {!searchParams.has("job") && (
        <Switch
          variant="secondary/small"
          label="Root only"
          checked={searchParams.get("rootOnly") === "true"}
          onCheckedChange={(checked) => update("rootOnly", checked ? "true" : "false")}
        />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={filterButtonClassName}>
            <div className="flex min-w-0 grow items-center gap-0.5 overflow-hidden">
              <div className="flex-none"><div className="flex size-4 items-center justify-center"><PlusIcon className="size-3.5" /></div></div>
              <div className="min-w-0 truncate">More filters</div>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="grid min-w-72 gap-2 p-2">
          <FilterSelect label="Queue target" value={queueValue(searchParams)} onChange={(value) => {
            const next = new URLSearchParams(searchParams);
            if (!value) {
              next.delete("connection");
              next.delete("queue");
            } else {
              const [connection, queue] = value.split("\u0000");
              next.set("connection", connection);
              next.set("queue", queue);
            }
            commit(next);
          }}>
            {options.queueTargets.map((target) => (
              <option key={`${target.connection}\u0000${target.queue}`} value={`${target.connection}\u0000${target.queue}`}>{target.connection} / {target.queue}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Trace" value={searchParams.get("trace") ?? ""} onChange={(value) => update("trace", value)}>
            {options.traceIdentities.map((trace) => <option key={trace} value={trace}>{trace}</option>)}
          </FilterSelect>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SourceSelect({ children, gap = "gap-1" }: { label: string; children: React.ReactNode; gap?: "gap-1" | "gap-1.5" }) {
  return (
    <label className={`group relative flex h-6 cursor-pointer items-center ${gap} rounded border border-border-bright/50 bg-secondary pl-1 pr-2 text-xs text-text-bright shadow-xs transition hover:bg-background-raised`}>
      {children}
    </label>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select aria-label={label} className="h-8 rounded border border-grid-bright bg-input-bg px-2 text-xs text-text-bright" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      <option value="">{label}</option>
      {children}
    </select>
  );
}

const filterButtonClassName = "group flex h-6 items-center gap-1 rounded border border-border-bright/50 bg-secondary px-2 pl-1 pr-2 text-xs text-text-bright shadow-xs hover:bg-background-raised focus-custom";

function queueValue(params: URLSearchParams) {
  const connection = params.get("connection");
  const queue = params.get("queue");
  return connection && queue ? `${connection}\u0000${queue}` : "";
}

function fromLocal(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function toLocal(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
