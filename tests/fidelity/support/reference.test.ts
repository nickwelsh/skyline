import { describe, expect, test } from "vitest";
import { createReferenceFixture } from "./reference";

describe("pinned Trigger Errors fixture", () => {
  test("maps Skyline occurrences into the reached presenter seams", async () => {
    const fixture = await createReferenceFixture();
    const list = fixture.loaders.errors as any;
    const detail = fixture.loaders.error as any;
    const group = list.data.errorGroups[0];

    expect(list.occurrences.data[group.fingerprint]).toEqual([
      expect.objectContaining({ date: expect.any(String), count: expect.any(Number) }),
    ]);
    expect(list.data.filters.possibleTasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: expect.any(String) })]),
    );
    expect(detail.activity.versions).toEqual(["20260804.1"]);
    expect(detail.activity.data).toEqual([
      expect.objectContaining({ date: expect.any(String), "20260804.1": expect.any(Number) }),
    ]);
    expect(detail.data.runList.runs).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "COMPLETED_WITH_ERRORS", taskIdentifier: expect.any(String) }),
    ]));
  });
});

describe("pinned Trigger Logs fixture", () => {
  test("maps task filters and selected log into Trigger presenter contracts", async () => {
    const fixture = await createReferenceFixture();
    const list = fixture.loaders.logs as any;
    const detail = fixture.loaders.log as any;

    expect(list.data.possibleTasks).toEqual([
      { slug: "App\\Jobs\\GenerateMonthlyInvoices" },
    ]);
    expect(detail.selectedLog).toEqual(expect.objectContaining({
      id: expect.any(String),
      runId: expect.any(String),
      taskIdentifier: "App\\Jobs\\GenerateMonthlyInvoices",
      spanId: expect.any(String),
      triggeredTimestamp: expect.any(String),
      level: "WARN",
      message: "Invoice import delayed",
      attributes: expect.objectContaining({ "log.context": { code: 429 } }),
    }));
  });
});
