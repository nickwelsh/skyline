import type { Page } from "@playwright/test";

export type ReferenceFixture = {
  loaders: Record<string, unknown>;
  context?: {
    root?: Record<string, unknown>;
    organization?: Record<string, unknown>;
  };
  canonicalUrls?: Record<string, string>;
};

export async function installReferenceFixture(page: Page, fixture: ReferenceFixture) {
  await page.addInitScript((input) => {
    const environment = { id: "environment", slug: "prod", type: "PRODUCTION", userName: "Production", shortcode: "prod" };
    const project = { id: "project", organizationId: "organization", name: "Fixture Project", slug: "fixture", version: "V3", engine: "V1", environments: [environment], createdAt: "2026-01-01T00:00:00.000Z" };
    const organization = { id: "organization", slug: "fixture", title: "Fixture Organization", avatar: { type: "letters", hex: "#4f46e5" }, projects: [project] };
    const root = {
      user: { id: "user", email: "fixture@trigger.dev", admin: false, isImpersonating: false, dashboardPreferences: { sideMenu: { isCollapsed: false, width: 224, sectionOrder: [], collapsedSections: {}, hiddenItems: {}, sectionItemOrder: {}, favorites: [] } } },
      isViewingAsUser: false,
      toastMessage: null,
      posthogProjectKey: undefined,
      posthogUiHost: undefined,
      features: { isManagedCloud: false },
      appEnv: "development",
      appOrigin: location.origin,
      apiOrigin: location.origin,
      triggerCliTag: "latest",
      kapa: { websiteId: "" },
      timezone: "UTC",
      showThemeSwitcher: true,
      themePreference: "dark",
      themeContrast: 0,
      isFirefox: false,
      ...input.context?.root,
    };
    const organizationContext = {
      organizations: [organization], organization, project, environment, regions: [],
      isImpersonating: false,
      currentPlan: { v3Subscription: { isPaying: true, plan: { title: "Fixture" } }, v3Usage: { hasExceededFreeTier: false, usagePercentage: 0 } },
      billingLimit: undefined,
      customDashboards: [], dashboardLimits: { used: 0, limit: 3 }, widgetLimitPerDashboard: 16,
      canManageBillingLimits: false, isUsingRbacPlugin: false, isUsingSsoPlugin: false,
      ...input.context?.organization,
    };
    window.__TRIGGER_FIDELITY_REFERENCE__ = {
      fixtureVersion: "nw-227-v1",
      context: { root, organization: organizationContext },
      canonicalUrl: (captureId: string) => input.canonicalUrls?.[captureId] ?? `/${captureId}`,
      load: ({ captureId, surface, state, phase }: { captureId: string; surface: string; state: string; phase: string }) => {
        if (state === "api-error") throw new Error("Deterministic Trigger reference error.");
        if (state === "not-found") throw new Response("Not found", { status: 404, statusText: "Not Found" });
        if ((state === "loading" || state === "stale-refresh") && phase === "refresh") return new Promise(() => {});
        if (!(captureId in input.loaders) && !(surface in input.loaders)) throw new Error(`Missing Trigger reference loader fixture: ${captureId}`);
        return structuredClone(input.loaders[captureId] ?? input.loaders[surface]);
      },
    };
  }, fixture);
}
