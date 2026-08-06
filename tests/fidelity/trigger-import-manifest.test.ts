import { describe, expect, test } from "vitest";
// @ts-expect-error Importer validation stays executable by Node without a build step.
import { validateSourceTargetMappings } from "../../scripts/trigger-import-manifest.mjs";

const hash = "a".repeat(64);

describe("Trigger import source-target mappings", () => {
  test("allows one pinned source to produce multiple adapted targets", () => {
    expect(() => validateSourceTargetMappings([
      { source: "route.tsx", sha256: hash, target: "route.tsx" },
      { source: "route.tsx", sha256: hash, target: "presenter.tsx" },
    ])).not.toThrow();
  });

  test("rejects conflicting hashes for one pinned source", () => {
    expect(() => validateSourceTargetMappings([
      { source: "route.tsx", sha256: hash, target: "route.tsx" },
      { source: "route.tsx", sha256: "b".repeat(64), target: "presenter.tsx" },
    ])).toThrow(/Conflicting hashes/);
  });

  test("rejects duplicate adapted targets", () => {
    expect(() => validateSourceTargetMappings([
      { source: "route.tsx", sha256: hash, target: "presenter.tsx" },
      { source: "other.tsx", sha256: hash, target: "presenter.tsx" },
    ])).toThrow(/Multiple Trigger sources target one module/);
  });
});
