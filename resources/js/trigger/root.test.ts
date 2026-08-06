import { describe, expect, it } from "vitest";
import { TRIGGER_SHELL_CLASS_NAME } from "./root";

describe("TriggerShell source root", () => {
  it("preserves pinned 16px font inheritance", () => {
    expect(TRIGGER_SHELL_CLASS_NAME).toBe("isolate h-screen min-w-[1024px] bg-background-dimmed text-text-dimmed antialiased");
    expect(TRIGGER_SHELL_CLASS_NAME).not.toContain("text-[0.8125rem]");
  });
});
