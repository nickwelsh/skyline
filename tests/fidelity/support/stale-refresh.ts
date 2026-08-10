import type { Page } from "@playwright/test";
import type { FidelityScenario } from "./skyline";

type SkylineFixtureLifecycle = {
  initialStateReady: Promise<void>;
  setState: (state: string) => void;
};

export function staleRefreshPlan(scenario: FidelityScenario) {
  if (scenario.surface === "log") {
    return {
      referenceState: "stale-refresh" as const,
      selectedDetail: { skyline: "event" as const, reference: "log" as const },
      transition: "resource" as const,
    };
  }

  if (scenario.surface === "queue") {
    return {
      referenceState: "stale-refresh" as const,
      selectedDetail: undefined,
      transition: "resource" as const,
    };
  }

  if (scenario.surface === "run") {
    return {
      referenceState: "stale-refresh" as const,
      selectedDetail: { skyline: "node" as const, reference: "span" as const },
      transition: "resource" as const,
    };
  }

  return {
    referenceState: undefined,
    selectedDetail: undefined,
    transition: "page" as const,
  };
}

export async function transitionToStaleRefresh(
  skyline: Page,
  reference: Page,
  fixture: SkylineFixtureLifecycle,
  scenario: FidelityScenario,
) {
  const plan = staleRefreshPlan(scenario);
  await fixture.initialStateReady;

  if (plan.selectedDetail) {
    await Promise.all([
      skyline.waitForFunction((key) => new URL(location.href).searchParams.has(key), plan.selectedDetail.skyline),
      reference.waitForFunction((key) => new URL(location.href).searchParams.has(key), plan.selectedDetail.reference),
    ]);
  }

  fixture.setState("loading");
  if (plan.referenceState) {
    await reference.evaluate((state) => {
      (window as Window & { __oracleSetFixtureState?: (value: string) => void }).__oracleSetFixtureState?.(state);
    }, plan.referenceState);
  }

  await Promise.all([
    revalidatePage(skyline),
    plan.transition === "resource"
      ? reference.evaluate(() => (window as Window & { __oracleRouter?: { revalidate: () => void } }).__oracleRouter?.revalidate())
      : revalidatePage(reference, "__oracle_refresh"),
  ]);
  await Promise.all([skyline.clock.runFor(10), reference.clock.runFor(10)]);
}

function revalidatePage(page: Page, key = "oracleRefresh") {
  return page.evaluate((parameter) => {
    const url = new URL(location.href);
    url.searchParams.set(parameter, "1");
    history.pushState(null, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  }, key);
}
