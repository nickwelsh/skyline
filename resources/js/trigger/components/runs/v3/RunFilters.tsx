/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/RunFilters.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Inputs are narrowed to the read-only filter dimensions supplied by the host.
 */
import { CalendarDaysIcon, PlusIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { useSearchParams } from "@remix-run/react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/primitives/Popover";
import { Switch } from "~/components/primitives/Switch";
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
    <div role="group" aria-label="Run filters" className="flex flex-wrap items-center gap-1">
      <label className="flex h-6 w-44 items-center gap-1.5 rounded border border-grid-bright bg-input-bg px-1.5 focus-within:border-border-brighter">
        <SparklesIcon className="size-3.5 text-indigo-500" />
        <span className="sr-only">Search Runs</span>
        <input
          aria-label="Search Runs"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-text-bright placeholder:text-text-faint focus:ring-0"
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(event) => update("search", event.currentTarget.value)}
          placeholder="Describe your filters…"
        />
      </label>
      <FilterSelect label="Status" value={searchParams.get("status") ?? ""} onChange={(value) => update("status", value)}>
        {options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </FilterSelect>
      <FilterSelect label="Job type" value={searchParams.get("job") ?? ""} onChange={(value) => {
        const next = new URLSearchParams(searchParams);
        value ? next.set("job", value) : next.delete("job");
        if (value) next.delete("rootOnly");
        commit(next);
      }}>
        {options.jobTypes.map((job) => <option key={job} value={job}>{job}</option>)}
      </FilterSelect>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Created range" className={filterButtonClassName}>
            <CalendarDaysIcon className="size-3.5" /> Created: 7 days
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
          <button type="button" className={filterButtonClassName}><PlusIcon className="size-3.5" /> More filters</button>
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

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select aria-label={label} className="h-6 max-w-48 rounded border border-grid-bright bg-secondary px-2 text-xs capitalize text-text-bright" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      <option value="">{label === "Job type" ? "Jobs" : label}</option>
      {children}
    </select>
  );
}

const filterButtonClassName = "flex h-6 items-center gap-1 rounded border border-grid-bright bg-secondary px-2 text-xs text-text-dimmed hover:bg-background-raised hover:text-text-bright focus-custom";

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
