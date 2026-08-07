import { describe, expect, it } from "vitest";
import type { JobDetailDto, JobsPageDto } from "./dto";
import { fixtureCapabilities } from "./FixtureAdapter";
import { jobRunsQuery, jobsQuery, presentJobDetail, presentJobs } from "./JobsAdapter";

describe("JobsAdapter", () => {
  it("reads only valid URL-backed Job filters", () => {
    expect(jobsQuery(new Request("https://example.test/jobs?search=invoice&period=24h&cursor=opaque")))
      .toEqual({ search: "invoice", period: "24h", cursor: "opaque" });
    expect(jobsQuery(new Request("https://example.test/jobs?period=invalid"))).toEqual({});
    expect(jobRunsQuery(new Request("https://example.test/jobs/id"))).toEqual({ period: "7d" });
    expect(jobRunsQuery(new Request("https://example.test/jobs/id?status=failed&status=unknown&cursor=opaque&period=7d")))
      .toEqual({ status: ["failed"], cursor: "opaque", period: "7d" });
  });

  it("maps Job API data into stable source presenters", () => {
    const list = presentJobs(jobsPage());
    expect(list.jobs[0]).toMatchObject({ id: "job_invoice", path: "/jobs/job_invoice", name: "App\\Jobs\\Invoice", runCount: 2 });
    expect(list.pagination).toEqual({ previous: undefined, next: "next" });
    expect(list.hasFilters).toBe(true);

    const detail = presentJobDetail(jobDetail());
    expect(detail.job).toMatchObject({ id: "job_invoice", name: "App\\Jobs\\Invoice" });
    expect(detail.runs[0].path).toContain("/runs/run-1?tableState=");
    expect(detail.queueTargets[0].path).toBe("/queues/queue_redis");
    expect(detail.activity[0].statusCounts.failed).toBe(1);
  });
});

function jobsPage(): JobsPageDto {
  return {
    schemaVersion: 1,
    packageVersion: "fixture",
    generatedAt: "2026-08-05T12:00:00Z",
    capabilities: fixtureCapabilities,
    jobs: [jobSummary()],
    pagination: { previous: null, next: "next" },
    filters: { search: "invoice", period: "24h" },
    options: { timeRanges },
    hasAnyJobs: true,
  };
}

function jobDetail(): JobDetailDto {
  return {
    ...jobsPage(),
    job: jobSummary(),
    queueTargets: [{ id: "queue_redis", connection: "redis", queue: "default", runCount: 2, href: "/skyline/queues/queue_redis" }],
    activity: [{ timestamp: "2026-08-05T00:00:00Z", total: 2, statusCounts: { queued: 0, running: 0, retrying: 0, completed: 1, failed: 1 } }],
    runs: [{
      id: "run-1", traceId: "trace-1", isRoot: true, name: "App\\Jobs\\Invoice", status: "failed", connection: "redis", queue: "default",
      attemptCount: 1, triggeredAt: "2026-08-05T12:00:00Z", queuedAt: "2026-08-05T12:00:00Z", startedAt: "2026-08-05T12:00:00Z",
      finishedAt: "2026-08-05T12:00:01Z", queueDurationUs: 10, durationUs: 1_000_000, revision: 1,
    }],
    pagination: { previous: null, next: null },
    tableState: "state",
    filters: { status: ["failed"], period: "7d" },
    options: { statuses: ["queued", "running", "retrying", "completed", "failed"], timeRanges },
    hasAnyRuns: true,
  };
}

function jobSummary() {
  return {
    id: "job_invoice", name: "App\\Jobs\\Invoice", href: "/skyline/jobs/job_invoice", firstObservedAt: "2026-08-01T12:00:00Z",
    lastObservedAt: "2026-08-05T12:00:00Z", runCount: 2, statusCounts: { queued: 0, running: 0, retrying: 0, completed: 1, failed: 1 },
    activity: [{ timestamp: "2026-08-05T12:00:00Z", total: 2, statusCounts: { queued: 0, running: 0, retrying: 0, completed: 1, failed: 1 } }],
    latestRun: { id: "run-1", status: "failed" as const, triggeredAt: "2026-08-05T12:00:00Z", href: "/skyline/runs/run-1" },
  };
}

const timeRanges = [{ value: "24h" as const, label: "Last 24 hours" }, { value: "7d" as const, label: "Last 7 days" }];
