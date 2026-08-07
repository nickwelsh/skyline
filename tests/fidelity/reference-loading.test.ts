import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const main = readFileSync(resolve(root, "tests/fidelity/reference/main.ts"), "utf8");
const support = readFileSync(resolve(root, "tests/fidelity/support/reference.ts"), "utf8");

describe("pinned reference loading lifecycle", () => {
  test("hydrates the pinned shell/layout while the page loader remains pending", () => {
    expect(main).toContain("v7_partialHydration: true");
    expect(main).toContain("hydrateFallbackElement: createElement(ReferenceInitialLoadingPage)");
    expect(main).toContain("createElement(PageContainer");
    expect(main).toContain("createElement(PageBody");
    expect(main).toContain("createElement(Spinner)");
    expect(main).not.toContain('createElement("aside"');
    expect(main).not.toContain("referenceLoadingRoute");
  });

  test("keeps initial loading distinct from stale refresh", () => {
    expect(support).toContain('state === "loading" && phase === "initial"');
    expect(support).toContain('state === "stale-refresh" && phase === "refresh"');
    expect(main).toContain('const refreshState = capture.state === "stale-refresh"');
  });
});
