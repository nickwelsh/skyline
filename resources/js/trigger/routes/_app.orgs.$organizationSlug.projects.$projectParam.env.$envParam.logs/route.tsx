/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.logs/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Preserves the source Logs table/detail split, filters, pagination, and selection geometry;
 * tenant context, streaming, and server fetching remain external adapter concerns.
 */
import { CalendarDaysIcon, FingerPrintIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { IconListTree } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { TasksIcon } from "~/assets/icons/TasksIcon";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Button } from "~/components/primitives/Buttons";
import { Callout } from "~/components/primitives/Callout";
import { Input } from "~/components/primitives/Input";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/primitives/Popover";
import {
  RESIZABLE_PANEL_ANIMATION,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  collapsibleHandleClassName,
} from "~/components/primitives/Resizable";
import { SearchInput } from "~/components/primitives/SearchInput";
import { Spinner } from "~/components/primitives/Spinner";

export type LogsRouteData = {
  pagination: { next?: string; previous?: string };
  filters: { search: string | null; levels: Array<"TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR">; jobType: string | null; runId: string | null; period: string };
  filterOptions: { levels: Array<"TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR">; jobTypes: string[]; timeRanges: Array<{ value: string; label: string }> };
  capture: { enabled: boolean; supportedLevels: string[]; perAttemptLimit: number };
  hasAnyTelemetryEvents: boolean;
  hasFilters: boolean;
  selectedSummary: ({ variant: "operation"; name: string } | { variant: "log"; message: string }) & { render?: (onClose: () => void) => React.ReactNode } | null;
  renderTable: (props: { selectedId?: string; onSelect: (id: string) => void; loading: boolean }) => React.ReactNode;
  loadDetail: (id: string, signal?: AbortSignal) => Promise<{ state: "found"; data: { render: (onClose: () => void) => React.ReactNode } } | { state: "not-found" | "error"; message: string }>;
};

type DetailState =
  | { id: string; state: "found"; data: { render: (onClose: () => void) => React.ReactNode }; refreshing: boolean }
  | { id: string; state: "loading" }
  | { id: string; state: "not-found" | "error"; message: string };

export default function Page() {
  const data = useLoaderData() as LogsRouteData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("event") ?? undefined;
  const [detail, setDetail] = useState<DetailState>();
  const setSelected = (id?: string) => {
    const next = new URLSearchParams(searchParams);
    id ? next.set("event", id) : next.delete("event");
    setSearchParams(next);
  };

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedId) setSelected();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedId, searchParams]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(undefined);
      return;
    }
    const controller = new AbortController();
    setDetail((current) => current?.id === selectedId && current.state === "found"
      ? { ...current, refreshing: true }
      : { id: selectedId, state: "loading" });
    data.loadDetail(selectedId, controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setDetail(value.state === "found"
          ? { id: selectedId, state: "found", data: value.data, refreshing: false }
          : { id: selectedId, state: value.state, message: value.message });
      },
      (error) => {
        if (controller.signal.aborted) return;
        setDetail({ id: selectedId, state: "error", message: error instanceof Error ? error.message : "Telemetry-event detail could not be loaded." });
      },
    );
    return () => controller.abort();
  }, [selectedId, data.loadDetail]);

  return (
    <PageContainer>
      <NavBar><PageTitle title="Logs" /></NavBar>
      <PageBody scrollable={false}>
        <div className="grid h-full max-h-full grid-rows-[2.5rem_1fr] overflow-hidden">
          <FiltersBar data={data} />
          <ResizablePanelGroup orientation="horizontal" className="max-h-full">
            <ResizablePanel id="logs-main" min="200px">
              <div className="relative h-full overflow-hidden">
                {data.renderTable({ selectedId, onSelect: setSelected, loading: navigation.state !== "idle" })}
                {navigation.state !== "idle" && <div aria-label="Loading Telemetry events" className="pointer-events-none absolute inset-0 grid place-items-center bg-background-dimmed/70"><Spinner /></div>}
              </div>
            </ResizablePanel>
            <ResizableHandle id="logs-handle" className={collapsibleHandleClassName(Boolean(selectedId))} />
            <ResizablePanel id="log-detail" min="430px" default="430px" max="600px" className="overflow-hidden" collapsible collapsed={!selectedId} onCollapseChange={() => {}} collapsedSize="0px" collapseAnimation={RESIZABLE_PANEL_ANIMATION}>
              <div className="h-full" style={{ minWidth: 430 }}>
                {selectedId && (detail?.state === "found"
                  ? <div data-testid="telemetry-event-detail" className="relative h-full">{detail.data.render(() => setSelected())}{detail.refreshing && <div aria-label="Refreshing Telemetry-event detail" className="pointer-events-none absolute right-3 top-3"><Spinner /></div>}</div>
                  : detail?.state === "not-found" || detail?.state === "error"
                    ? <DetailFailure state={detail.state} message={detail.message} onClose={() => setSelected()} />
                    : data.selectedSummary?.render
                      ? <div data-testid="telemetry-event-detail" className="relative h-full">{data.selectedSummary.render(() => setSelected())}<div aria-label="Loading Telemetry-event detail" className="pointer-events-none absolute right-3 top-3"><Spinner /></div></div>
                    : <DetailPreview log={data.selectedSummary} onClose={() => setSelected()} />)}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </PageBody>
    </PageContainer>
  );
}

