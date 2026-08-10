import { describe, expect, test } from "vitest";
import { FixtureAdapter } from "../../../resources/js/skyline/FixtureAdapter";
import { applyRunState } from "./run-states";

const runId = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";

describe("Run fixture state", () => {
  test("applies active state consistently to the page, trace root, and selected inspector", async () => {
    const adapter = new FixtureAdapter();
    const page = await adapter.trace(runId);
    const root = page.trace.nodes.find((node) => node.parentId === null)!;
    const inspector = await adapter.inspector(root.id, runId);
    const representedActiveDurationUs = page.trace.durationUs;

    applyRunState(page, "running");
    applyRunState({ node: inspector }, "running");

    expect(page.run).toMatchObject({ status: "running", finishedAt: null, durationUs: null });
    expect(page.trace).toMatchObject({ rootStatus: "executing", polling: true, durationUs: null, activeDurationUs: representedActiveDurationUs });
    expect(root).toMatchObject({ status: "running", isPartial: true, isError: false, durationUs: null });
    expect(inspector).toMatchObject({ status: "running", isPartial: true, isError: false, durationUs: null });
  });

  test("keeps failed state consistent without fabricating active polling", async () => {
    const page = await new FixtureAdapter().trace(runId);
    const root = page.trace.nodes.find((node) => node.parentId === null)!;

    applyRunState(page, "failed");

    expect(page.trace).toMatchObject({ rootStatus: "failed", polling: false });
    expect(root).toMatchObject({ status: "failed", isPartial: false, isError: true });
  });
});
