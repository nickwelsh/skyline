import { describe, expect, test } from "vitest";
import { captureEnvironment } from "./capture";

describe("fidelity capture environment", () => {
  test.each([
    ["runs-populated@1440x960-classic", { width: 1440, height: 960, theme: "classic", colorScheme: "light" }],
    ["run-found@390x844-dark", { width: 390, height: 844, theme: "dark", colorScheme: "dark" }],
    ["shell-live-change@1440x960-system-light", { width: 1440, height: 960, theme: "system", colorScheme: "light" }],
  ])("parses %s", (capture, expected) => {
    expect(captureEnvironment(capture)).toEqual(expected);
  });
});