function DetailPreview({ log, onClose }: { log: LogsRouteData["selectedSummary"]; onClose: () => void }) {
  const title = log ? (log.variant === "operation" ? log.name : log.message) : "Log Details";
  return <section aria-label="Telemetry-event detail" className="grid h-full grid-rows-[auto_1fr]"><div className="flex items-center justify-between border-b border-grid-dimmed py-2 pl-3 pr-2"><h2 className="truncate font-medium text-text-bright">{title}</h2><Button onClick={onClose} variant="minimal/small">Close</Button></div><div aria-label="Loading Telemetry-event detail" className="grid place-items-center"><Spinner /></div></section>;
}

function FiltersBar({ data }: { data: LogsRouteData }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    value && value !== "all" ? next.set(key, value) : next.delete(key);
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };
  const toggleLevel = (level: string) => {
    const next = new URLSearchParams(searchParams);
    const selected = next.getAll("levels");
    next.delete("levels");
    (selected.includes(level) ? selected.filter((value) => value !== level) : [...selected, level]).forEach((value) => next.append("levels", value));
    next.delete("cursor");
    next.delete("direction");
    setSearchParams(next);
  };
  const clear = () => {
    const next = new URLSearchParams();
    const event = searchParams.get("event");
    if (event) next.set("event", event);
    setSearchParams(next);
  };

  return <div className="flex items-start justify-between gap-x-2 border-b border-grid-bright p-2">
      <div aria-label="Telemetry-event filters" className="flex min-w-0 flex-row flex-wrap items-center gap-1.5">
        <SearchInput />
        <FilterMenu label={data.filters.jobType ? `Task: ${data.filters.jobType}` : "Tasks"} icon={<TasksIcon className="size-4" />}>
          {data.filterOptions.jobTypes.map((job) => <FilterOption key={job} checked={data.filters.jobType === job} onClick={() => update("jobType", data.filters.jobType === job ? undefined : job)}>{job}</FilterOption>)}
        </FilterMenu>
        <RunIdFilter value={data.filters.runId} onApply={(value) => update("runId", value)} />
        <FilterMenu label={`Created: ${periodLabel(data.filters.period)}`} icon={<CalendarDaysIcon className="size-4" />}>
          {data.filterOptions.timeRanges.map((option) => <FilterOption key={option.value} checked={data.filters.period === option.value} onClick={() => update("period", option.value)}>{option.label}</FilterOption>)}
        </FilterMenu>
        <FilterMenu label={data.filters.levels.length > 0 ? `Level: ${data.filters.levels.join(", ")}` : "Level"} icon={<IconListTree className="size-4" />}>
          {data.filterOptions.levels.map((level) => <FilterOption key={level} checked={data.filters.levels.includes(level)} onClick={() => toggleLevel(level)}>{level}</FilterOption>)}
        </FilterMenu>
        {data.hasFilters && <Button variant="minimal/small" LeadingIcon={XMarkIcon} tooltip="Clear all filters" onClick={clear}>Clear filters</Button>}
      </div>
      <ListPagination list={data} />
    {!data.capture.enabled && <div aria-label="Application-log capture disabled" className="absolute mt-8"><Callout variant="warning" className="m-2">Application-log capture is disabled. Recorded operations and previously captured logs remain available.</Callout></div>}
    {data.capture.enabled && <p aria-label="Application-log capture" className="sr-only">Captures {data.capture.supportedLevels.join(", ")} with a limit of {data.capture.perAttemptLimit} logs per Attempt.</p>}
  </div>;
}

