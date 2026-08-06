import { describe, expect, test, vi } from "vitest";
import { closeContextAfterPages } from "./browser-lifecycle";

describe("fidelity browser lifecycle", () => {
  test("closes every page before closing its context", async () => {
    const events: string[] = [];
    const pages = ["skyline", "trigger"].map((label) => ({ label, page: { close: vi.fn(async (_options: { runBeforeUnload: false }) => { events.push(`page:${label}`); }) } }));
    const context = { close: vi.fn(async () => { events.push("context"); }) };

    await closeContextAfterPages(context, pages, { capture: "sql-result-light" });

    expect(events.indexOf("context")).toBeGreaterThan(events.indexOf("page:skyline"));
    expect(events.indexOf("context")).toBeGreaterThan(events.indexOf("page:trigger"));
    expect(pages.every(({ page }) => page.close.mock.calls[0]?.[0]?.runBeforeUnload === false)).toBe(true);
    expect(context.close).toHaveBeenCalledOnce();
  });

  test("propagates page rejection without accepting context teardown", async () => {
    const context = { close: vi.fn(async () => undefined) };
    const pages = [{ label: "skyline", page: { close: vi.fn(async (_options: { runBeforeUnload: false }) => { throw new Error("page close failed"); }) } }];

    await expect(closeContextAfterPages(context, pages, { capture: "sql-result-light" })).rejects.toThrow("page close failed");
    expect(context.close).not.toHaveBeenCalled();
  });

  test("fails closed with capture, application, and page-count when a page never closes", async () => {
    const context = { close: vi.fn(async () => undefined) };
    const pages = [
      { label: "skyline", page: { close: vi.fn((_options: { runBeforeUnload: false }) => new Promise<void>(() => undefined)) } },
      { label: "trigger", page: { close: vi.fn(async (_options: { runBeforeUnload: false }) => undefined) } },
    ];

    await expect(closeContextAfterPages(context, pages, { capture: "sql-result-light", timeoutMs: 5 }))
      .rejects.toThrow(/skyline.*sql-result-light.*2 pages.*5ms/i);
    expect(context.close).not.toHaveBeenCalled();
  });

  test("fails closed when the emptied context never closes", async () => {
    const context = { close: vi.fn(() => new Promise<void>(() => undefined)) };
    const pages = [{ label: "skyline", page: { close: vi.fn(async (_options: { runBeforeUnload: false }) => undefined) } }];

    await expect(closeContextAfterPages(context, pages, { capture: "sql-result-light", timeoutMs: 5 }))
      .rejects.toThrow(/context.*sql-result-light.*1 page.*5ms/i);
  });
});
