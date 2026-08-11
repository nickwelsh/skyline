import type { Page } from "@playwright/test";

export type CaptureEnvironment = { width: number; height: number; theme: "classic" | "dark" | "light" | "system"; colorScheme: "light" | "dark" };

export const loadingBarCaptureContract = {
  className: "width-0 absolute left-0 top-0 h-full bg-linear-to-r from-transparent from-5% via-blue-500 to-transparent to-95%",
  selector: '[class="width-0 absolute left-0 top-0 h-full bg-linear-to-r from-transparent from-5% via-blue-500 to-transparent to-95%"]',
  candidateSelector: ".width-0.absolute.left-0.top-0.h-full",
  styleMarker: "data-fidelity-loading-bar-capture",
  styleText: '[class="width-0 absolute left-0 top-0 h-full bg-linear-to-r from-transparent from-5% via-blue-500 to-transparent to-95%"] { left: -100% !important; width: 100% !important; }',
} as const;

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

export function installDeterministicSplineViewer() {
  const elementName = "spline-viewer";
  const marker = "__skylineFidelityStaticArtwork";
  const existing = customElements.get(elementName) as (CustomElementConstructor & Record<string, unknown>) | undefined;
  if (existing) {
    if (existing[marker] !== true) throw new Error("External Spline renderer registered before the fidelity fixture.");
    return;
  }

  class StaticSplineViewer extends HTMLElement {
    connectedCallback() {
      this.setAttribute("data-fidelity-static-artwork", "trigger-mark@ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0");
      this.setAttribute("aria-hidden", "true");
      if (this.shadowRoot) return;
      const root = this.attachShadow({ mode: "open" });
      // Pinned from apps/webapp/app/assets/images/logo.svg at the declared Trigger commit.
      root.innerHTML = `
        <style>
          :host { contain: paint; display: block; position: relative; }
          svg { height: 112px; left: 50%; position: absolute; top: 46%; transform: translate(-50%, -50%); width: 128px; }
        </style>
        <svg aria-hidden="true" fill="none" viewBox="0 0 119 104" xmlns="http://www.w3.org/2000/svg">
          <path fill="url(#trigger-mark-gradient)" d="M35.664 42.4 59.411 1.269l58.853 101.937H.559l23.747-41.133 16.799 9.7-6.948 12.034h50.509L59.41 40.066 52.464 52.1l-16.8-9.7Z"/>
          <defs>
            <linearGradient id="trigger-mark-gradient" x1="59.5" x2="59.5" y1="0" y2="104" gradientUnits="userSpaceOnUse">
              <stop stop-color="#E7FF52"/>
              <stop offset="1" stop-color="#41FF54"/>
            </linearGradient>
          </defs>
        </svg>
      `;
    }
  }
  Object.defineProperty(StaticSplineViewer, marker, { value: true });
  customElements.define(elementName, StaticSplineViewer);
}

export async function prepareCapture(page: Page, capture: string, basePath: string) {
  const environment = captureEnvironment(capture);
  await page.setViewportSize({ width: environment.width, height: environment.height });
  const initialScheme = capture.includes("shell-live-change") ? opposite(environment.colorScheme) : environment.colorScheme;
  await page.emulateMedia({ colorScheme: initialScheme, reducedMotion: "reduce" });
  await page.clock.install({ time: new Date("2026-08-05T12:00:00.000Z") });
  await page.addInitScript(installDeterministicSplineViewer);
  await page.addInitScript(({ key, theme }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, theme, contrast: 70 }));
  }, { key: `skyline.ui-preferences.v1:${basePath}`, theme: environment.theme });
  return environment;
}

export async function applyLiveSystemChange(page: Page, capture: string) {
  if (!capture.includes("shell-live-change")) return;
  const environment = captureEnvironment(capture);
  await page.emulateMedia({ colorScheme: environment.colorScheme, reducedMotion: "reduce" });
}

export async function settleCapture(page: Page) {
  const settled = page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    for (const element of document.querySelectorAll<HTMLElement>("*")) {
      element.style.setProperty("animation", "none", "important");
      element.style.setProperty("transition", "none", "important");
    }
  });
  await page.clock.runFor(50);
  await settled;
  await page.evaluate(stabilizeLoadingBarCapture, loadingBarCaptureContract);
}

export function stabilizeLoadingBarCapture(contract: typeof loadingBarCaptureContract) {
  const candidates = document.querySelectorAll<HTMLElement>(contract.candidateSelector);
  if (candidates.length === 0) return 0;
  if (candidates.length !== 1 || candidates[0]?.className !== contract.className || !candidates[0].matches(contract.selector)) {
    throw new Error("Fidelity capture changed the literal source LoadingBarDivider animation element.");
  }

  const styles = document.querySelectorAll<HTMLStyleElement>(`style[${contract.styleMarker}]`);
  if (styles.length > 1 || (styles[0] && styles[0].textContent !== contract.styleText)) {
    throw new Error("Fidelity capture changed the LoadingBarDivider stabilization rule.");
  }
  if (styles.length === 0) {
    const style = document.createElement("style");
    style.setAttribute(contract.styleMarker, "source-first-keyframe");
    style.textContent = contract.styleText;
    document.head.append(style);
  }
  return 1;
}

function opposite(scheme: "light" | "dark") {
  return scheme === "light" ? "dark" : "light";
}

export async function assertFixedCanvas(page: Page, capture: string) {
  const environment = captureEnvironment(capture);
  if (environment.width !== 390) return;
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width !== 1024) throw new Error(`Pinned mobile canvas must be 1024px; got ${width}px.`);
}
