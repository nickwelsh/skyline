import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("environment boundary source provenance", () => {
  it.each([
    ["resources/js/trigger/components/TriggerRotatingLogo.tsx", "007d0a01b95b73ad6de715cc23967f6d0efe85b89996a5dd273580080688525b"],
    ["resources/js/trigger/utils/httpErrors.ts", "f9b2de32420d4a9138f47ba7295242541f887c354a137d6e30dc87e7d1ec8e08"],
  ])("keeps %s byte-identical to pinned Trigger", (path, expected) => {
    const actual = createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");

    expect(actual).toBe(expected);
  });
});
