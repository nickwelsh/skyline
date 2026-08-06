import type { Page } from "@playwright/test";

export type CaptureEnvironment = { width: number; height: number; theme: "classic" | "dark" | "light" | "system"; colorScheme: "light" | "dark" };

export function captureEnvironment(capture: string): CaptureEnvironment {
  const match = capture.match(/@(\d+)x(\d+)-(classic|dark|light|system)(?:-(light|dark))?$/);
  if (!match) throw new Error(`Invalid fidelity capture identifier: ${capture}`);
  const theme = match[3] as CaptureEnvironment["theme"];
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    theme,
    colorScheme: (match[4] ?? (theme === "dark" ? "dark" : "light")) as "light" | "dark",
  };
}

export async function prepareCapture(page: Page, capture: string, basePath: string) {
  const environment = captureEnvironment(capture);
  await page.setViewportSize({ width: environment.width, height: environment.height });
  await page.emulateMedia({ colorScheme: environment.colorScheme, reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-08-05T12:00:00.000Z") });
  await page.addInitScript(({ key, theme }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, theme, contrast: 70 }));
  }, { key: `skyline.ui-preferences.v1:${basePath}`, theme: environment.theme });
  return environment;
}

export async function settleCapture(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    for (const element of document.querySelectorAll<HTMLElement>("*")) {
      element.style.setProperty("animation", "none", "important");
      element.style.setProperty("transition", "none", "important");
    }
  });
}

export async function assertFixedCanvas(page: Page, capture: string) {
  const environment = captureEnvironment(capture);
  if (environment.width !== 390) return;
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width !== 1024) throw new Error(`Pinned mobile canvas must be 1024px; got ${width}px.`);
}
