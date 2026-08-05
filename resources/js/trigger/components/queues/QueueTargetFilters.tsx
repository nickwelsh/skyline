/*!
 * Derived from Trigger.dev queue route SearchInput and TimeFilter composition
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Skyline adaptation: observed connection/status options and React Router URL state.
 */
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { useLocation, useNavigate } from "@remix-run/react";
import type { RunStatus } from "~/components/runs/v3/TaskRunStatus";

export type QueueTimeRangeOption = {
  value: string;
  label: string;
  durationSeconds: number | null;
};

export function QueueTargetFilters({
  connections,
  generatedAt,
  statuses,
  timeRanges,
}: {
  connections?: string[];
  generatedAt: string;
  statuses?: RunStatus[];
  timeRanges: QueueTimeRangeOption[];
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);

  const update = (values: Record<string, string | string[] | undefined>) => {
    const next = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(values)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
      else if (value) next.set(key, value);
    }
    next.delete("cursor");
    next.delete("direction");
    navigate(`${location.pathname}${next.size ? `?${next}` : ""}`);
  };

  const applySearch = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const search = String(data.get("search") ?? "").trim();
    update({ search: search || undefined });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <form
        role="search"
        className="relative min-w-52"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(event.currentTarget);
        }}
      >
        <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1.5 size-3 text-text-dimmed" />
        <input
          aria-label="Search queues"
          name="search"
          type="search"
          defaultValue={params.get("search") ?? ""}
          placeholder="Search queues…"
          className="h-6 w-full rounded border border-border-bright/50 bg-input-bg pl-7 pr-7 text-xs text-text-bright outline-hidden focus-custom"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (event.currentTarget.value) {
                event.preventDefault();
                event.currentTarget.value = "";
                update({ search: undefined });
              } else {
                event.currentTarget.blur();
              }
            }
          }}
        />
        {params.has("search") && (
          <button
            type="button"
            aria-label="Clear queue search"
            className="absolute right-1 top-1 grid size-4 place-items-center rounded text-text-dimmed hover:bg-surface-control hover:text-text-bright focus-custom"
            onClick={() => update({ search: undefined })}
          >
            <XMarkIcon className="size-3" />
          </button>
        )}
      </form>

      {connections && (
        <label className="flex items-center gap-1 text-xs text-text-dimmed">
          <span>Connection</span>
          <select
            aria-label="Connection"
            value={params.get("connection") ?? ""}
            onChange={(event) => update({ connection: event.currentTarget.value || undefined })}
            className="h-6 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom"
          >
            <option value="">All</option>
            {connections.map((connection) => <option key={connection}>{connection}</option>)}
          </select>
        </label>
      )}

      {statuses && (
        <label className="flex items-center gap-1 text-xs text-text-dimmed">
          <span>Status</span>
          <select
            multiple
            aria-label="Run status"
            value={params.getAll("status")}
            onChange={(event) => update({
              status: Array.from(event.currentTarget.selectedOptions, (option) => option.value),
            })}
            className="h-6 min-w-28 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom"
          >
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      )}

      <label className="ml-auto flex items-center gap-1 text-xs text-text-dimmed">
        <span>Time range</span>
        <select
          aria-label="Time range"
          value={timeRangeValue(params)}
          onChange={(event) => update(timeRange(event.currentTarget.value, generatedAt, timeRanges))}
          className="h-6 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom"
        >
          {timeRanges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          {params.has("from") && <option value="custom">Custom range</option>}
        </select>
      </label>
    </div>
  );
}

function timeRangeValue(params: URLSearchParams) {
  if (!params.has("from")) return "all";
  return params.get("range") ?? "custom";
}

function timeRange(value: string, generatedAt: string, options: QueueTimeRangeOption[]) {
  if (value === "all") return { from: undefined, to: undefined, range: undefined };
  if (value === "custom") return {};
  const milliseconds = (options.find((option) => option.value === value)?.durationSeconds ?? 0) * 1_000;
  if (milliseconds === 0) return {};
  const to = new Date(generatedAt);
  const from = new Date(to.getTime() - milliseconds);
  return { from: from.toISOString(), to: to.toISOString(), range: value };
}