function FilterMenu({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Popover><PopoverTrigger asChild><button type="button" className={filterButtonClassName}>{icon}<span className="ml-1 max-w-52 truncate">{label}</span></button></PopoverTrigger><PopoverContent align="start" className="max-h-80 min-w-48 overflow-y-auto p-1">{children}</PopoverContent></Popover>;
}

function FilterOption({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="menuitemcheckbox" aria-checked={checked} onClick={onClick} className="flex min-h-8 w-full items-center justify-between gap-3 rounded px-2 text-left text-xs text-text-dimmed hover:bg-background-hover hover:text-text-bright"><span>{children}</span><span aria-hidden>{checked ? "✓" : ""}</span></button>;
}

function RunIdFilter({ value, onApply }: { value: string | null; onApply: (value?: string) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  useEffect(() => setDraft(value ?? ""), [value]);
  const apply = () => { onApply(draft.trim() || undefined); setOpen(false); };
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className={filterButtonClassName}><FingerPrintIcon className="size-4" /><span className="ml-1 max-w-40 truncate">{value ? `Run ID: ${value}` : "Run ID"}</span></button></PopoverTrigger><PopoverContent align="start" className="w-80 p-3"><form onSubmit={(event) => { event.preventDefault(); apply(); }} className="flex flex-col gap-3"><label className="text-sm text-text-bright">Run ID<Input aria-label="Run ID value" placeholder="run_" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} variant="small" className="mt-1 font-mono" /></label><div className="flex justify-end gap-1 border-t border-grid-dimmed pt-3"><Button type="button" variant="minimal/small" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="secondary/small" disabled={!draft.trim()}>Apply</Button></div></form></PopoverContent></Popover>;
}

const filterButtonClassName = "group flex h-6 items-center gap-1 rounded border border-border-bright/50 bg-secondary px-2 text-xs text-text-bright shadow-xs transition hover:bg-background-raised focus-custom";

function periodLabel(period: string) {
  return ({ "1h": "1hr", "24h": "24hrs", "7d": "7 days", "30d": "30 days", all: "All time" } as Record<string, string>)[period] ?? period;
}

function DetailFailure({ state, message, onClose }: { state: "not-found" | "error"; message: string; onClose: () => void }) {
  return <section aria-label="Telemetry-event detail" className="grid h-full place-items-center p-6"><div role="alert" className="max-w-sm text-center"><h2 className="font-medium text-text-bright">{state === "not-found" ? "Telemetry event not found" : "Unable to load Telemetry event"}</h2><p className="mt-1 text-sm text-text-dimmed">{message}</p><Button variant="secondary/small" className="mt-3" onClick={onClose}>Close detail</Button></div></section>;
}

export function LogsErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Telemetry events could not be loaded.";
  return <PageContainer><NavBar><PageTitle title="Logs" /></NavBar><PageBody className="grid place-items-center"><div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center"><h1 className="font-medium text-text-bright">Unable to load Logs</h1><p className="mt-1 text-sm text-text-dimmed">{message}</p></div></PageBody></PageContainer>;
}
