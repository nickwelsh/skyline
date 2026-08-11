import { describe, expect, it } from "vitest";
import type { JobDetailDto, JobsPageDto } from "./dto";
import { fixtureCapabilities } from "./FixtureAdapter";
import { jobRunsQuery, jobsQuery, presentJobDetail, presentJobs } from "./JobsAdapter";

describe("JobsAdapter", () => {
  it("reads search and pagination while always listing Jobs from all time", () => {
    expect(jobsQuery(new Request("https://example.test/jobs?search=invoice&period=24h&cursor=opaque")))
      .toEqual({ search: "invoice", cursor: "opaque" });
    expect(jobsQuery(new Request("https://example.test/jobs?period=invalid"))).toEqual({});
    expect(jobRunsQuery(new Request("https://example.test/jobs/id"))).toEqual({ period: "7d" });
    expect(jobRunsQuery(new Request("https://example.test/jobs/id?status=failed&status=unknown&cursor=opaque&period=90m")))
      .toEqual({ status: ["failed"], cursor: "opaque", period: "90m" });
    expect(jobRunsQuery(new Request("https://example.test/jobs/id?from=1785859200000&to=1785945600000&period=7d")))
      .toEqual({ from: "1785859200000", to: "1785945600000" });
  });

  it("maps Job API data into stable source presenters", () => {
    const list = presentJobs(jobsPage());
    expect(list.jobs[0]).toMatchObject({ id: "job_invoice", path: "/jobs/job_invoice", displayName: "Invoice", identifier: "App\\Jobs\\Invoice", runCount: 2 });
    expect(list.pagination).toEqual({ previous: undefined, next: "next" });
    expect(list.hasFilters).toBe(true);

    const detail = presentJobDetail(jobDetail());
    expect(detail.job).toMatchObject({ id: "job_invoice", name: "App\\Jobs\\Invoice" });
    expect(detail.runs[0].path).toContain("/runs/run-1?tableState=");
    expect(detail.queueTargets[0].path).toBe("/queues/queue_redis");
    expect(detail.activity.data).toHaveLength(49);
    expect(detail.activity.data[0].bucket).toBe(1_785_844_800_000);
    expect(detail.activity.data[24]).toEqual({ bucket: 1_785_888_000_000, COMPLETED: 4, FAILED: 5, CANCELED: 0, RUNNING: 6 });
    expect(detail.activity.data[48].bucket).toBe(1_785_931_200_000);
    expect(detail.activity).toMatchObject({ statuses: ["COMPLETED", "FAILED", "CANCELED", "RUNNING"], range: { from: 1_785_844_800_000, to: 1_785_931_200_000 } });
    expect(detail.runs[0]).toMatchObject({ taskIdentifier: "Invoice", jobType: "App\\Jobs\\Invoice" });
  });

  it("presents every Job activity graph as the same 24 hourly slots", () => {
    const page = jobsPage();
    page.jobs[0].activity = [
      { timestamp: "2026-08-04T12:00:00Z", total: 9, statusCounts: { queued: 0, running: 0, retrying: 0, completed: 9, failed: 0 } },
      { timestamp: "2026-08-05T10:00:00Z", total: 2, statusCounts: { queued: 0, running: 1, retrying: 0, completed: 0, failed: 1 } },
    ];
    page.jobs.push({ ...jobSummary(), id: "job_empty", name: "App\\Jobs\\Empty", activity: [] });

    const jobs = presentJobs(page).jobs;
    const activity = jobs[0].activity;

    expect(jobs.every((job) => job.activity.length === 24)).toBe(true);
    expect(activity).toHaveLength(24);
    expect(activity[0]).toEqual({
      timestamp: "2026-08-04T13:00:00.000Z",
      total: 0,
      statusCounts: { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0 },
    });
    expect(activity[21]).toEqual(page.jobs[0].activity[1]);
    expect(activity[23].timestamp).toBe("2026-08-05T12:00:00.000Z");
  });

  it("extracts canonical routes when the base path is also a route name", () => {
    const page = jobsPage();
    page.jobs[0].href = "/jobs/jobs/job_invoice";
    page.jobs[0].latestRun.href = "/runs/runs/run-1";
    const detail = jobDetail();
    detail.queueTargets[0].href = "/queues/queues/queue_redis";

    expect(presentJobs(page).jobs[0]).toMatchObject({ path: "/jobs/job_invoice", latestRun: { path: "/runs/run-1" } });
    expect(presentJobDetail(detail).queueTargets[0].path).toBe("/queues/queue_redis");
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
    activity: [{ timestamp: "2026-08-05T00:00:00Z", total: 15, statusCounts: { queued: 1, running: 2, retrying: 3, completed: 4, failed: 5 } }],
    activityRange: { from: "2026-08-04T12:00:00Z", to: "2026-08-05T12:00:00Z" },
    definition: {
      file: { path: "app/Jobs/Invoice.php", href: "vscode://file/app/Jobs/Invoice.php:9" },
      defaultQueue: { connection: "redis", queue: "default" },
      retry: { maxAttempts: 5, backoffSeconds: [1, 5, 10], retryUntil: "2026-08-05T13:00:00Z" },
    },
    runs: [{
      id: "run-1", traceId: "trace-1", parentRunId: null, isRoot: true, name: "App\\Jobs\\Invoice", status: "failed", connection: "redis", queue: "default", driverId: null,
      attemptCount: 1, triggeredAt: "2026-08-05T12:00:00Z", queuedAt: "2026-08-05T12:00:00Z", startedAt: "2026-08-05T12:00:00Z",
      finishedAt: "2026-08-05T12:00:01Z", queueDurationUs: 10, queueTimeSource: null, durationUs: 1_000_000, revision: 1,
    }],
    pagination: { previous: null, next: null },
    tableState: "state",
    filters: { status: ["failed"], period: "7d", from: null, to: null },
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
