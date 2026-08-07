import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperatingSystemContextProvider, operatingSystemFromUserAgent, type OperatingSystemPlatform } from "./OperatingSystemProvider";
import { ShortcutKey } from "./ShortcutKey";

describe("OperatingSystemProvider", () => {
  it.each([
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "mac"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "windows"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "linux"],
    ["Skyline terminal", "unknown"],
  ] as const)("normalizes %s", (userAgent, platform) => {
    expect(operatingSystemFromUserAgent(userAgent)).toBe(platform);
  });

  it.each(["linux", "unknown"] as OperatingSystemPlatform[])("labels mod as Ctrl on %s", (platform) => {
    const markup = renderToStaticMarkup(
      <OperatingSystemContextProvider platform={platform}>
        <ShortcutKey shortcut={{ modifiers: ["mod"], key: "b" }} variant="medium" />
      </OperatingSystemContextProvider>,
    );

    expect(markup).toContain("Ctrl");
    expect(markup).not.toContain("⌘");
  });
});
