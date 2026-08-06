/*!
 * Adapted from Trigger.dev apps/webapp/app/routes/_app.orgs.$organizationSlug.projects.$projectParam.env.$envParam.logs/route.tsx
 * at ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0.
 * Preserves the source Logs table/detail split, filters, pagination, and selection geometry;
 * tenant context, streaming, and server fetching remain external adapter concerns.
 */
import { XMarkIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import { useLoaderData, useNavigation, useRouteError, useSearchParams } from "@remix-run/react";
import { LogsIcon } from "~/assets/icons/LogsIcon";
import { ListPagination } from "~/components/ListPagination";
import { PageBody, PageContainer } from "~/components/layout/AppLayout";
import { Button } from "~/components/primitives/Buttons";
import { Callout } from "~/components/primitives/Callout";
import { NavBar, PageTitle } from "~/components/primitives/PageHeader";
import {
  RESIZABLE_PANEL_ANIMATION,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  collapsibleHandleClassName,
} from "~/components/primitives/Resizable";
import { Spinner } from "~/components/primitives/Spinner";

export type LogsRouteData = {
  pagination: { next?: string; previous?: string };
  filters: { levels: Array<"TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR">; jobType: string | null; runId: string | null; period: string };
  filterOptions: { levels: Array<"TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR">; jobTypes: string[]; timeRanges: Array<{ value: string; label: string }> };
  capture: { enabled: boolean; supportedLevels: string[]; perAttemptLimit: number };
  hasAnyTelemetryEvents: boolean;
  hasFilters: boolean;
  selectedSummary: { variant: "operation"; name: string } | { variant: "log"; message: string } | null;
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
      <NavBar><PageTitle title={<><LogsIcon className="size-4 text-text-dimmed" />Logs</>} /></NavBar>
      <PageBody scrollable={false} className="p-0">
        <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
          <FiltersBar data={data} />
          <ResizablePanelGroup orientation="horizontal" className="max-h-full">
            <ResizablePanel id="logs-list" min="420px">
              <div className="relative h-full overflow-hidden">
                {data.renderTable({ selectedId, onSelect: setSelected, loading: navigation.state !== "idle" })}
                {navigation.state !== "idle" && <div aria-label="Loading Telemetry events" className="pointer-events-none absolute inset-0 grid place-items-center bg-background-dimmed/70"><Spinner /></div>}
              </div>
            </ResizablePanel>
            <ResizableHandle id="logs-detail-handle" className={collapsibleHandleClassName(Boolean(selectedId))} />
            {selectedId && <ResizablePanel id="logs-detail" min="430px" default="430px" max="600px" collapseAnimation={RESIZABLE_PANEL_ANIMATION} isStaticAtRest>
              {detail?.state === "found"
                ? <div className="relative h-full">{detail.data.render(() => setSelected())}{detail.refreshing && <div aria-label="Refreshing Telemetry-event detail" className="pointer-events-none absolute right-3 top-3"><Spinner /></div>}</div>
                : detail?.state === "not-found" || detail?.state === "error"
                  ? <DetailFailure state={detail.state} message={detail.message} onClose={() => setSelected()} />
                  : <DetailPreview log={data.selectedSummary} onClose={() => setSelected()} />}
            </ResizablePanel>}
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

  return <div className="border-b border-grid-bright bg-background-bright">
    <div aria-label="Telemetry-event filters" className="flex min-h-10 items-center justify-between gap-2 px-2">
      <div className="flex min-w-0 items-center gap-2">
        <fieldset aria-label="Levels" className="flex items-center gap-1">
          {data.filterOptions.levels.map((level) => <label key={level} className="flex h-6 cursor-pointer items-center gap-1 rounded border border-border-bright/50 px-1.5 font-mono text-[0.6875rem] text-text-dimmed"><input type="checkbox" checked={data.filters.levels.includes(level)} onChange={() => toggleLevel(level)} className="size-3 accent-indigo-500" />{level}</label>)}
        </fieldset>
        <select aria-label="Job type" className="h-6 max-w-48 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom" value={data.filters.jobType ?? ""} onChange={(event) => update("jobType", event.currentTarget.value)}><option value="">All Job types</option>{data.filterOptions.jobTypes.map((job) => <option key={job} value={job}>{job}</option>)}</select>
        <form onSubmit={(event) => { event.preventDefault(); update("runId", new FormData(event.currentTarget).get("runId")?.toString().trim()); }}><input key={data.filters.runId ?? ""} name="runId" aria-label="Run ID" defaultValue={data.filters.runId ?? ""} placeholder="Run ID" className="h-6 w-28 rounded border border-border-bright/50 bg-input-bg px-2 font-mono text-xs text-text-bright focus-custom" /></form>
        <select aria-label="Time range" className="h-6 rounded border border-border-bright/50 bg-input-bg px-2 text-xs text-text-bright focus-custom" value={data.filters.period} onChange={(event) => update("period", event.currentTarget.value)}>{data.filterOptions.timeRanges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        {data.hasFilters && <Button variant="minimal/small" LeadingIcon={XMarkIcon} tooltip="Clear all filters" onClick={clear}>Clear filters</Button>}
      </div>
      <ListPagination list={data} />
    </div>
    {!data.capture.enabled && <div aria-label="Application-log capture disabled"><Callout variant="warning" className="m-2">Application-log capture is disabled. Recorded operations and previously captured logs remain available.</Callout></div>}
    {data.capture.enabled && <p aria-label="Application-log capture" className="sr-only">Captures {data.capture.supportedLevels.join(", ")} with a limit of {data.capture.perAttemptLimit} logs per Attempt.</p>}
  </div>;
}

function DetailFailure({ state, message, onClose }: { state: "not-found" | "error"; message: string; onClose: () => void }) {
  return <section aria-label="Telemetry-event detail" className="grid h-full place-items-center p-6"><div role="alert" className="max-w-sm text-center"><h2 className="font-medium text-text-bright">{state === "not-found" ? "Telemetry event not found" : "Unable to load Telemetry event"}</h2><p className="mt-1 text-sm text-text-dimmed">{message}</p><Button variant="secondary/small" className="mt-3" onClick={onClose}>Close detail</Button></div></section>;
}

export function LogsErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Telemetry events could not be loaded.";
  return <PageContainer><NavBar><PageTitle title="Logs" /></NavBar><PageBody className="grid place-items-center"><div role="alert" className="max-w-md rounded border border-error/40 bg-error/10 p-6 text-center"><h1 className="font-medium text-text-bright">Unable to load Logs</h1><p className="mt-1 text-sm text-text-dimmed">{message}</p></div></PageBody></PageContainer>;
}
