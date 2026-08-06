import { describe, expect, it } from "vitest";
import { errorGroupsQuery, errorOccurrencesQuery, presentErrorGroupDetail, presentErrorGroups } from "./ErrorGroupsAdapter";
import type { ErrorGroupDetailDto, ErrorGroupsPageDto } from "./dto";

const summary = {
  id: "error_abc",
  fingerprint: "abc",
  href: "/skyline/errors/error_abc",
  jobType: "App\\Jobs\\Invoice",
  jobId: "job_invoice",
  jobHref: "/skyline/jobs/job_invoice",
  exceptionClass: "RuntimeException",
  representativeMessage: "Invoice 42 failed",
  firstObservedAt: "2026-08-04T10:00:00.000000000Z",
  lastObservedAt: "2026-08-04T12:00:00.000000000Z",
  occurrenceCount: 2,
  activity: [{ timestamp: "2026-08-04T00:00:00Z", occurrences: 2 }],
  latest: {
    runId: "run_latest",
    attemptNumber: 2,
    observedAt: "2026-08-04T12:00:00.000000000Z",
    runHref: "/skyline/runs/run_latest",
    attemptHref: "/skyline/runs/run_latest?node=attempt_run_latest_2",
  },
};

describe("ErrorGroupsAdapter", () => {
  it("maps URL filters and stable API links into external Errors route data", () => {
    const query = errorGroupsQuery(new Request("https://example.test/skyline/errors?search=invoice&jobType=App%5CJobs%5CInvoice&exceptionClass=RuntimeException&period=7d&cursor=next"));
    const presented = presentErrorGroups({
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T12:01:00.000000000Z",
      capabilities: {} as ErrorGroupsPageDto["capabilities"],
      errorGroups: [summary],
      pagination: { next: "next", previous: null },
      filters: { search: "invoice", jobType: "App\\Jobs\\Invoice", exceptionClass: "RuntimeException", period: "7d" },
      options: { jobTypes: ["App\\Jobs\\Invoice"], exceptionClasses: ["RuntimeException"], timeRanges: [{ value: "7d", label: "Last 7 days" }] },
      hasAnyErrorGroups: true,
    });

    expect(query).toEqual({ search: "invoice", jobType: "App\\Jobs\\Invoice", exceptionClass: "RuntimeException", period: "7d", cursor: "next" });
    expect(presented.errorGroups[0]).toMatchObject({
      path: "/errors/error_abc",
      jobPath: "/jobs/job_invoice",
      latest: { runPath: "/runs/run_latest", attemptPath: "/runs/run_latest?node=attempt_run_latest_2" },
    });
    expect(presented.hasFilters).toBe(true);
  });

  it("preserves occurrence evidence and links for Error-group detail", () => {
    const query = errorOccurrencesQuery(new Request("https://example.test/skyline/errors/error_abc?period=24h&cursor=older"));
    const exception = {
      class: "RuntimeException",
      message: "Invoice 42 failed",
      messageTruncated: false,
      messageOriginalBytes: 17,
      code: "500",
      location: null,
      frames: [],
      framesTruncated: false,
      markdown: "# RuntimeException - Job failed\n",
    };
    const presented = presentErrorGroupDetail({
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T12:01:00.000000000Z",
      capabilities: {} as ErrorGroupDetailDto["capabilities"],
      errorGroup: summary,
      representative: exception,
      activity: [{ timestamp: "2026-08-04T00:00:00Z", occurrences: 2 }],
      failedAttempts: [{
        id: "attempt_run_latest_2",
        runId: "run_latest",
        attemptNumber: 2,
        jobType: summary.jobType,
        connection: "redis",
        queue: "billing",
        startedAt: summary.lastObservedAt,
        finishedAt: summary.lastObservedAt,
        observedAt: summary.lastObservedAt,
        runHref: summary.latest.runHref,
        attemptHref: summary.latest.attemptHref,
        exception,
      }, {
        id: "attempt_run_unavailable_1",
        runId: "run_unavailable",
        attemptNumber: 1,
        jobType: summary.jobType,
        connection: null,
        queue: null,
        startedAt: summary.lastObservedAt,
        finishedAt: summary.lastObservedAt,
        observedAt: summary.lastObservedAt,
        runHref: "/skyline/runs/run_unavailable",
        attemptHref: "/skyline/runs/run_unavailable?node=attempt_run_unavailable_1",
        exception,
      }],
      pagination: { next: null, previous: null },
      filters: { period: "24h" },
      options: { timeRanges: [{ value: "24h", label: "Last 24 hours" }] },
      hasAnyOccurrences: true,
    });

    expect(query).toEqual({ period: "24h", cursor: "older" });
    expect(presented.failedAttempts[0]).toMatchObject({
      runPath: "/runs/run_latest",
      attemptPath: "/runs/run_latest?node=attempt_run_latest_2",
      exception: { message: "Invoice 42 failed" },
    });
    expect(presented.failedRuns[0]).toEqual({
      id: "run_latest",
      friendlyId: "run_latest",
      path: "/runs/run_latest?node=attempt_run_latest_2",
      isRoot: true,
      jobType: "App\\Jobs\\Invoice",
      version: null,
      machine: null,
      status: "failed",
      queueTarget: "redis / billing",
      traceIdentity: "—",
      attemptCount: 2,
      startedAt: summary.lastObservedAt,
      finishedAt: summary.lastObservedAt,
      queueDuration: "—",
      duration: "0µs",
    });
    expect(presented.failedRuns[1].queueTarget).toBe("—");
    expect(presented).toMatchObject({
      errorGroup: { friendlyId: "error_abc" },
      canViewVersions: false,
      canViewMachines: false,
      canBulkReplay: false,
      affectedVersions: [],
      viewAllRunsPath: "/runs",
    });
  });

  it("defaults Error-detail occurrence evidence to the source seven-day period", () => {
    expect(errorOccurrencesQuery(new Request("https://example.test/skyline/errors/error_abc")))
      .toEqual({ period: "7d" });
  });

  it("defaults Error groups to the source one-day period", () => {
    expect(errorGroupsQuery(new Request("https://example.test/skyline/errors")))
      .toEqual({ period: "24h" });

    const presented = presentErrorGroups({
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T12:01:00.000000000Z",
      capabilities: {} as ErrorGroupsPageDto["capabilities"],
      errorGroups: [summary],
      pagination: { next: null, previous: null },
      filters: { search: null, jobType: null, exceptionClass: null, period: "24h" },
      options: { jobTypes: [], exceptionClasses: [], timeRanges: [] },
      hasAnyErrorGroups: true,
    });

    expect(presented.hasFilters).toBe(false);
  });

  it("keeps the explicit default period in filtered state", () => {
    const request = new Request("https://example.test/skyline/errors?period=24h");
    const presented = presentErrorGroups({
      schemaVersion: 1,
      packageVersion: "fixture",
      generatedAt: "2026-08-04T12:01:00.000000000Z",
      capabilities: {} as ErrorGroupsPageDto["capabilities"],
      errorGroups: [summary],
      pagination: { next: null, previous: null },
      filters: { search: null, jobType: null, exceptionClass: null, period: "24h" },
      options: { jobTypes: [], exceptionClasses: [], timeRanges: [] },
      hasAnyErrorGroups: true,
    }, request);

    expect(presented.hasFilters).toBe(true);
  });
});
