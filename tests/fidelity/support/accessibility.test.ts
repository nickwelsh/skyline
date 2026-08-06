import { describe, expect, test } from "vitest";
import { normalizeAccessibilityTree } from "./accessibility";

describe("accessibility-tree normalization", () => {
  test("retains ordered semantics while discarding ephemeral protocol ids", () => {
    const first = normalizeAccessibilityTree([
      node("ephemeral-root", "RootWebArea", "Skyline", ["ephemeral-heading"]),
      node("ephemeral-heading", "heading", "Runs", [], [{ name: "level", value: { value: 1 } }]),
    ]);
    const second = normalizeAccessibilityTree([
      node("other-root", "RootWebArea", "Skyline", ["other-heading"]),
      node("other-heading", "heading", "Runs", [], [{ name: "level", value: { value: 1 } }]),
    ]);

    expect(first).toEqual(second);
    expect(first).toEqual({ role: "RootWebArea", name: "Skyline", children: [{ role: "heading", name: "Runs", states: { level: 1 } }] });
  });
});

function node(nodeId: string, role: string, name: string, childIds: string[], properties: Array<{ name: string; value: { value: unknown } }> = []) {
  return { nodeId, role: { value: role }, name: { value: name }, childIds, properties };
}
