import { describe, expect, test } from "vitest";
import { parseScenario, scenarioPath, type FixtureCatalog } from "./skyline";

const catalog: FixtureCatalog = { job: "job-1", run: "run-1", error: "error-1", log: "log-1", queue: "queue-1" };

describe("packaged Skyline fidelity fixture", () => {
  test.each([
    ["jobs-loading@1440x960-classic", "root", "/skyline/jobs"],
    ["run-stale-refresh@1440x960-dark", "detail", "/skyline/runs/run-1"],
    ["log-found@390x844-classic", "detail", "/skyline/logs?event=log-1"],
    ["shell-customized@1024x768-classic", "owned", "/skyline/runs"],
  ])("maps %s to its public packaged route", (capture, kind, path) => {
    const scenario = parseScenario(capture);
    expect(scenario.kind).toBe(kind);
    expect(scenarioPath(scenario, catalog)).toBe(path);
  });
});
