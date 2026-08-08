import { describe, expect, test } from "vitest";
import { FixtureAdapter } from "../../../resources/js/skyline/FixtureAdapter";
import fixture from "../fixtures.json" with { type: "json" };
import type { JobsPageDto, JobsQuery } from "../../../resources/js/skyline/dto";
import { fixtureCatalog, parseScenario, responseFor, scenarioPath, type FixtureCatalog } from "./skyline";

const catalog: FixtureCatalog = { job: "job-1", run: "run-1", error: "error-1", log: "log-1", queue: "queue-1" };

describe("packaged Skyline fidelity fixture", () => {
  test("uses the reviewed seed identifiers", async () => {
    await expect(fixtureCatalog()).resolves.toEqual({
      job: fixture.ids.job,
      run: fixture.ids.run,
      error: fixture.ids.error,
      log: fixture.ids.event,
      queue: fixture.ids.queue,
    });
  });

  test("uses the reviewed seed values", async () => {
    const adapter = new FixtureAdapter();
    const [jobs, runs, errors, logs, queues] = await Promise.all([
      adapter.jobs({ search: fixture.values.jobType }), adapter.runs(), adapter.errorGroups(), adapter.telemetryEvents(), adapter.queueTargets(),
    ]);
    const catalog = await fixtureCatalog(adapter);
    expect({
      jobType: jobs.jobs.find(({ id }) => id === catalog.job)?.name,
      runStatus: runs.runs.find(({ id }) => id === catalog.run)?.status,
      exceptionClass: errors.errorGroups.find(({ id }) => id === catalog.error)?.exceptionClass,
      logLevel: logs.telemetryEvents.find(({ id }) => id === catalog.log)?.level,
      connection: queues.queueTargets.find(({ id }) => id === catalog.queue)?.connection,
      queue: queues.queueTargets.find(({ id }) => id === catalog.queue)?.queue,
    }).toEqual(fixture.values);
  });

  test("forwards Job-list cursors into the deterministic adapter", async () => {
    class RecordingAdapter extends FixtureAdapter {
      query: JobsQuery | undefined;

      override jobs(query: JobsQuery = {}): Promise<JobsPageDto> {
        this.query = query;
        return super.jobs(query);
      }
    }
    const adapter = new RecordingAdapter();

    await responseFor("jobs", new URLSearchParams("search=invoice&period=24h&cursor=opaque-next"), adapter);

    expect(adapter.query).toEqual({ search: "invoice", period: "24h", cursor: "opaque-next" });
  });

  test.each([
    ["jobs-loading@1440x960-classic", "root", "/skyline/jobs"],
    ["errors-loading@1440x960-classic", "root", "/skyline/errors"],
    ["error-loading@1440x960-classic", "detail", "/skyline/errors/error-1"],
    ["run-stale-refresh@1440x960-dark", "detail", "/skyline/runs/run-1"],
    ["log-found@390x844-classic", "detail", "/skyline/logs?event=log-1"],
    ["shell-customized@1024x768-classic", "owned", "/skyline/runs"],
    ["errors-stack-expansion@1440x960-light", "owned", "/skyline/errors/error-1"],
  ])("maps %s to its public packaged route", (capture, kind, path) => {
    const scenario = parseScenario(capture);
    expect(scenario.kind).toBe(kind);
    expect(scenarioPath(scenario, catalog)).toBe(path);
  });
});
