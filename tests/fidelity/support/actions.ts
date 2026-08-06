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
    const oracleWindow = window as typeof window & { __oracleCanonicalUrl?: string };
    return {
      step: currentStep,
      url: typeof oracleWindow.__oracleCanonicalUrl === "string"
        ? (() => {
            const actual = new URL(`${location.pathname}${location.search}${location.hash}`, location.origin);
            const canonical = new URL(oracleWindow.__oracleCanonicalUrl, location.origin);
            if (!canonical.search && actual.search) canonical.search = actual.search;
            if (!canonical.hash && actual.hash) canonical.hash = actual.hash;
            return `${canonical.pathname}${canonical.search}${canonical.hash}`;
          })()
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

export function canonicalActionUrl(actualUrl: string, canonicalUrl: string) {
  const actual = new URL(actualUrl, "https://fidelity.invalid");
  const canonical = new URL(canonicalUrl, "https://fidelity.invalid");
  if (!canonical.search && actual.search) canonical.search = actual.search;
  if (!canonical.hash && actual.hash) canonical.hash = actual.hash;
  return `${canonical.pathname}${canonical.search}${canonical.hash}`;
}

export function normalizeActionTranscript(transcript: ActionObservation[], basePath: string) {
  return transcript.map((observation) => ({ ...observation, url: observation.url.startsWith(basePath) ? observation.url.slice(basePath.length) || "/" : observation.url }));
}
