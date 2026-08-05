import { describe, expect, it } from "vitest";
import { FixtureAdapter } from "./FixtureAdapter";
import { ExternalOperationInspector } from "./ExternalOperationInspector";
import { presentRunDetail } from "./RunDetailAdapter";

describe("RunDetailAdapter", () => {
  it("projects truthful Run, Attempt, relationship, and inspector inputs", async () => {
    const adapter = new FixtureAdapter();
    const dto = await adapter.trace("run_01J8R4NQX6K3PV4W0A1H2Z7M9C", "cursor=opaque");
    const detail = presentRunDetail(dto, (nodeId) => adapter.inspector(nodeId, dto.run.id));

    expect(detail.run).toMatchObject({
      id: dto.run.id,
      jobType: "App\\Jobs\\GenerateMonthlyInvoices",
      queueTarget: "redis / billing",
      driverId: "redis",
      queueTimeSource: "framework_event",
      attemptCount: 2,
    });
    expect(detail.attempts.map((attempt) => attempt.number)).toEqual([1, 2]);
    expect(detail.relationships.children[0]).toMatchObject({
      id: "run_01J8R4H9S9J12V04CNH6F6JQ3M",
      path: "/runs/run_01J8R4H9S9J12V04CNH6F6JQ3M?tableState=cursor%3Dopaque",
    });
    expect(detail.navigation.runsPath).toBe("/runs?cursor=opaque");
    expect(detail.renderInspectorDetails).toBe(ExternalOperationInspector);
    expect(detail.trace.nodes[0]).toMatchObject({
      id: `run_${dto.run.id}`,
      inspectorHref: `/skyline/api/runs/${dto.run.id}/nodes/run_${dto.run.id}`,
    });
    const inspector = await detail.loadInspector("span_4f24adb545b26d31");
    expect(inspector).toMatchObject({ kind: "query" });
    expect(inspector.detailSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "SQL" }),
    ]));
    expect(detail.run).not.toHaveProperty("deployment");
    expect(detail.run).not.toHaveProperty("worker");
    expect(detail.run).not.toHaveProperty("machine");
  });
});
