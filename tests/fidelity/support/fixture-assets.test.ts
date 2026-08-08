import { describe, expect, test } from "vitest";
import { resolveFixtureAsset } from "../../../scripts/serve-fixture-assets.mjs";

describe("fidelity fixture assets", () => {
  const assets = new Set(["skyline.js", "assets/prism-json.js"]);

  test("serves manifest-owned flat and nested Vite assets", () => {
    expect(resolveFixtureAsset("/skyline/assets/skyline.js", assets)).toBe("skyline.js");
    expect(resolveFixtureAsset("/skyline/assets/assets/prism-json.js", assets)).toBe("assets/prism-json.js");
  });

  test("rejects routes and unowned nested paths", () => {
    expect(resolveFixtureAsset("/skyline/errors", assets)).toBeUndefined();
    expect(resolveFixtureAsset("/skyline/assets/assets/missing.js", assets)).toBeUndefined();
    expect(resolveFixtureAsset("/skyline/assets/../manifest.json", assets)).toBeUndefined();
  });
});
