/*!
 * Derived from Trigger.dev apps/webapp/app/components/runs/v3/RunFilters.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Inputs are narrowed to the read-only filter dimensions supplied by the host.
 */
import { FunnelIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { useSearchParams } from "@remix-run/react";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";

export type RunFilterOptions = {
  statuses: RunStatus[];
  jobTypes: string[];
  queueTargets: Array<{ connection: string; queue: string }>;
  traceIdentities: string[];
};

export function RunsFilters({ options }: { options: RunFilterOptions }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete("cursor");
    next.delete("direction");
    value ? next.set(key, value) : next.delete(key);
    setSearchParams(next);
  };

  return (
    <div aria-label="Run filters" className="flex min-h-12 flex-wrap items-center gap-2 border-b border-grid-bright px-3 py-2">
      <label className="flex h-8 min-w-60 items-center gap-2 rounded border border-grid-bright bg-input-bg px-2 focus-within:border-border-brighter">
        <MagnifyingGlassIcon className="size-4 text-text-faint" />
        <span className="sr-only">Search Runs</span>
        <input
          aria-label="Search Runs"
          className="w-full border-0 bg-transparent p-0 text-sm text-text-bright placeholder:text-text-faint focus:ring-0"
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(event) => update("search", event.currentTarget.value)}
          placeholder="Search Runs"
        />
      </label>
      <FunnelIcon className="size-4 text-text-faint" />
      <FilterSelect label="Status" value={searchParams.get("status") ?? ""} onChange={(value) => update("status", value)}>
        {options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </FilterSelect>
      <FilterSelect label="Job type" value={searchParams.get("job") ?? ""} onChange={(value) => update("job", value)}>
        {options.jobTypes.map((job) => <option key={job} value={job}>{job}</option>)}
      </FilterSelect>
      <FilterSelect label="Queue target" value={queueValue(searchParams)} onChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.delete("cursor");
        next.delete("direction");
        if (!value) {
          next.delete("connection");
          next.delete("queue");
        } else {
          const [connection, queue] = value.split("\u0000");
          next.set("connection", connection);
          next.set("queue", queue);
        }
        setSearchParams(next);
      }}>
        {options.queueTargets.map((target) => (
          <option key={`${target.connection}\u0000${target.queue}`} value={`${target.connection}\u0000${target.queue}`}>{target.connection} / {target.queue}</option>
        ))}
      </FilterSelect>
      <FilterSelect label="Trace" value={searchParams.get("trace") ?? ""} onChange={(value) => update("trace", value)}>
        {options.traceIdentities.map((trace) => <option key={trace} value={trace}>{trace}</option>)}
      </FilterSelect>
      <label className="flex h-8 items-center gap-2 rounded border border-grid-bright bg-background-bright px-2 text-xs text-text-bright">
        <input
          type="checkbox"
          checked={searchParams.get("rootOnly") === "true"}
          onChange={(event) => update("rootOnly", event.currentTarget.checked ? "true" : "")}
        />
        Root Runs only
      </label>
      <label className="flex items-center gap-1 text-xs text-text-dimmed">From<input aria-label="Triggered from" type="datetime-local" className="h-8 rounded border border-grid-bright bg-input-bg px-2" value={toLocal(searchParams.get("triggeredFrom"))} onChange={(event) => update("triggeredFrom", fromLocal(event.currentTarget.value))} /></label>
      <label className="flex items-center gap-1 text-xs text-text-dimmed">To<input aria-label="Triggered to" type="datetime-local" className="h-8 rounded border border-grid-bright bg-input-bg px-2" value={toLocal(searchParams.get("triggeredTo"))} onChange={(event) => update("triggeredTo", fromLocal(event.currentTarget.value))} /></label>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select aria-label={label} className="h-8 max-w-48 rounded border border-grid-bright bg-background-bright px-2 text-xs capitalize text-text-bright" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      <option value="">All {label.toLowerCase()}s</option>
      {children}
    </select>
  );
}

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
