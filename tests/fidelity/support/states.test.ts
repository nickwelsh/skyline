import type { Page } from "@playwright/test";
import { describe, expect, test, vi } from "vitest";
import { parseScenario } from "./skyline";
import { exposeOwnedState } from "./states";

describe("owned fidelity state", () => {
  test("expands the exact visible Skyline stack disclosure and verifies its controlled trace", async () => {
    const harness = stackDisclosurePage(true);
    const scenario = parseScenario("errors-stack-expansion@1440x960-classic");

    await exposeOwnedState(harness.page, scenario, "skyline");

    expect(harness.getByRole).toHaveBeenCalledWith("button", { name: "Show 2 frames", exact: true });
    expect(harness.count).toHaveBeenCalledOnce();
    expect(harness.waitFor).toHaveBeenCalledWith({ state: "visible" });
    expect(harness.isEnabled).toHaveBeenCalledOnce();
    expect(harness.click).toHaveBeenCalledOnce();
    expect(harness.locator).toHaveBeenNthCalledWith(1, '[aria-controls="exception-trace"]');
    expect(harness.locator).toHaveBeenNthCalledWith(2, '[id="exception-trace"]');
    expect(harness.stableCount).toHaveBeenCalledOnce();
    expect(harness.stableGetAttribute).toHaveBeenCalledWith("aria-expanded");
    expect(harness.traceWaitFor).toHaveBeenCalledWith({ state: "visible" });
  });

  test("leaves Trigger unchanged for the Skyline-only framework extension", async () => {
    const getByRole = vi.fn();
    const locator = vi.fn();
    const scenario = parseScenario("errors-stack-expansion@1440x960-classic");

    await exposeOwnedState({ getByRole, locator } as unknown as Page, scenario, "trigger");

    expect(getByRole).not.toHaveBeenCalled();
    expect(locator).not.toHaveBeenCalled();
  });

  test("fails before clicking a disabled Skyline stack disclosure", async () => {
    const harness = stackDisclosurePage(false);
    const scenario = parseScenario("errors-stack-expansion@1440x960-classic");

    await expect(exposeOwnedState(harness.page, scenario, "skyline")).rejects.toThrow(/must be enabled/i);
    expect(harness.click).not.toHaveBeenCalled();
  });
});

function stackDisclosurePage(enabled: boolean) {
  let expanded = false;
  const count = vi.fn(async () => 1);
  const waitFor = vi.fn(async () => undefined);
  const isEnabled = vi.fn(async () => enabled);
  const click = vi.fn(async () => { expanded = true; });
  const getAttribute = vi.fn(async (name: string) => {
    if (name === "aria-expanded" && expanded) throw new Error("The accessible-name locator no longer matches after expansion.");
    return name === "aria-controls" ? "exception-trace" : name === "aria-expanded" ? String(expanded) : null;
  });
  const disclosure = { count, waitFor, isEnabled, click, getAttribute };
  const getByRole = vi.fn(() => disclosure);
  const stableCount = vi.fn(async () => 1);
  const stableGetAttribute = vi.fn(async () => "true");
  const traceWaitFor = vi.fn(async () => undefined);
  const locator = vi.fn((selector: string) => selector.startsWith("[aria-controls=")
    ? { count: stableCount, getAttribute: stableGetAttribute }
    : { waitFor: traceWaitFor });
  return { page: { getByRole, locator } as unknown as Page, getByRole, locator, count, waitFor, isEnabled, click, stableCount, stableGetAttribute, traceWaitFor };
}
