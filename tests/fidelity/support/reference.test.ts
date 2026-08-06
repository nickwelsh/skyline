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
