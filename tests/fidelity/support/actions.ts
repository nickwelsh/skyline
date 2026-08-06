import type { Page } from "@playwright/test";

export type ActionObservation = {
  step: string;
  url: string;
  activeElement: { tag: string; role: string | null; name: string } | null;
  visible: string[];
  storage: Record<string, string>;
  clipboard: string | null;
};

export async function observeAction(page: Page, step: string, visibleSelectors: string[] = []): Promise<ActionObservation> {
  return page.evaluate(async ({ currentStep, selectors }) => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const clipboard = await navigator.clipboard?.readText().catch(() => null) ?? null;
    return {
      step: currentStep,
      url: typeof (window as Window & { __oracleCanonicalUrl?: unknown }).__oracleCanonicalUrl === "string"
        ? (window as Window & { __oracleCanonicalUrl: string }).__oracleCanonicalUrl
        : `${location.pathname}${location.search}${location.hash}`,
      activeElement: active ? { tag: active.tagName, role: active.getAttribute("role"), name: active.getAttribute("aria-label") ?? active.textContent?.trim() ?? "" } : null,
      visible: selectors.filter((selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement && element.offsetParent !== null;
      }),
      storage: Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key) ?? ""])),
      clipboard,
    };
  }, { currentStep: step, selectors: visibleSelectors });
}

export function normalizeActionTranscript(transcript: ActionObservation[], basePath: string) {
  return transcript.map((observation) => ({ ...observation, url: observation.url.startsWith(basePath) ? observation.url.slice(basePath.length) || "/" : observation.url }));
}
