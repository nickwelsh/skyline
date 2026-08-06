import { describe, expect, it } from "vitest";
import { fixtureCapabilities } from "./FixtureAdapter";
import { presentTelemetryEventDetail, presentTelemetryEvents, telemetryEventsQuery } from "./TelemetryEventsAdapter";
import type { TelemetryEventDetailDto, TelemetryEventsPageDto } from "./dto";

describe("TelemetryEventsAdapter", () => {
  it("maps URL-backed filters and external list links into presenter data", () => {
    expect(telemetryEventsQuery(new Request("https://example.test/skyline/logs"))).toEqual({});
    expect(telemetryEventsQuery(new Request("https://example.test/skyline/logs?search=invoice&levels=ERROR&levels=WARN&jobType=App%5CJobs%5CInvoice&runId=run_1&period=7d&cursor=opaque"))).toEqual({
      search: "invoice",
      levels: ["ERROR", "WARN"],
      jobType: "App\\Jobs\\Invoice",
      runId: "run_1",
      period: "7d",
      cursor: "opaque",
    });

    const presented = presentTelemetryEvents(pageFixture());
    expect(presented.telemetryEvents[0]).toMatchObject({
      variant: "operation",
      path: "/logs?event=event_operation",
      runPath: "/runs/run_1",
      attemptPath: "/runs/run_1?node=attempt_run_1_1",
      jobPath: "/jobs/job_invoice",
      operationPath: "/runs/run_1?node=span_span_1",
    });
    expect(presented.hasFilters).toBe(true);
    expect(presented.pagination).toEqual({ next: "next" });
  });

  it("preserves the discriminated detail contract and working causal paths", () => {
    const page = pageFixture();
    const operation = page.telemetryEvents[0];
    if (operation.variant !== "operation") throw new Error("Expected operation fixture");
    const detail: TelemetryEventDetailDto = {
      ...page,
      telemetryEvent: {
        ...operation,
        relationships: { traceId: "trace_1", spanId: "span_1", parentSpanId: "parent_1" },
        attributes: { "db.namespace": "testing" },
        events: [{ name: "query.completed", timestamp: "2026-08-05T12:00:00.001000000Z", attributes: {} }],
        links: [{ traceId: "trace_2", spanId: "span_2", traceFlags: 1, remote: true, attributes: {} }],
        resource: { "service.name": "worker" },
        instrumentation: { name: "nickwelsh/skyline", version: null },
        capture: { isTruncated: true, truncated: [{ path: "metadata.attributes.db.namespace", originalBytes: 100 }] },
        errorHref: "/skyline/errors/error_1",
      },
    };

    expect(presentTelemetryEventDetail(detail).telemetryEvent).toMatchObject({
      variant: "operation",
      errorPath: "/errors/error_1",
      operationPath: "/runs/run_1?node=span_span_1",
      capture: { isTruncated: true },
    });
  });
});

function pageFixture(): TelemetryEventsPageDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:01.000000000Z",
    capabilities: fixtureCapabilities,
    telemetryEvents: [{
      id: "event_operation",
      href: "/skyline/logs?event=event_operation",
      variant: "operation",
      runId: "run_1",
      runHref: "/skyline/runs/run_1",
      attemptNumber: 1,
      attemptHref: "/skyline/runs/run_1?node=attempt_run_1_1",
      jobType: "App\\Jobs\\Invoice",
      jobHref: "/skyline/jobs/job_invoice",
      timestamp: "2026-08-05T12:00:00.000000000Z",
      traceId: "trace_1",
      spanId: "span_1",
      parentSpanId: "parent_1",
      level: "TRACE",
      name: "SELECT invoices",
      role: "sql",
      kind: 3,
      status: "completed",
      durationUs: 250,
      operationHref: "/skyline/runs/run_1?node=span_span_1",
    }],
    pagination: { previous: null, next: "next" },
    filters: { search: null, levels: ["ERROR"], jobType: "App\\Jobs\\Invoice", runId: null, period: "7d" },
    options: {
      levels: ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"],
      jobTypes: ["App\\Jobs\\Invoice"],
      timeRanges: [{ value: "7d", label: "Last 7 days" }],
    },
    capture: { enabled: true, supportedLevels: ["warning", "error"], perAttemptLimit: 100 },
    hasAnyTelemetryEvents: true,
  };
}
