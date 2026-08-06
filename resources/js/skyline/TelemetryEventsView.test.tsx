import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperatingSystemContextProvider } from "../trigger/components/primitives/OperatingSystemProvider";
import { ShortcutsProvider } from "../trigger/components/primitives/ShortcutsProvider";
import type { PresentedTelemetryEvent, PresentedTelemetryEventDetail } from "./TelemetryEventsAdapter";
import { TelemetryEventDetailView, TelemetryEventsTable } from "./TelemetryEventsView";

describe("Telemetry-event adapters", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("keeps upstream row semantics while adapting selection and truthful empty states", () => {
    const select = vi.fn();
    const populated = render(<MemoryRouter><TelemetryEventsTable events={[summary()]} selectedId="event_operation" onSelect={select} loading={false} hasAnyEvents hasFilters={false} /></MemoryRouter>);
    const row = populated.container.querySelector("tbody tr")!;
    const firstCellButton = row.querySelector<HTMLButtonElement>("button")!;

    expect(row.hasAttribute("aria-selected")).toBe(false);
    expect(firstCellButton.tabIndex).toBe(-1);
    flushSync(() => firstCellButton.click());
    expect(select).toHaveBeenCalledWith("event_operation");
    flushSync(() => populated.root.unmount());

    const initial = render(<TelemetryEventsTable events={[]} onSelect={select} loading={false} hasAnyEvents={false} hasFilters={false} />);
    expect(initial.container.textContent).toContain("No Telemetry events yet");
    flushSync(() => initial.root.unmount());

    const filtered = render(<TelemetryEventsTable events={[]} onSelect={select} loading={false} hasAnyEvents hasFilters />);
    expect(filtered.container.textContent).toContain("No matching Telemetry events");
    flushSync(() => filtered.root.unmount());
  });

  it("shows causal operation evidence, working links, and only proven truncation", () => {
    const close = vi.fn();
    const shown = render(<MemoryRouter><TelemetryEventDetailView event={operationDetail(true)} onClose={close} /></MemoryRouter>);

    expect(shown.container.textContent).toContain("SELECT invoices");
    expect(shown.container.textContent).toContain("trace_1");
    expect(shown.container.textContent).toContain("parent_1");
    expect(shown.container.textContent).toContain("Captured operation detail was truncated");
    expect([...shown.container.querySelectorAll<HTMLAnchorElement>("a")].map((link) => link.getAttribute("href"))).toEqual(expect.arrayContaining(["/runs/run_1", "/jobs/job_invoice", "/runs/run_1?node=span_1", "/errors/error_1"]));
    flushSync(() => shown.container.querySelector<HTMLButtonElement>('button[aria-label="Close Telemetry-event detail"]')!.click());
    expect(close).toHaveBeenCalledOnce();
    flushSync(() => shown.root.unmount());
  });

  it("feeds full captured log evidence into the exact upstream detail presenter", () => {
    const shown = render(<MemoryRouter><TelemetryEventDetailView event={logDetail()} onClose={() => {}} /></MemoryRouter>);

    expect(shown.container.textContent).toContain("Application failed");
    expect(shown.container.textContent).toContain("log.channel");
    expect(shown.container.textContent).toContain("trace_1");
    expect(shown.container.textContent).toContain("Captured log detail was truncated");
    flushSync(() => shown.root.unmount());
  });
});

function render(children: React.ReactNode) {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.querySelector<HTMLDivElement>("#root")!;
  const root = createRoot(container);
  flushSync(() => root.render(<OperatingSystemContextProvider platform="mac"><ShortcutsProvider>{children}</ShortcutsProvider></OperatingSystemContextProvider>));
  return { container, root };
}

function summary(): Extract<PresentedTelemetryEvent, { variant: "operation" }> {
  return { id: "event_operation", variant: "operation", timestamp: "2026-08-05T12:00:00Z", runId: "run_1", path: "/logs?event=event_operation", runPath: "/runs/run_1", attemptNumber: 1, attemptPath: "/runs/run_1?node=attempt_1", jobType: "App\\Jobs\\Invoice", jobPath: "/jobs/job_invoice", traceId: "trace_1", spanId: "span_1", parentSpanId: "parent_1", level: "TRACE", name: "SELECT invoices", role: "sql", kind: 3, status: "completed", durationUs: 250, operationPath: "/runs/run_1?node=span_1" };
}

function operationDetail(isTruncated: boolean): PresentedTelemetryEventDetail {
  return {
    ...summary(),
    variant: "operation",
    errorPath: "/errors/error_1",
    relationships: { traceId: "trace_1", spanId: "span_1", parentSpanId: "parent_1" },
    attributes: { "db.namespace": "testing" }, events: [{ name: "query.completed", timestamp: null, attributes: {} }], links: [{ traceId: "trace_2", spanId: "span_2", traceFlags: 1, remote: false, attributes: {} }], resource: { "service.name": "worker" }, instrumentation: { name: "nickwelsh/skyline" },
    capture: { isTruncated, truncated: isTruncated ? [{ path: "attributes.db.namespace", originalBytes: 100 }] : [] },
  };
}

function logDetail(): PresentedTelemetryEventDetail {
  return {
    id: "event_log", variant: "log", timestamp: "2026-08-05T12:00:01Z", runId: "run_1", path: "/logs?event=event_log", runPath: "/runs/run_1", attemptNumber: 1, attemptPath: "/runs/run_1?node=attempt_1", jobType: "App\\Jobs\\Invoice", jobPath: "/jobs/job_invoice", traceId: "trace_1", spanId: "span_1", parentSpanId: null, level: "ERROR", message: "Application failed", context: { status: "failed" }, channel: "stack", errorPath: null,
    relationships: { traceId: "trace_1", spanId: "span_1", parentSpanId: null }, attributes: { "log.channel": "stack", "log.level": "error", "log.message": "Application failed" }, capture: { isTruncated: true, truncated: [{ path: "message", originalBytes: 100 }] },
  };
}
