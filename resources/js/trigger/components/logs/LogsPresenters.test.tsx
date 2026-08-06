import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogDetailView, type LogDetailEntry } from "./LogDetailView";
import { LogsTable } from "./LogsTable";
import { OperatingSystemContextProvider } from "../primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../primitives/ShortcutsProvider";

describe("Logs presenters", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("keeps source table selection and distinguishes initial and filtered empty states", () => {
    const select = vi.fn();
    const { container, root } = render(<LogsTable logs={[summary()]} selectedLogId="event_operation" onLogSelect={select} loading={false} hasAnyTelemetryEvents hasFilters={false} />);

    expect(container.querySelector('tr[aria-selected="true"]')).not.toBeNull();
    flushSync(() => container.querySelector<HTMLButtonElement>("tbody button")!.click());
    expect(select).toHaveBeenCalledWith("event_operation");
    flushSync(() => root.unmount());

    const initial = render(<LogsTable logs={[]} onLogSelect={select} loading={false} hasAnyTelemetryEvents={false} hasFilters={false} />);
    expect(initial.container.textContent).toContain("No Telemetry events yet");
    flushSync(() => initial.root.unmount());

    const filtered = render(<LogsTable logs={[]} onLogSelect={select} loading={false} hasAnyTelemetryEvents hasFilters />);
    expect(filtered.container.textContent).toContain("No matching Telemetry events");
    flushSync(() => filtered.root.unmount());
  });

  it("shows causal operation evidence, working links, and only proven truncation", () => {
    const close = vi.fn();
    const { container, root } = render(<MemoryRouter><LogDetailView log={detail(true)} onClose={close} /></MemoryRouter>);

    expect(container.textContent).toContain("SELECT invoices");
    expect(container.textContent).toContain("trace_1");
    expect(container.textContent).toContain("parent_1");
    expect(container.textContent).toContain("Captured operation detail was truncated");
    expect([...container.querySelectorAll<HTMLAnchorElement>("a")].map((link) => link.getAttribute("href"))).toEqual(expect.arrayContaining(["/runs/run_1", "/jobs/job_invoice", "/runs/run_1?node=span_1", "/errors/error_1"]));
    flushSync(() => container.querySelector<HTMLButtonElement>('button[aria-label="Close Telemetry-event detail"]')!.click());
    expect(close).toHaveBeenCalledOnce();
    flushSync(() => root.unmount());

    const complete = render(<MemoryRouter><LogDetailView log={detail(false)} onClose={() => {}} /></MemoryRouter>);
    expect(complete.container.textContent).not.toContain("truncated");
    flushSync(() => complete.root.unmount());
  });
});

function render(children: React.ReactNode) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  flushSync(() => root.render(<OperatingSystemContextProvider platform="mac"><ShortcutsProvider>{children}</ShortcutsProvider></OperatingSystemContextProvider>));
  return { container, root };
}

function summary() {
  return { id: "event_operation", variant: "operation" as const, timestamp: "2026-08-05T12:00:00Z", runId: "run_1", jobType: "App\\Jobs\\Invoice", level: "TRACE" as const, name: "SELECT invoices" };
}

function detail(isTruncated: boolean): LogDetailEntry {
  return {
    ...summary(),
    runPath: "/runs/run_1",
    attemptNumber: 1,
    attemptPath: "/runs/run_1?node=attempt_1",
    jobPath: "/jobs/job_invoice",
    role: "sql",
    kind: 3,
    status: "completed",
    durationUs: 250,
    operationPath: "/runs/run_1?node=span_1",
    errorPath: "/errors/error_1",
    relationships: { traceId: "trace_1", spanId: "span_1", parentSpanId: "parent_1" },
    attributes: { "db.namespace": "testing" },
    events: [{ name: "query.completed" }],
    links: [{ traceId: "trace_2", spanId: "span_2" }],
    resource: { "service.name": "worker" },
    instrumentation: { name: "nickwelsh/skyline" },
    capture: { isTruncated, truncated: isTruncated ? [{ path: "attributes.db.namespace", originalBytes: 100 }] : [] },
  };
}
