import { describe, expect, test, vi } from "vitest";
import { createDiscoveryStep } from "./discovery";

describe("bounded discovery steps", () => {
  test("returns the phase result and logs its named completion", async () => {
    const write = vi.fn();
    const step = createDiscoveryStep("errors-stack-expansion@1440x960-classic", { timeoutMs: 20, write });

    await expect(step("goto:skyline", async () => "ready")).resolves.toBe("ready");

    expect(JSON.parse(write.mock.calls[0][0].replace(/^\nNW224_DISCOVERY_STEP=/, "").trim())).toMatchObject({
      capture: "errors-stack-expansion@1440x960-classic",
      label: "goto:skyline",
      status: "passed",
    });
  });

  test("fails a stuck phase at its configured bound and logs the failure", async () => {
    const write = vi.fn();
    const step = createDiscoveryStep("errors-stack-expansion@1440x960-classic", { timeoutMs: 5, write });

    await expect(step("state:skyline-stack-expansion", () => new Promise<never>(() => {}))).rejects.toThrow(
      "NW224 discovery phase state:skyline-stack-expansion exceeded 5ms for errors-stack-expansion@1440x960-classic.",
    );

    expect(JSON.parse(write.mock.calls[0][0].replace(/^\nNW224_DISCOVERY_STEP=/, "").trim())).toMatchObject({
      capture: "errors-stack-expansion@1440x960-classic",
      label: "state:skyline-stack-expansion",
      status: "failed",
    });
  });
});
