import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Page } from "@playwright/test";
import { PNG } from "pngjs";
import type { NormalizedAccessibilityNode } from "./accessibility";
import type { DiscoveryStep } from "./discovery";
import { captureExactStableObservation } from "./exact-observation";
import type { CapabilityOmissionRegion, DifferenceRegion, FrameworkExtensionRegion, PresenterExtensionRegion, RendererRasterizationElement, RendererRasterizationObservation, RendererRasterizationPresentation, RendererRasterizationRegion } from "./pixels";

type Rect = { x: number; y: number; width: number; height: number };
export type FrameworkExtensionDefinition = {
  id: string;
  category: "framework-extension";
  decision: string;
  acceptance: string;
  captures: string[];
  skylineSelector: string;
  skylineAccessibilitySelector?: string;
  triggerAnchorSelector: string;
  skylineAnchorSelector: string;
  accessibleRole: string;
  accessibleName: string;
  anchorAccessibleRole: string;
  anchorAccessibleName: string;
  measurements: Record<string, {
    relativeRect: Rect;
    computedStyleSha256: string;
    accessibilitySha256?: string;
    anchorRect: Rect;
    anchorComputedStyleSha256: string;
  }>;
};
export type PresenterExtensionDefinition = {
  id: string;
  category: "presenter-extension";
  decision: string;
  acceptance: string[];
  citations: string[];
  captures: string[];
  triggerSelector: string;
  skylineSelector: string;
  triggerAnchorSelector: string;
  skylineAnchorSelector: string;
  skylineAccessibleRole: string;
  skylineAccessibleName: string;
  anchorAccessibleRole: string;
  anchorAccessibleName: string;
  measurements: Record<string, PresenterExtensionMeasurement>;
};
export type PresenterExtensionMeasurement = {
  triggerRelativeRect: Rect;
  skylineRelativeRect: Rect;
  triggerComputedStyleSha256: string;
  skylineComputedStyleSha256: string;
  triggerAccessibilitySha256: string;
  skylineAccessibilitySha256: string;
  anchorRect: Rect;
  anchorComputedStyleSha256: string;
  anchorAccessibilitySha256: string;
  anchorAccessibleName: string;
};
export type CapabilityOmissionMeasurement = {
  triggerRect: Rect;
  skylineRect: Rect;
  triggerComputedStyleSha256: string;
  skylineComputedStyleSha256: string;
  triggerAccessibilitySha256: string;
  skylineAccessibilitySha256: string;
};
export type ProtectedSelectorCrop =
  | { status: "visible"; rect: Rect; screenshotSha256: string }
  | { status: "below-viewport" }
  | { status: "right-of-viewport" };
export type ProtectedSelectorMeasurement = {
  rect: Rect;
  computedStyleSha256: string;
  accessibilitySha256: string;
  crop: ProtectedSelectorCrop;
};
export const mobileProtectedSelectorViewport = { width: 390, height: 844 } as const;
export type ProtectedSelectorViewportPolicy = { allowBelowViewport?: true; allowRightOfViewport?: typeof mobileProtectedSelectorViewport };
type ProtectedSelectorCaptureContext = { capture?: string; permittedCaptures?: readonly string[] };
export type ProtectedSelectorDefinition = { id: string; application: "trigger" | "skyline"; selector: string } & ProtectedSelectorViewportPolicy;
export function skylineProtectedSelector(id: string, selector: string, policy: ProtectedSelectorViewportPolicy = {}): ProtectedSelectorDefinition {
  return { id, application: "skyline", selector, ...policy };
}
export type CapabilityOmissionDefinition = {
  id: string;
  category: "capability-omission";
  decision: string;
  acceptance: string[];
  citations: string[];
  captures: string[];
  selectorPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; skylineBoundary?: true }>;
  measurements: Record<string, Record<string, CapabilityOmissionMeasurement>>;
  protectedSelectors?: ProtectedSelectorDefinition[];
  protectedMeasurements?: Record<string, Record<string, ProtectedSelectorMeasurement>>;
};
export type BrandingIdentityElementMeasurement = {
  rect: Rect;
  computedStyleSha256: string;
  accessibilitySha256: string;
  crop: Extract<ProtectedSelectorCrop, { status: "visible" }>;
};
export type BrandingIdentityMeasurement = {
  identityPairs: Record<string, { trigger: BrandingIdentityElementMeasurement; skyline: BrandingIdentityElementMeasurement }>;
  navigation: { trigger: BrandingIdentityElementMeasurement; skyline: BrandingIdentityElementMeasurement };
  protectedPairs: Record<string, { trigger: BrandingIdentityElementMeasurement; skyline: BrandingIdentityElementMeasurement }>;
};
export type BrandingIdentityDefinition = {
  id: string;
  category: "branding-identity";
  decision: string;
  acceptance: string[];
  citations: string[];
  captures: string[];
  identityPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string }>;
  triggerNavigationSelector: string;
  skylineNavigationSelector: string;
  protectedPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; captures?: string[] }>;
  measurements: Record<string, BrandingIdentityMeasurement>;
};
export type BrandingIdentityObservation = {
  identityPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElementMeasurement; skyline: BrandingIdentityElementMeasurement }>;
  navigation: { triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElementMeasurement; skyline: BrandingIdentityElementMeasurement };
  protectedPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElementMeasurement; skyline: BrandingIdentityElementMeasurement }>;
};
type RendererRuntime = { browserVersion: string; platform: string; deviceScaleFactor: number; locale: string; timezone: string };
type Rgba = [number, number, number, number];
export type RendererRasterizationDefinition = {
  id: string;
  category: "renderer-rasterization";
  decision: string;
  acceptance: string[];
  citations: string[];
  captures: string[];
  triggerSelector: string;
  skylineSelector: string;
  environment: { chromiumRevision: string; chromiumVersion: string; architecture: string; deviceScaleFactor: number; locale: string; timezone: string };
  presentation: RendererRasterizationPresentation;
  pixels: Array<{ x: number; y: number; trigger: Rgba; skyline: Rgba }>;
  measurements: Record<string, { runtime: RendererRuntime; trigger: RendererRasterizationElement; skyline: RendererRasterizationElement }>;
  alternatives?: Array<{
    captures: string[];
    pixels: Array<{ x: number; y: number; trigger: Rgba; skyline: Rgba }>;
    triggerCropSha256: string;
  }>;
};
export type BreadcrumbRasterizationManifestDefinition = {
  id: "run-breadcrumb-rasterization";
  category: "renderer-rasterization";
  rendererKind: "breadcrumb";
  decision: "NW-216";
  acceptance: string[];
  citations: string[];
  policyFile: "tests/fidelity/breadcrumb-rasterization-policy.json";
  policySha256: string;
  captures: string[];
  measurements: Record<string, never>;
};
export type { RendererRasterizationObservation };
export type CapabilityOmissionObservation = {
  selectorPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; skylineBoundary?: true } & CapabilityOmissionMeasurement>;
  protectedSelectors?: Array<ProtectedSelectorDefinition & ProtectedSelectorMeasurement>;
};
export type AllowedDifferenceDefinition = FrameworkExtensionDefinition | PresenterExtensionDefinition | CapabilityOmissionDefinition | BrandingIdentityDefinition | RendererRasterizationDefinition | BreadcrumbRasterizationManifestDefinition;
export type AllowedDifferences = { regions: AllowedDifferenceDefinition[] };
export type FrameworkExtensionObservation = {
  skylineSelector: string;
  triggerAnchorSelector: string;
  skylineAnchorSelector: string;
  accessibleRole: string;
  accessibleName: string;
  rect: Rect;
  relativeRect: Rect;
  computedStyleSha256: string;
  accessibilitySha256: string;
  anchorRect: Rect;
  anchorComputedStyleSha256: string;
};
type ComputedStyleEntry = [string, string, string];
type ElementObservation = { rect: Rect; accessibleRole: string; accessibleName: string; computedStyleSha256: string; accessibilitySha256: string; computedStyle?: ComputedStyleEntry[] };
export type PresenterExtensionObservation = {
  triggerSelector: string;
  skylineSelector: string;
  triggerAnchorSelector: string;
  skylineAnchorSelector: string;
  skylineAccessibleRole: string;
  skylineAccessibleName: string;
  triggerRect: Rect;
  skylineRect: Rect;
} & PresenterExtensionMeasurement;

export async function observeDifferenceRegions(trigger: Page, skyline: Page, capture: string, manifest: AllowedDifferences): Promise<DifferenceRegion[]> {
  const definitions = applicableExtensionDefinitions(capture, manifest);
  const regions: DifferenceRegion[] = [];
  for (const definition of definitions) {
    if (definition.category === "renderer-rasterization") {
      const resolved = validateRendererRasterizationObservation(definition, await discoverRendererRasterizationObservation(trigger, skyline, definition, capture), capture);
      if (resolved.trigger.cropSha256 === resolved.skyline.cropSha256) continue;
      regions.push({
        kind: "renderer-rasterization",
        id: definition.id,
        observation: resolved,
        expected: { presentation: definition.presentation, ...definition.measurements[capture] },
        pixels: definition.pixels,
        alternatives: rendererRasterizationAlternativesForCapture(definition, capture),
      } satisfies RendererRasterizationRegion);
      continue;
    }
    if (definition.category === "branding-identity") {
      const resolved = validateBrandingIdentityObservation(definition, await discoverBrandingIdentityObservation(trigger, skyline, definition, capture), capture);
      regions.push({ kind: "branding-identity", id: definition.id, identityPairs: resolved.identityPairs, navigation: resolved.navigation, protectedPairs: resolved.protectedPairs, expected: definition.measurements[capture] });
      continue;
    }
    if (definition.category === "framework-extension") {
      const resolved = validateFrameworkExtensionObservation(definition, await discoverFrameworkExtensionObservation(trigger, skyline, definition), capture);
      regions.push({ kind: "framework-extension", id: definition.id, extension: resolved, expected: { ...definition, ...definition.measurements[capture] } } satisfies FrameworkExtensionRegion);
      continue;
    }
    if (definition.category === "presenter-extension") {
      const resolved = validatePresenterExtensionObservation(definition, await discoverPresenterExtensionObservation(trigger, skyline, definition, capture), capture);
      regions.push({ kind: "presenter-extension", id: definition.id, presenter: resolved, expected: { ...definition, ...definition.measurements[capture] } } satisfies PresenterExtensionRegion);
      continue;
    }
    const resolved = validateCapabilityOmissionObservation(definition, await discoverCapabilityOmissionObservation(trigger, skyline, definition, capture), capture);
    regions.push({ kind: "capability-omission", id: definition.id, omissions: resolved.selectorPairs, protectedSelectors: resolved.protectedSelectors ?? [], expected: definition.measurements[capture], expectedProtected: definition.protectedMeasurements?.[capture] ?? {} } satisfies CapabilityOmissionRegion);
  }
  return regions;
}

export async function waitForDifferenceRegions(trigger: Page, skyline: Page, capture: string, manifest: AllowedDifferences) {
  const waits: Promise<void>[] = [];
  for (const definition of applicableExtensionDefinitions(capture, manifest)) {
    if (definition.category === "renderer-rasterization") {
      waits.push(trigger.locator(definition.triggerSelector).first().waitFor({ state: "attached" }));
      waits.push(skyline.locator(definition.skylineSelector).first().waitFor({ state: "attached" }));
      continue;
    }
    if (definition.category === "branding-identity") {
      for (const pair of definition.identityPairs) {
        waits.push(trigger.locator(pair.triggerSelector).first().waitFor({ state: "attached" }));
        waits.push(skyline.locator(pair.skylineSelector).first().waitFor({ state: "attached" }));
      }
      waits.push(trigger.locator(definition.triggerNavigationSelector).first().waitFor({ state: "attached" }));
      waits.push(skyline.locator(definition.skylineNavigationSelector).first().waitFor({ state: "attached" }));
      for (const pair of applicableBrandingProtectedPairs(definition, capture)) {
        waits.push(trigger.locator(pair.triggerSelector).first().waitFor({ state: "attached" }));
        waits.push(skyline.locator(pair.skylineSelector).first().waitFor({ state: "attached" }));
      }
      continue;
    }
    if (definition.category === "framework-extension") {
      waits.push(trigger.locator(definition.triggerAnchorSelector).first().waitFor({ state: "attached" }));
      waits.push(skyline.locator(definition.skylineAnchorSelector).first().waitFor({ state: "attached" }));
      waits.push(skyline.locator(definition.skylineSelector).first().waitFor({ state: "attached" }));
      continue;
    }
    if (definition.category === "presenter-extension") {
      waits.push(trigger.locator(definition.triggerAnchorSelector).first().waitFor({ state: "attached" }));
      waits.push(trigger.locator(definition.triggerSelector).first().waitFor({ state: "attached" }));
      waits.push(skyline.locator(definition.skylineAnchorSelector).first().waitFor({ state: "attached" }));
      waits.push(skyline.locator(definition.skylineSelector).first().waitFor({ state: "attached" }));
      continue;
    }
    for (const pair of definition.selectorPairs) {
      waits.push(trigger.locator(pair.triggerSelector).first().waitFor({ state: "attached" }));
      waits.push(skyline.locator(pair.skylineSelector).first().waitFor({ state: "attached" }));
    }
    for (const protectedSelector of definition.protectedSelectors ?? []) {
      const page = protectedSelector.application === "trigger" ? trigger : skyline;
      waits.push(page.locator(protectedSelector.selector).first().waitFor({ state: "attached" }));
    }
  }
  await Promise.all(waits);
}

export async function discoverBrandingIdentityObservation(trigger: Page, skyline: Page, definition: BrandingIdentityDefinition, capture: string, diagnosticStep?: DiscoveryStep): Promise<BrandingIdentityObservation> {
  return (await captureStableBrandingIdentityObservation(trigger, skyline, definition, capture, diagnosticStep)).observation;
}

type BrandingIdentityElementSnapshot = Omit<BrandingIdentityElementMeasurement, "crop">;
type BrandingIdentitySnapshot = {
  identityPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElementSnapshot; skyline: BrandingIdentityElementSnapshot }>;
  navigation: { triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElementSnapshot; skyline: BrandingIdentityElementSnapshot };
  protectedPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElementSnapshot; skyline: BrandingIdentityElementSnapshot }>;
};

export async function captureStableBrandingIdentityObservation(
  trigger: Page,
  skyline: Page,
  definition: BrandingIdentityDefinition,
  capture: string,
  diagnosticStep?: DiscoveryStep,
  captureScreenshots?: () => Promise<{ triggerScreenshot: Buffer; skylineScreenshot: Buffer }>,
) {
  if (!definition.captures.includes(capture)) throw new Error(`Branding identity ${definition.id} does not permit capture ${capture}.`);
  const step: DiscoveryStep = diagnosticStep ?? ((_label, action) => action());
  const { observation, artifact } = await captureExactStableObservation({
    label: `Branding identity ${definition.id} ${capture}`,
    read: () => observeBrandingIdentitySnapshot(trigger, skyline, definition, capture, step),
    capture: captureScreenshots ?? (async () => {
      const [triggerScreenshot, skylineScreenshot] = await Promise.all([
        step("branding:screenshot:trigger", () => trigger.screenshot({ animations: "disabled", caret: "hide" })),
        step("branding:screenshot:skyline", () => skyline.screenshot({ animations: "disabled", caret: "hide" })),
      ]);
      return { triggerScreenshot, skylineScreenshot };
    }),
    advance: () => advanceObservationFrame(trigger, skyline),
  });
  return {
    observation: addBrandingIdentityCrops(observation, artifact.triggerScreenshot, artifact.skylineScreenshot, trigger, skyline, definition.id),
    ...artifact,
  };
}

async function observeBrandingIdentitySnapshot(trigger: Page, skyline: Page, definition: BrandingIdentityDefinition, capture: string, step: DiscoveryStep): Promise<BrandingIdentitySnapshot> {
  const observe = async (page: Page, selector: string, label: string): Promise<BrandingIdentityElementSnapshot> => {
    const dom = await step(`branding:dom:${label}`, () => observeElementDom(page, definition.id, selector, label));
    const element = await step(`branding:ax:${label}`, () => observeCapabilityElementAccessibility(page, selector, dom));
    validateProtectedElementPresentation(definition.id, label, element);
    return { rect: element.rect, computedStyleSha256: element.computedStyleSha256, accessibilitySha256: element.accessibilitySha256 };
  };
  const identityPairs = [];
  for (const pair of definition.identityPairs) identityPairs.push({
    ...pair,
    trigger: await observe(trigger, pair.triggerSelector, `${pair.id}:trigger`),
    skyline: await observe(skyline, pair.skylineSelector, `${pair.id}:skyline`),
  });
  const protectedPairs = [];
  for (const pair of applicableBrandingProtectedPairs(definition, capture)) protectedPairs.push({
    ...pair,
    trigger: await observe(trigger, pair.triggerSelector, `${pair.id}:protected:trigger`),
    skyline: await observe(skyline, pair.skylineSelector, `${pair.id}:protected:skyline`),
  });
  return {
    identityPairs,
    navigation: {
      triggerSelector: definition.triggerNavigationSelector,
      skylineSelector: definition.skylineNavigationSelector,
      trigger: await observe(trigger, definition.triggerNavigationSelector, "navigation:trigger"),
      skyline: await observe(skyline, definition.skylineNavigationSelector, "navigation:skyline"),
    },
    protectedPairs,
  };
}

function addBrandingIdentityCrops(snapshot: BrandingIdentitySnapshot, triggerScreenshot: Buffer, skylineScreenshot: Buffer, trigger: Page, skyline: Page, id: string): BrandingIdentityObservation {
  const add = (element: BrandingIdentityElementSnapshot, screenshot: Buffer, page: Page, label: string): BrandingIdentityElementMeasurement => {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error(`Branding identity ${id} requires a fixed viewport.`);
    const crop = captureProtectedElementCrop(screenshot, viewport, element.rect);
    if (crop.status !== "visible") throw new Error(`Branding identity ${id} ${label} is outside the viewport.`);
    return { ...element, crop };
  };
  const pair = <T extends { trigger: BrandingIdentityElementSnapshot; skyline: BrandingIdentityElementSnapshot }>(value: T, label: string) => ({
    ...value,
    trigger: add(value.trigger, triggerScreenshot, trigger, `${label}:trigger`),
    skyline: add(value.skyline, skylineScreenshot, skyline, `${label}:skyline`),
  });
  return {
    identityPairs: snapshot.identityPairs.map((value) => pair(value, value.id)),
    navigation: pair(snapshot.navigation, "navigation"),
    protectedPairs: snapshot.protectedPairs.map((value) => pair(value, `${value.id}:protected`)),
  };
}

async function advanceObservationFrame(trigger: Page, skyline: Page) {
  await Promise.all([
    trigger.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))),
    skyline.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))),
  ]);
}

export function validateBrandingIdentityObservation(definition: BrandingIdentityDefinition, observation: BrandingIdentityObservation, capture: string) {
  const expected = definition.measurements[capture];
  if (!expected) throw new Error(`Allowed region ${definition.id} lacks measurement for ${capture}.`);
  if (observation.identityPairs.length !== definition.identityPairs.length) throw new Error(`Allowed region ${definition.id} changed identity pair count.`);
  for (const [index, pair] of definition.identityPairs.entries()) {
    const observed = observation.identityPairs[index];
    const measurement = expected.identityPairs[pair.id];
    if (!observed || !measurement || observed.id !== pair.id || observed.triggerSelector !== pair.triggerSelector || observed.skylineSelector !== pair.skylineSelector) throw new Error(`Allowed region ${definition.id} changed identity pair ${pair.id}.`);
    if (JSON.stringify({ trigger: observed.trigger, skyline: observed.skyline }) !== JSON.stringify(measurement)) throw new Error(`Allowed region ${definition.id} changed identity pair ${pair.id} evidence.`);
  }
  if (observation.navigation.triggerSelector !== definition.triggerNavigationSelector || observation.navigation.skylineSelector !== definition.skylineNavigationSelector) throw new Error(`Allowed region ${definition.id} changed protected navigation selectors.`);
  if (JSON.stringify({ trigger: observation.navigation.trigger, skyline: observation.navigation.skyline }) !== JSON.stringify(expected.navigation)) throw new Error(`Allowed region ${definition.id} changed protected navigation evidence.`);
  const protectedDefinitions = applicableBrandingProtectedPairs(definition, capture);
  if (observation.protectedPairs.length !== protectedDefinitions.length) throw new Error(`Allowed region ${definition.id} changed protected pair count.`);
  for (const [index, pair] of protectedDefinitions.entries()) {
    const observed = observation.protectedPairs[index];
    const measurement = expected.protectedPairs[pair.id];
    if (!observed || !measurement || observed.id !== pair.id || observed.triggerSelector !== pair.triggerSelector || observed.skylineSelector !== pair.skylineSelector) throw new Error(`Allowed region ${definition.id} changed protected pair ${pair.id}.`);
    if (JSON.stringify({ trigger: observed.trigger, skyline: observed.skyline }) !== JSON.stringify(measurement)) throw new Error(`Allowed region ${definition.id} changed protected pair ${pair.id} evidence.`);
  }
  validateBrandingIdentityReflow(definition.id, observation);
  return observation;
}

function applicableBrandingProtectedPairs(definition: BrandingIdentityDefinition, capture: string) {
  return definition.protectedPairs.filter((pair) => !pair.captures || pair.captures.includes(capture));
}

function validateBrandingIdentityReflow(id: string, observation: BrandingIdentityObservation) {
  const { trigger, skyline } = observation.navigation;
  if (trigger.rect.x !== skyline.rect.x || trigger.rect.width !== skyline.rect.width) throw new Error(`Allowed region ${id} changed navigation reflow corridor geometry.`);
  const identityDelta = observation.identityPairs.reduce((total, pair) => total + pair.trigger.rect.height - pair.skyline.rect.height, 0);
  if (trigger.rect.y - skyline.rect.y !== identityDelta) throw new Error(`Allowed region ${id} changed protected navigation reflow delta.`);
  for (const pair of observation.protectedPairs) {
    if (pair.trigger.rect.x !== pair.skyline.rect.x || pair.trigger.rect.width !== pair.skyline.rect.width || pair.trigger.rect.height !== pair.skyline.rect.height) throw new Error(`Allowed region ${id} changed protected ${pair.id} geometry.`);
    if (pair.trigger.rect.y - pair.skyline.rect.y !== identityDelta) throw new Error(`Allowed region ${id} changed protected ${pair.id} reflow delta.`);
    if (pair.trigger.computedStyleSha256 !== pair.skyline.computedStyleSha256) throw new Error(`Allowed region ${id} changed protected ${pair.id} style.`);
    if (pair.trigger.accessibilitySha256 !== pair.skyline.accessibilitySha256) throw new Error(`Allowed region ${id} changed protected ${pair.id} accessibility.`);
    if (pair.trigger.crop.screenshotSha256 !== pair.skyline.crop.screenshotSha256) throw new Error(`Allowed region ${id} changed protected ${pair.id} pixels.`);
  }
}

export async function waitForStableElementStyle(page: Page, selector: string, options: { consecutiveFrames?: number; maxFrames?: number } = {}) {
  const consecutiveFrames = options.consecutiveFrames ?? 3;
  const maxFrames = options.maxFrames ?? 60;
  await page.locator(selector).waitFor({ state: "visible" });
  let previous: string | undefined;
  let stableFrames = 0;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const sample = await page.evaluate((target) => {
      const matches = document.querySelectorAll(target);
      const element = matches.length === 1 ? matches[0] : null;
      if (!element) return { count: matches.length, attached: false, visible: false, signature: "" };
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const attached = element.isConnected;
      const visible = attached && rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
      const computedStyle = Array.from(style)
        .filter((property) => !property.startsWith("--"))
        .sort()
        .map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)]);
      return { count: matches.length, attached, visible, signature: JSON.stringify({ rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, computedStyle }) };
    }, selector);
    if (sample.count === 1 && sample.attached && sample.visible) {
      stableFrames = sample.signature === previous ? stableFrames + 1 : 1;
      previous = sample.signature;
      if (stableFrames >= consecutiveFrames) return;
    } else {
      previous = undefined;
      stableFrames = 0;
    }
    if (frame + 1 < maxFrames) await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
  throw new Error(`Element ${selector} did not reach stable computed style across ${consecutiveFrames} consecutive visible frames.`);
}

type StableElementSide = { label: string; page: Page; selector: string };

export async function settleStableElementPair(
  sides: readonly [StableElementSide, StableElementSide],
  settle: (page: Page) => Promise<void>,
  diagnosticStep?: DiscoveryStep,
) {
  const step: DiscoveryStep = diagnosticStep ?? ((_label, action) => action());
  await Promise.all(sides.map(({ label, page, selector }) => step(`presenter-stable-before-settle:${label}`, () => waitForStableElementStyle(page, selector))));
  await Promise.all(sides.map(({ label, page }) => step(`settle:${label}`, () => settle(page))));
  await Promise.all(sides.map(({ label, page, selector }) => step(`presenter-stable-after-settle:${label}`, () => waitForStableElementStyle(page, selector))));
}

export async function discoverCapabilityOmissionObservation(trigger: Page, skyline: Page, definition: CapabilityOmissionDefinition, capture: string): Promise<CapabilityOmissionObservation> {
  if (!definition.captures.includes(capture)) throw new Error(`Capability-omission region ${definition.id} does not permit capture ${capture}.`);
  const dom = [];
  for (const pair of definition.selectorPairs) {
    dom.push({
      pair,
      trigger: await observeElementDom(trigger, definition.id, pair.triggerSelector, `${pair.id} Trigger capability`),
      skyline: await observeElementDom(skyline, definition.id, pair.skylineSelector, `${pair.id} Skyline capability`),
    });
  }
  const selectorPairs = [];
  for (const observation of dom) {
    const triggerElement = await observeCapabilityElementAccessibility(trigger, observation.pair.triggerSelector, observation.trigger);
    const skylineElement = await observeCapabilityElementAccessibility(skyline, observation.pair.skylineSelector, observation.skyline);
    selectorPairs.push({
      ...observation.pair,
      triggerRect: triggerElement.rect,
      skylineRect: skylineElement.rect,
      triggerComputedStyleSha256: triggerElement.computedStyleSha256,
      skylineComputedStyleSha256: skylineElement.computedStyleSha256,
      triggerAccessibilitySha256: triggerElement.accessibilitySha256,
      skylineAccessibilitySha256: skylineElement.accessibilitySha256,
    });
  }
  const protectedSelectors = [];
  for (const protectedSelector of definition.protectedSelectors ?? []) {
    const page = protectedSelector.application === "trigger" ? trigger : skyline;
    const dom = await observeElementDom(page, definition.id, protectedSelector.selector, `${protectedSelector.id} protected selector`);
    const element = await observeCapabilityElementAccessibility(page, protectedSelector.selector, dom);
    validateProtectedElementPresentation(definition.id, protectedSelector.id, element);
    protectedSelectors.push({ ...protectedSelector, ...element, crop: undefined as unknown as ProtectedSelectorCrop });
  }
  const captureContext = { capture, permittedCaptures: definition.captures };
  for (const application of ["trigger", "skyline"] as const) {
    const page = application === "trigger" ? trigger : skyline;
    const applicationSelectors = protectedSelectors.filter((selector) => selector.application === application);
    if (applicationSelectors.length === 0) continue;
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Protected selector requires a fixed viewport.");
    const hasVisibleCrop = applicationSelectors.some((selector) => protectedSelectorCropStatus(viewport, selector.rect, selector, captureContext) === "visible");
    const screenshot = hasVisibleCrop ? await page.screenshot({ animations: "disabled", caret: "hide" }) : undefined;
    for (const protectedSelector of applicationSelectors) protectedSelector.crop = captureProtectedElementCrop(screenshot, viewport, protectedSelector.rect, protectedSelector, captureContext);
  }
  return { selectorPairs, protectedSelectors };
}

type RendererDetailsPageResult = {
  count: number;
  observation: null | {
    canonicalDom: unknown;
    semanticDom: unknown;
    matchingRules: unknown[];
    effectiveMatchingRules: unknown[];
    backdrop: { color: string };
    presentation: RendererRasterizationPresentation;
  };
};

export function observeRendererDetailsInPage(input: { target: string }): RendererDetailsPageResult {
  const matchingEffectiveSelectors = (selectorText: string, matches: (selector: string) => boolean) => {
    const selectors: string[] = [];
    let start = 0;
    let parentheses = 0;
    let brackets = 0;
    let quote: "'" | '"' | undefined;
    let escaped = false;
    for (let index = 0; index < selectorText.length; index += 1) {
      const character = selectorText[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (character === quote) quote = undefined;
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "(") parentheses += 1;
      else if (character === ")") parentheses = Math.max(0, parentheses - 1);
      else if (character === "[") brackets += 1;
      else if (character === "]") brackets = Math.max(0, brackets - 1);
      else if (character === "," && parentheses === 0 && brackets === 0) {
        selectors.push(selectorText.slice(start, index).trim());
        start = index + 1;
      }
    }
    selectors.push(selectorText.slice(start).trim());
    return selectors.filter((selector) => {
      if (!selector) return false;
      try { return matches(selector); } catch { return false; }
    }).sort();
  };

  const matches = document.querySelectorAll(input.target);
  if (matches.length !== 1) return { count: matches.length, observation: null };
  const element = matches[0] as HTMLElement;
  const canonicalAttributes = (node: Element, omitClass = false) => Array.from(node.attributes)
    .filter(({ name }) => !omitClass || name !== "class")
    .map(({ name, value }) => {
      if (name === "class") return [name, value.split(/\s+/).filter(Boolean).sort().join(" ")];
      if (name === "style") return [name, Array.from((node as HTMLElement).style).sort().map((property) => [property, (node as HTMLElement).style.getPropertyValue(property), (node as HTMLElement).style.getPropertyPriority(property)])];
      return [name, value];
    })
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  const canonicalNode = (node: Node): unknown => node.nodeType === Node.TEXT_NODE
    ? ["#text", node.textContent]
    : node.nodeType === Node.ELEMENT_NODE
      ? [(node as Element).tagName.toLowerCase(), canonicalAttributes(node as Element), Array.from(node.childNodes).map(canonicalNode)]
      : [node.nodeName, node.textContent];
  const standardStyle = (node: Element) => {
    const style = getComputedStyle(node);
    return Array.from(style).filter((property) => !property.startsWith("--")).sort()
      .map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)]);
  };
  const canonicalSemanticNode = (node: Node): unknown => {
    if (node.nodeType === Node.TEXT_NODE) return ["#text", node.textContent];
    if (node.nodeType !== Node.ELEMENT_NODE) return [node.nodeName, node.textContent];
    const child = node as Element;
    if (child.matches("span.token")) return ["#token", standardStyle(child), child.textContent];
    const children: unknown[] = [];
    for (const canonicalChild of Array.from(child.childNodes).map(canonicalSemanticNode)) {
      const previous = children.at(-1);
      if (Array.isArray(previous) && Array.isArray(canonicalChild)
        && previous[0] === "#token" && canonicalChild[0] === "#token"
        && JSON.stringify(previous[1]) === JSON.stringify(canonicalChild[1])) {
        previous[2] = `${String(previous[2])}${String(canonicalChild[2])}`;
      } else children.push(canonicalChild);
    }
    return [child.tagName.toLowerCase(), canonicalAttributes(child), children];
  };
  const declarations = (style: CSSStyleDeclaration, includeCustomProperties: boolean) => Array.from(style)
    .filter((property) => includeCustomProperties || !property.startsWith("--"))
    .sort().map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)]);
  const matchingRules: unknown[] = [];
  const effectiveMatchingRules: unknown[] = [];
  const visitRules = (rules: CSSRuleList, conditions: string[] = []) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const matchedSelectors = matchingEffectiveSelectors(rule.selectorText, (selector) => element.matches(selector.replace(/::[\w-]+(?:\([^)]*\))?/g, "")));
        if (matchedSelectors.length) {
          matchingRules.push([conditions, rule.selectorText, declarations(rule.style, true)]);
          effectiveMatchingRules.push([conditions, matchedSelectors, declarations(rule.style, false)]);
        }
      } else if ("cssRules" in rule) {
        const header = rule.cssText.slice(0, rule.cssText.indexOf("{")).trim();
        try { visitRules((rule as CSSGroupingRule).cssRules, [...conditions, header]); } catch { /* inaccessible rules cannot style the local fixture */ }
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { visitRules(sheet.cssRules); } catch { /* no cross-origin fixture styles */ }
  }
  const style = getComputedStyle(element);
  let backdropColor = "rgba(0, 0, 0, 0)";
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const candidate = getComputedStyle(ancestor).backgroundColor;
    if (candidate !== "rgba(0, 0, 0, 0)" && candidate !== "transparent") {
      backdropColor = candidate;
      break;
    }
  }
  return {
    count: matches.length,
    observation: {
      canonicalDom: canonicalNode(element),
      semanticDom: canonicalSemanticNode(element),
      matchingRules,
      effectiveMatchingRules,
      backdrop: { color: backdropColor },
      presentation: {
        borderColor: style.borderTopColor,
        backgroundColor: style.backgroundColor,
        backdropColor,
        borderRadius: style.borderTopLeftRadius,
      },
    },
  };
}

export async function discoverRendererRasterizationObservation(trigger: Page, skyline: Page, definition: RendererRasterizationDefinition, capture: string): Promise<RendererRasterizationObservation> {
  if (!definition.captures.includes(capture)) throw new Error(`Renderer rasterization ${definition.id} does not permit capture ${capture}.`);
  const runtimeFor = async (page: Page): Promise<RendererRuntime> => ({
    browserVersion: page.context().browser()?.version() ?? "",
    ...await page.evaluate(() => ({
      platform: navigator.platform,
      deviceScaleFactor: devicePixelRatio,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })),
  });
  const [triggerRuntime, skylineRuntime] = await Promise.all([
    runtimeFor(trigger),
    runtimeFor(skyline),
  ]);
  const triggerScreenshot = await trigger.screenshot({ animations: "disabled", caret: "hide" });
  const skylineScreenshot = await skyline.screenshot({ animations: "disabled", caret: "hide" });
  if (JSON.stringify(triggerRuntime) !== JSON.stringify(skylineRuntime)) throw new Error(`Renderer rasterization ${definition.id} changed cross-side runtime.`);

  const observe = async (page: Page, screenshot: Buffer, selector: string, application: "trigger" | "skyline") => {
    const dom = await observeElementDom(page, definition.id, selector, `${application} renderer surface`);
    validateProtectedElementPresentation(definition.id, `${application} renderer surface`, dom);
    const accessibilitySha256 = await fingerprintCapabilityAccessibility(page.locator(selector));
    const details = await page.evaluate<RendererDetailsPageResult, { target: string }>(observeRendererDetailsInPage, { target: selector });
    requireSingleMatch(details.count, definition.id, `${application} renderer details`);
    if (!details.observation) throw new Error(`Renderer rasterization ${definition.id} lacks ${application} renderer details.`);

    const session = await page.context().newCDPSession(page);
    let boxModel: unknown;
    let quads: unknown;
    try {
      await session.send("DOM.enable");
      const document = await session.send("DOM.getDocument") as { root: { nodeId: number } };
      const match = await session.send("DOM.querySelector", { nodeId: document.root.nodeId, selector }) as { nodeId: number };
      if (!match.nodeId) throw new Error(`Renderer rasterization ${definition.id} lost ${application} selector.`);
      boxModel = await session.send("DOM.getBoxModel", { nodeId: match.nodeId });
      quads = await session.send("DOM.getContentQuads", { nodeId: match.nodeId });
    } finally {
      await session.detach();
    }
    const viewport = page.viewportSize();
    if (!viewport) throw new Error(`Renderer rasterization ${definition.id} requires a fixed viewport.`);
    const crop = captureProtectedElementCrop(screenshot, viewport, dom.rect);
    if (crop.status !== "visible") throw new Error(`Renderer rasterization ${definition.id} surface is outside the viewport.`);
    return {
      element: {
        selector,
        rect: dom.rect,
        computedStyleSha256: dom.computedStyleSha256,
        accessibilitySha256,
        domSha256: digest(details.observation.canonicalDom),
        semanticDomSha256: digest(details.observation.semanticDom),
        cssRulesSha256: digest(details.observation.matchingRules),
        effectiveCssRulesSha256: digest(details.observation.effectiveMatchingRules),
        boxModelSha256: digest(boxModel),
        quadsSha256: digest(quads),
        backdropSha256: digest(details.observation.backdrop),
        cropSha256: crop.screenshotSha256,
      },
      presentation: details.observation.presentation,
    };
  };
  const [triggerEvidence, skylineEvidence] = await Promise.all([
    observe(trigger, triggerScreenshot, definition.triggerSelector, "trigger"),
    observe(skyline, skylineScreenshot, definition.skylineSelector, "skyline"),
  ]);
  if (JSON.stringify(triggerEvidence.presentation) !== JSON.stringify(skylineEvidence.presentation)) throw new Error(`Renderer rasterization ${definition.id} changed cross-side presentation.`);
  return { runtime: triggerRuntime, presentation: triggerEvidence.presentation, trigger: triggerEvidence.element, skyline: skylineEvidence.element };
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateCapabilityOmissionObservation(definition: CapabilityOmissionDefinition, observation: CapabilityOmissionObservation, capture: string) {
  const measurement = definition.measurements[capture];
  if (!measurement) throw new Error(`Allowed region ${definition.id} lacks measurement for ${capture}.`);
  if (observation.selectorPairs.length !== definition.selectorPairs.length) throw new Error(`Allowed region ${definition.id} changed selector pair count.`);
  for (const [index, pair] of definition.selectorPairs.entries()) {
    const observed = observation.selectorPairs[index];
    const expected = measurement[pair.id];
    if (!observed || !expected || observed.id !== pair.id || observed.triggerSelector !== pair.triggerSelector || observed.skylineSelector !== pair.skylineSelector || observed.skylineBoundary !== pair.skylineBoundary) throw new Error(`Allowed region ${definition.id} changed selector pair ${pair.id}.`);
    for (const key of ["triggerRect", "skylineRect", "triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256"] as const) {
      if (JSON.stringify(observed[key]) !== JSON.stringify(expected[key])) throw new Error(`Allowed region ${definition.id} pair ${pair.id} changed ${key}.`);
    }
  }
  const protectedDefinitions = definition.protectedSelectors ?? [];
  const protectedMeasurement = definition.protectedMeasurements?.[capture] ?? {};
  const observedProtected = observation.protectedSelectors ?? [];
  if (observedProtected.length !== protectedDefinitions.length) throw new Error(`Allowed region ${definition.id} changed protected selector count.`);
  for (const [index, protectedSelector] of protectedDefinitions.entries()) {
    const observed = observedProtected[index];
    const expected = protectedMeasurement[protectedSelector.id];
    if (!observed || !expected || observed.id !== protectedSelector.id || observed.application !== protectedSelector.application || observed.selector !== protectedSelector.selector) throw new Error(`Allowed region ${definition.id} changed protected selector ${protectedSelector.id}.`);
    for (const key of ["allowBelowViewport", "allowRightOfViewport"] as const) {
      if (JSON.stringify(observed[key]) !== JSON.stringify(protectedSelector[key])) throw new Error(`Allowed region ${definition.id} protected selector ${protectedSelector.id} changed ${key}.`);
    }
    for (const key of ["rect", "computedStyleSha256", "accessibilitySha256", "crop"] as const) {
      if (JSON.stringify(observed[key]) !== JSON.stringify(expected[key])) throw new Error(`Allowed region ${definition.id} protected selector ${protectedSelector.id} changed ${key}.`);
    }
  }
  return observation;
}

export function captureProtectedElementCrop(screenshot: Buffer | undefined, viewport: { width: number; height: number }, rect: Rect, policy: ProtectedSelectorViewportPolicy = {}, captureContext: ProtectedSelectorCaptureContext = {}): ProtectedSelectorCrop {
  const status = protectedSelectorCropStatus(viewport, rect, policy, captureContext);
  if (status !== "visible") return { status };
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const right = Math.min(viewport.width, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(viewport.height, Math.ceil(rect.y + rect.height));
  if (!screenshot) throw new Error("Visible protected selector lacks its viewport screenshot.");
  const png = PNG.sync.read(screenshot);
  if (png.width !== viewport.width || png.height !== viewport.height) throw new Error("Protected selector screenshot changed viewport geometry.");
  const width = right - x;
  const height = bottom - y;
  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) png.data.copy(pixels, row * width * 4, ((y + row) * png.width + x) * 4, ((y + row) * png.width + right) * 4);
  return { status, rect: { x, y, width, height }, screenshotSha256: createHash("sha256").update(`${width}x${height}\0`).update(pixels).digest("hex") };
}

export function validateProtectedElementPresentation(definitionId: string, selectorId: string, observation: { rect: Rect; computedStyle?: ComputedStyleEntry[] }) {
  if (!(observation.rect.width > 0 && observation.rect.height > 0)) throw new Error(`Allowed region ${definitionId} protected selector ${selectorId} has no positive box.`);
  const value = (property: string) => observation.computedStyle?.find(([name]) => name === property)?.[1];
  if (["display", "visibility", "opacity"].some((property) => value(property) === undefined) || value("display") === "none" || ["hidden", "collapse"].includes(value("visibility") ?? "") || value("content-visibility") === "hidden" || Number(value("opacity")) === 0) throw new Error(`Allowed region ${definitionId} protected selector ${selectorId} is not visibly painted.`);
}

function protectedSelectorCropStatus(viewport: { width: number; height: number }, rect: Rect, policy: ProtectedSelectorViewportPolicy = {}, captureContext: ProtectedSelectorCaptureContext = {}): ProtectedSelectorCrop["status"] {
  const { allowBelowViewport, allowRightOfViewport } = policy;
  if (rect.x >= viewport.width) {
    const { capture, permittedCaptures = [] } = captureContext;
    if (!allowRightOfViewport || viewport.width !== allowRightOfViewport.width || viewport.height !== allowRightOfViewport.height || !capture?.endsWith("@390x844-classic") || !permittedCaptures.includes(capture)) throw new Error("Protected selector is unexpectedly outside the viewport.");
    if (rect.y >= viewport.height && !allowBelowViewport) throw new Error("Protected selector is unexpectedly below the viewport.");
    if (rect.y < viewport.height && rect.y + rect.height <= 0) throw new Error("Protected selector is unexpectedly outside the viewport.");
    return "right-of-viewport";
  }
  if (rect.y >= viewport.height && rect.x < viewport.width && rect.x + rect.width > 0) {
    if (allowBelowViewport) return "below-viewport";
    throw new Error("Protected selector is unexpectedly below the viewport.");
  }
  const visible = rect.x < viewport.width && rect.x + rect.width > 0 && rect.y < viewport.height && rect.y + rect.height > 0;
  if (!visible) throw new Error("Protected selector is unexpectedly outside the viewport.");
  return "visible";
}

export type PresenterObservationStep = DiscoveryStep;

export async function discoverPresenterExtensionObservation(trigger: Page, skyline: Page, definition: PresenterExtensionDefinition, capture?: string, diagnosticStep?: PresenterObservationStep): Promise<PresenterExtensionObservation> {
  const step: PresenterObservationStep = diagnosticStep ?? ((_label, action) => action());
  const triggerPresenterDom = await step("trigger-presenter:dom", () => observeElementDom(trigger, definition.id, definition.triggerSelector, "Trigger presenter"));
  const triggerAnchorDom = await step("trigger-anchor:dom", () => observeElementDom(trigger, definition.id, definition.triggerAnchorSelector, "Trigger anchor"));
  const skylinePresenterDom = await step("skyline-presenter:dom", () => observeElementDom(skyline, definition.id, definition.skylineSelector, "Skyline presenter"));
  const skylineAnchorDom = await step("skyline-anchor:dom", () => observeElementDom(skyline, definition.id, definition.skylineAnchorSelector, "Skyline anchor"));
  const triggerPresenter = await step("trigger-presenter:ax", () => observeElementAccessibility(trigger, definition.triggerSelector, triggerPresenterDom));
  const triggerAnchor = await step("trigger-anchor:ax", () => observeElementAccessibility(trigger, definition.triggerAnchorSelector, triggerAnchorDom));
  const skylinePresenter = await step("skyline-presenter:ax", () => observeElementAccessibility(skyline, definition.skylineSelector, skylinePresenterDom));
  const skylineAnchor = await step("skyline-anchor:ax", () => observeElementAccessibility(skyline, definition.skylineAnchorSelector, skylineAnchorDom));
  const anchorAccessibleName = capture ? definition.measurements[capture]?.anchorAccessibleName ?? definition.anchorAccessibleName : definition.anchorAccessibleName;
  validatePairedAnchorIdentity({ ...definition, anchorAccessibleName }, triggerAnchor, skylineAnchor);
  if (triggerAnchor.accessibilitySha256 !== skylineAnchor.accessibilitySha256) throw new Error(`Allowed region ${definition.id} anchor changed accessibility.`);
  if (skylinePresenter.accessibleRole !== definition.skylineAccessibleRole || skylinePresenter.accessibleName !== definition.skylineAccessibleName) throw new Error(`Allowed region ${definition.id} changed Skyline accessible identity.`);
  return {
    triggerSelector: definition.triggerSelector,
    skylineSelector: definition.skylineSelector,
    triggerAnchorSelector: definition.triggerAnchorSelector,
    skylineAnchorSelector: definition.skylineAnchorSelector,
    skylineAccessibleRole: skylinePresenter.accessibleRole,
    skylineAccessibleName: skylinePresenter.accessibleName,
    triggerRect: triggerPresenter.rect,
    skylineRect: skylinePresenter.rect,
    triggerRelativeRect: relativeRect(triggerPresenter.rect, triggerAnchor.rect),
    skylineRelativeRect: relativeRect(skylinePresenter.rect, skylineAnchor.rect),
    triggerComputedStyleSha256: triggerPresenter.computedStyleSha256,
    skylineComputedStyleSha256: skylinePresenter.computedStyleSha256,
    triggerAccessibilitySha256: triggerPresenter.accessibilitySha256,
    skylineAccessibilitySha256: skylinePresenter.accessibilitySha256,
    anchorRect: skylineAnchor.rect,
    anchorComputedStyleSha256: skylineAnchor.computedStyleSha256,
    anchorAccessibilitySha256: skylineAnchor.accessibilitySha256,
    anchorAccessibleName: skylineAnchor.accessibleName,
  };
}

export function validatePresenterExtensionObservation(definition: PresenterExtensionDefinition, observation: PresenterExtensionObservation, capture: string) {
  const measurement = definition.measurements[capture];
  if (!measurement) throw new Error(`Allowed region ${definition.id} lacks measurement for ${capture}.`);
  for (const key of ["triggerSelector", "skylineSelector", "triggerAnchorSelector", "skylineAnchorSelector", "skylineAccessibleRole", "skylineAccessibleName"] as const) {
    if (observation[key] !== definition[key]) throw new Error(`Allowed region ${definition.id} changed ${key}.`);
  }
  for (const key of ["triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256", "anchorComputedStyleSha256", "anchorAccessibilitySha256", "anchorAccessibleName"] as const) {
    if (observation[key] !== measurement[key]) throw new Error(`Allowed region ${definition.id} changed ${key}.`);
  }
  for (const [label, key] of [["Trigger", "triggerRelativeRect"], ["Skyline", "skylineRelativeRect"]] as const) {
    if (JSON.stringify(observation[key]) !== JSON.stringify(measurement[key])) throw new Error(`Allowed region ${definition.id} changed ${label} anchor-relative geometry.`);
  }
  if (JSON.stringify(measurement.triggerRelativeRect) !== JSON.stringify(measurement.skylineRelativeRect)
    || JSON.stringify(observation.triggerRect) !== JSON.stringify(observation.skylineRect)) throw new Error(`Allowed region ${definition.id} changed cross-side geometry.`);
  if (JSON.stringify(observation.anchorRect) !== JSON.stringify(measurement.anchorRect)) throw new Error(`Allowed region ${definition.id} anchor changed locked geometry.`);
  for (const [label, rectKey, relativeKey] of [["Trigger", "triggerRect", "triggerRelativeRect"], ["Skyline", "skylineRect", "skylineRelativeRect"]] as const) {
    if (JSON.stringify(observation[rectKey]) !== JSON.stringify(absoluteRect(measurement[relativeKey], measurement.anchorRect))) throw new Error(`Allowed region ${definition.id} changed ${label} outer geometry.`);
  }
  return observation;
}

export async function discoverFrameworkExtensionObservation(trigger: Page, skyline: Page, definition: FrameworkExtensionDefinition, diagnosticStep?: DiscoveryStep): Promise<FrameworkExtensionObservation> {
  const step: DiscoveryStep = diagnosticStep ?? ((_label, action) => action());
  const [extension, triggerAnchor, skylineAnchor] = await Promise.all([
    step("element:skyline-extension", async () => {
      const observation = await observeElementDom(skyline, definition.id, definition.skylineSelector, "Skyline extension");
      const accessibilitySelector = await resolveFrameworkExtensionAccessibilitySelector(skyline, definition);
      return observeElementAccessibility(skyline, accessibilitySelector, observation, definition.skylineSelector);
    }),
    step("element:trigger-anchor", () => observeElement(trigger, definition.id, definition.triggerAnchorSelector, "Trigger anchor")),
    step("element:skyline-anchor", () => observeElement(skyline, definition.id, definition.skylineAnchorSelector, "Skyline anchor")),
  ]);
  validatePairedAnchorIdentity(definition, triggerAnchor, skylineAnchor);
  if (extension.accessibleRole !== definition.accessibleRole || extension.accessibleName !== definition.accessibleName) throw new Error(`Allowed region ${definition.id} changed accessible identity.`);
  return {
    skylineSelector: definition.skylineSelector,
    triggerAnchorSelector: definition.triggerAnchorSelector,
    skylineAnchorSelector: definition.skylineAnchorSelector,
    accessibleRole: extension.accessibleRole,
    accessibleName: extension.accessibleName,
    rect: extension.rect,
    relativeRect: { x: extension.rect.x - skylineAnchor.rect.x, y: extension.rect.y - skylineAnchor.rect.y, width: extension.rect.width, height: extension.rect.height },
    computedStyleSha256: extension.computedStyleSha256,
    accessibilitySha256: extension.accessibilitySha256,
    anchorRect: skylineAnchor.rect,
    anchorComputedStyleSha256: skylineAnchor.computedStyleSha256,
  };
}

export function validateFrameworkExtensionObservation(definition: FrameworkExtensionDefinition, observation: FrameworkExtensionObservation, capture: string) {
  const measurement = definition.measurements[capture];
  if (!measurement) throw new Error(`Allowed region ${definition.id} lacks measurement for ${capture}.`);
  for (const key of ["skylineSelector", "triggerAnchorSelector", "skylineAnchorSelector", "accessibleRole", "accessibleName"] as const) {
    if (observation[key] !== definition[key]) throw new Error(`Allowed region ${definition.id} changed ${key}.`);
  }
  for (const key of ["computedStyleSha256", "anchorComputedStyleSha256"] as const) {
    if (observation[key] !== measurement[key]) throw new Error(`Allowed region ${definition.id} changed ${key}.`);
  }
  if (measurement.accessibilitySha256 && observation.accessibilitySha256 !== measurement.accessibilitySha256) throw new Error(`Allowed region ${definition.id} changed accessibilitySha256.`);
  if (JSON.stringify(observation.relativeRect) !== JSON.stringify(measurement.relativeRect)) throw new Error(`Allowed region ${definition.id} changed anchor-relative geometry.`);
  if (JSON.stringify(observation.anchorRect) !== JSON.stringify(measurement.anchorRect)) throw new Error(`Allowed region ${definition.id} anchor changed locked geometry.`);
  return observation;
}

export function validatePairedAnchor(definition: FrameworkExtensionDefinition, trigger: ElementObservation, skyline: ElementObservation, capture: string) {
  const measurement = definition.measurements[capture];
  if (!measurement) throw new Error(`Allowed region ${definition.id} lacks measurement for ${capture}.`);
  validatePairedAnchorIdentity(definition, trigger, skyline);
  if (JSON.stringify(skyline.rect) !== JSON.stringify(measurement.anchorRect) || skyline.computedStyleSha256 !== measurement.anchorComputedStyleSha256) throw new Error(`Allowed region ${definition.id} anchor changed locked observation.`);
}

export function validatePairedAnchorIdentity(definition: FrameworkExtensionDefinition | PresenterExtensionDefinition, trigger: ElementObservation, skyline: ElementObservation) {
  if (JSON.stringify(trigger.rect) !== JSON.stringify(skyline.rect)) throw new Error(`Allowed region ${definition.id} anchor changed geometry.`);
  if (trigger.computedStyleSha256 !== skyline.computedStyleSha256) {
    const difference = firstStyleDifference(trigger.computedStyle, skyline.computedStyle);
    throw new Error(`Allowed region ${definition.id} anchor changed computed style${difference ? ` at ${difference}` : ""}.`);
  }
  if (trigger.accessibleRole !== definition.anchorAccessibleRole || skyline.accessibleRole !== definition.anchorAccessibleRole
    || trigger.accessibleName !== definition.anchorAccessibleName || skyline.accessibleName !== definition.anchorAccessibleName) throw new Error(`Allowed region ${definition.id} anchor changed accessible identity.`);
}

export function omitFrameworkExtensionAccessibility(tree: NormalizedAccessibilityNode | null, capture: string, manifest: AllowedDifferences) {
  const definitions = applicableFrameworkExtensions(capture, manifest);
  let omitted = 0;
  const visit = (node: NormalizedAccessibilityNode): NormalizedAccessibilityNode | null => {
    if (definitions.some((definition) => node.role === definition.accessibleRole && node.name === definition.accessibleName)) {
      omitted += 1;
      return null;
    }
    const children = node.children?.flatMap((child) => visit(child) ?? []) ?? [];
    return { ...node, children: children.length ? children : undefined };
  };
  const result = tree ? visit(tree) : null;
  if (omitted !== definitions.length) throw new Error(`Expected ${definitions.length} framework-extension AX node${definitions.length === 1 ? "" : "s"}; omitted ${omitted}.`);
  return result;
}

export function applicableFrameworkExtensions(capture: string, manifest: AllowedDifferences) {
  validateFrameworkExtensionDefinitions(manifest);
  return manifest.regions.filter((region): region is FrameworkExtensionDefinition => region.category === "framework-extension" && region.captures.includes(capture));
}

export function applicablePresenterExtensions(capture: string, manifest: AllowedDifferences) {
  validateFrameworkExtensionDefinitions(manifest);
  return manifest.regions.filter((region): region is PresenterExtensionDefinition => region.category === "presenter-extension" && region.captures.includes(capture));
}

export function applicableCapabilityOmissions(capture: string, manifest: AllowedDifferences) {
  validateFrameworkExtensionDefinitions(manifest);
  return manifest.regions.filter((region): region is CapabilityOmissionDefinition => region.category === "capability-omission" && region.captures.includes(capture));
}

function applicableExtensionDefinitions(capture: string, manifest: AllowedDifferences) {
  validateFrameworkExtensionDefinitions(manifest);
  return manifest.regions.filter((region): region is Exclude<AllowedDifferenceDefinition, BreadcrumbRasterizationManifestDefinition> => !isBreadcrumbRasterizationManifest(region) && region.captures.includes(capture));
}

export function accessibilityOmissionSelectors(regions: DifferenceRegion[], application: "trigger" | "skyline") {
  return regions.flatMap((region) => {
    if (region.kind === "branding-identity") return region.identityPairs.map((pair) => application === "trigger" ? pair.triggerSelector : pair.skylineSelector);
    if (region.kind === "framework-extension") return application === "skyline" ? [region.extension.skylineSelector] : [];
    if (region.kind === "presenter-extension") return [application === "trigger" ? region.expected.triggerSelector : region.expected.skylineSelector];
    if (region.kind === "capability-omission") return region.omissions.flatMap((pair) => application === "trigger" ? [pair.triggerSelector] : pair.skylineBoundary ? [] : [pair.skylineSelector]);
    return [];
  });
}

export function validateRendererRasterizationObservation(definition: RendererRasterizationDefinition, observation: RendererRasterizationObservation, capture: string) {
  if (!definition.captures.includes(capture)) throw new Error(`Renderer rasterization ${definition.id} does not permit capture ${capture}.`);
  const expected = definition.measurements[capture];
  if (!expected) throw new Error(`Renderer rasterization ${definition.id} lacks measurement for ${capture}.`);
  if (JSON.stringify(observation.runtime) !== JSON.stringify(expected.runtime)) throw new Error(`Renderer rasterization ${definition.id} changed runtime evidence.`);
  if (JSON.stringify(observation.presentation) !== JSON.stringify(definition.presentation)) throw new Error(`Renderer rasterization ${definition.id} changed presentation evidence.`);
  for (const application of ["trigger", "skyline"] as const) {
    const actual = observation[application];
    const recorded = expected[application];
    for (const [key, label] of [
      ["selector", "selector"],
      ["rect", "geometry"],
      ["computedStyleSha256", "style"],
      ["accessibilitySha256", "accessibility"],
      ["domSha256", "DOM"],
      ["semanticDomSha256", "semantic DOM"],
      ["cssRulesSha256", "CSS rules"],
      ["effectiveCssRulesSha256", "effective CSS rules"],
      ["boxModelSha256", "box model"],
      ["quadsSha256", "quads"],
      ["backdropSha256", "backdrop"],
    ] as const) if (JSON.stringify(actual[key]) !== JSON.stringify(recorded[key])) throw new Error(`Renderer rasterization ${definition.id} changed ${application} ${label}.`);
  }
  const approvedTriggerCrops = [expected.trigger.cropSha256, ...(definition.alternatives ?? []).filter((alternative) => alternative.captures.includes(capture)).map(({ triggerCropSha256 }) => triggerCropSha256)];
  const approvedCrop = approvedTriggerCrops.includes(observation.trigger.cropSha256)
    && observation.skyline.cropSha256 === expected.skyline.cropSha256;
  const inactive = observation.trigger.cropSha256 === observation.skyline.cropSha256;
  if (!inactive && !approvedCrop) throw new Error(`Renderer rasterization ${definition.id} changed exact crop evidence.`);
  for (const [key, label] of [
    ["rect", "geometry"],
    ["computedStyleSha256", "style"],
    ["accessibilitySha256", "accessibility"],
    ["semanticDomSha256", "semantic DOM"],
    ["effectiveCssRulesSha256", "effective CSS rules"],
    ["boxModelSha256", "box model"],
    ["quadsSha256", "quads"],
    ["backdropSha256", "backdrop"],
  ] as const) if (JSON.stringify(observation.trigger[key]) !== JSON.stringify(observation.skyline[key])) throw new Error(`Renderer rasterization ${definition.id} changed cross-side ${label}.`);
  return observation;
}

export function rendererRasterizationAlternativesForCapture(definition: RendererRasterizationDefinition, capture: string) {
  const measurement = definition.measurements[capture];
  if (!measurement) return [];
  return (definition.alternatives ?? []).filter((alternative) => alternative.captures.includes(capture)).map((alternative) => ({
    expected: { presentation: definition.presentation, ...measurement, trigger: { ...measurement.trigger, cropSha256: alternative.triggerCropSha256 } },
    pixels: alternative.pixels,
  }));
}

function validateRendererRasterizationDefinition(definition: RendererRasterizationDefinition) {
  const spec = rendererRasterizationDefinitionSpec(definition.id);
  if (!spec) throw new Error(`Renderer-rasterization region ${definition.id} changed approved metadata.`);
  for (const key of ["category", "decision", "acceptance", "citations", "captures", "triggerSelector", "skylineSelector", "environment", "presentation"] as const) {
    if (!isDeepStrictEqual(definition[key], spec[key])) throw new Error(`Renderer-rasterization region ${definition.id} changed approved metadata.`);
  }
  if (!isDeepStrictEqual(definition.pixels, spec.pixels)) throw new Error(`Renderer-rasterization region ${definition.id} changed exact pixel evidence.`);
  if (!isDeepStrictEqual(definition.measurements, spec.measurements)) throw new Error(`Renderer-rasterization region ${definition.id} changed exact measurement.`);
  if (!isDeepStrictEqual(definition.alternatives ?? [], spec.alternatives ?? [])) throw new Error(`Renderer-rasterization region ${definition.id} changed exact alternatives.`);
}

function rendererRasterizationDefinitionSpec(id: string): RendererRasterizationDefinition | undefined {
  const selector = ".text-text-dimmed > [translate='no']";
  const environment = { chromiumRevision: "1208", chromiumVersion: "145.0.7632.6", architecture: "x64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" };
  const runtime = { browserVersion: "145.0.7632.6", platform: "Linux x86_64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" };
  const originalCitations = [
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-af981c01",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-5f779354",
  ];
  const extensionCitations = [
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6938d6dc",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-9cebc0a5",
  ];
  const finalCitations = [
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-8170f6fc",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-e977cd30",
  ];
  const themeWideCitations = [
    ...finalCitations,
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-47dfd42d",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-6ad5551b",
  ];
  const staleRefreshCitations = [
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-ed21cf47",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-63aff661",
  ];
  const lightCitations = [
    ...extensionCitations,
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6b20c68e",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-86de4313",
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-27e039b2",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-721d1ae5",
    ...themeWideCitations,
  ];
  const classicCitations = [
    ...extensionCitations,
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-4d0553c1",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-299d4a96",
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
    ...themeWideCitations,
  ];
  const pixels6 = [
    { x: 3, y: 0, trigger: [29, 30, 35, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 3, y: 1, trigger: [33, 34, 38, 255], skyline: [33, 35, 39, 255] },
    { x: 4, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 2, y: 2, trigger: [31, 33, 37, 255], skyline: [31, 34, 38, 255] },
  ] as RendererRasterizationDefinition["pixels"];
  const pixels12 = [
    ...pixels6.slice(0, 2),
    { x: 350, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 352, y: 0, trigger: [29, 30, 34, 255], skyline: [29, 31, 35, 255] },
    ...pixels6.slice(2, 5),
    { x: 350, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 351, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 353, y: 1, trigger: [33, 34, 39, 255], skyline: [33, 35, 39, 255] },
    pixels6[5],
    { x: 353, y: 2, trigger: [32, 33, 38, 255], skyline: [32, 34, 38, 255] },
  ] as RendererRasterizationDefinition["pixels"];
  const pixels13 = [
    { x: 3, y: 0, trigger: [227, 227, 229, 255], skyline: [226, 227, 228, 255] },
    { x: 4, y: 0, trigger: [197, 198, 201, 255], skyline: [196, 198, 201, 255] },
    { x: 352, y: 0, trigger: [228, 229, 230, 255], skyline: [227, 228, 229, 255] },
    { x: 2, y: 1, trigger: [208, 209, 211, 255], skyline: [207, 208, 211, 255] },
    { x: 3, y: 1, trigger: [207, 208, 211, 255], skyline: [207, 208, 210, 255] },
    { x: 4, y: 1, trigger: [233, 234, 235, 255], skyline: [233, 233, 234, 255] },
    { x: 5, y: 1, trigger: [248, 248, 248, 255], skyline: [247, 247, 248, 255] },
    { x: 350, y: 1, trigger: [248, 248, 248, 255], skyline: [247, 247, 248, 255] },
    { x: 351, y: 1, trigger: [233, 233, 234, 255], skyline: [232, 233, 234, 255] },
    { x: 352, y: 1, trigger: [206, 207, 210, 255], skyline: [206, 207, 209, 255] },
    { x: 353, y: 1, trigger: [209, 210, 213, 255], skyline: [209, 210, 212, 255] },
    { x: 2, y: 2, trigger: [214, 215, 217, 255], skyline: [214, 214, 217, 255] },
    { x: 353, y: 2, trigger: [213, 214, 216, 255], skyline: [212, 214, 216, 255] },
  ] as RendererRasterizationDefinition["pixels"];
  const classicRight6 = [pixels12[2], pixels12[3], pixels12[7], pixels12[8], pixels12[9], pixels12[11]];
  const lightRight6 = [pixels13[2], pixels13[7], pixels13[8], pixels13[9], pixels13[10], pixels13[12]];
  const lightLeft7 = [pixels13[0], pixels13[1], pixels13[3], pixels13[4], pixels13[5], pixels13[6], pixels13[11]];
  const darkPixels13 = [
    { x: 3, y: 0, trigger: [34, 35, 38, 255], skyline: [35, 36, 39, 255] },
    { x: 4, y: 0, trigger: [54, 56, 59, 255], skyline: [55, 57, 60, 255] },
    { x: 5, y: 0, trigger: [63, 66, 69, 255], skyline: [64, 67, 70, 255] },
    { x: 350, y: 0, trigger: [63, 66, 69, 255], skyline: [64, 67, 70, 255] },
    { x: 351, y: 0, trigger: [54, 57, 59, 255], skyline: [54, 57, 60, 255] },
    { x: 2, y: 1, trigger: [47, 49, 52, 255], skyline: [48, 49, 52, 255] },
    { x: 3, y: 1, trigger: [47, 49, 52, 255], skyline: [48, 49, 52, 255] },
    { x: 4, y: 1, trigger: [32, 32, 35, 255], skyline: [31, 32, 35, 255] },
    { x: 5, y: 1, trigger: [22, 22, 26, 255], skyline: [22, 22, 25, 255] },
    { x: 350, y: 1, trigger: [22, 22, 26, 255], skyline: [22, 22, 25, 255] },
    { x: 351, y: 1, trigger: [32, 33, 36, 255], skyline: [32, 32, 35, 255] },
    { x: 353, y: 1, trigger: [46, 48, 51, 255], skyline: [47, 48, 51, 255] },
    { x: 2, y: 2, trigger: [43, 44, 48, 255], skyline: [43, 45, 48, 255] },
  ] as RendererRasterizationDefinition["pixels"];
  const darkRight5 = [darkPixels13[3], darkPixels13[4], darkPixels13[9], darkPixels13[10], darkPixels13[11]];
  const darkLeft8 = [darkPixels13[0], darkPixels13[1], darkPixels13[2], darkPixels13[5], darkPixels13[6], darkPixels13[7], darkPixels13[8], darkPixels13[12]];
  const definition = (captures: string[], acceptance: string[], citations: string[], presentation: RendererRasterizationPresentation, pixels: RendererRasterizationDefinition["pixels"], measurement: RendererRasterizationDefinition["measurements"][string]): RendererRasterizationDefinition => ({
    id, category: "renderer-rasterization", decision: "NW-216", acceptance, citations, captures, triggerSelector: selector, skylineSelector: selector, environment, presentation, pixels,
    measurements: Object.fromEntries(captures.map((capture) => [capture, structuredClone(measurement)])),
  });
  if (id === "error-codeblock-corner-rasterization") {
    const captures = ["error-found@1024x768-classic"];
    const shared = rendererRasterizationElementSpec(selector, { x: 656, y: 117, width: 356, height: 58 }, "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b", "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2", "206a05c0a410e6f813bf12948198abbb381269566b3f0e98b3d822e5cc599f83", "260e3e345b11618f2b4d6214d5941be3b01ae92dd3596e1efe87db8d707fafd7", "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9");
    const approved = definition(captures, ["Only exact Classic full twelve-pixel, left-edge six-pixel, or right-edge six-pixel antialias states may differ for this exact capture; zero activates no exception and every other pixel and semantic remains exact."], [...originalCitations, ...themeWideCitations], { borderColor: "rgb(39, 42, 46)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(26, 27, 31)", borderRadius: "6px" }, pixels6, rendererRasterizationMeasurementSpec(runtime, shared, "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50", "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a"));
    approved.alternatives = [{ captures, pixels: pixels12, triggerCropSha256: "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6" }, { captures, pixels: classicRight6, triggerCropSha256: "02739f305658911a62964055dc2ba83eeda901548260509bab81c98547231431" }];
    return approved;
  }
  if (id === "error-codeblock-classic-rasterization") {
    const captures = ["error-found@1440x960-classic", "errors-affected-job-types@1440x960-classic", "errors-application-vendor-frames@1440x960-classic", "errors-linked-runs@1440x960-classic", "errors-long-exception@1440x960-classic", "errors-many-occurrences@1440x960-classic", "errors-single-occurrence@1440x960-classic", "errors-stack-expansion@1440x960-classic"];
    const shared = rendererRasterizationElementSpec(selector, { x: 1072, y: 117, width: 356, height: 58 }, "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b", "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9");
    const approved = definition(captures, ["Only exact Classic full twelve-pixel, left-edge six-pixel, or right-edge six-pixel antialias states may differ across these exact captures; zero activates no exception and every other pixel and semantic remains exact."], classicCitations, { borderColor: "rgb(39, 42, 46)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(26, 27, 31)", borderRadius: "6px" }, pixels12, rendererRasterizationMeasurementSpec(runtime, shared, "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6", "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a"));
    approved.alternatives = [{
      captures,
      pixels: pixels6,
      triggerCropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50",
    }, {
      captures,
      pixels: classicRight6,
      triggerCropSha256: "02739f305658911a62964055dc2ba83eeda901548260509bab81c98547231431",
    }];
    return approved;
  }
  if (id === "error-codeblock-classic-right-rasterization") {
    const captures = ["error-stale-refresh@1440x960-classic"];
    const shared = rendererRasterizationElementSpec(selector, { x: 1072, y: 117, width: 356, height: 58 }, "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b", "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9");
    const approved = definition(captures, ["Only exact Classic full twelve-pixel, left-edge six-pixel, or right-edge six-pixel antialias states may differ for this exact capture; zero activates no exception and every other pixel and semantic remains exact."], [...themeWideCitations, ...staleRefreshCitations], { borderColor: "rgb(39, 42, 46)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(26, 27, 31)", borderRadius: "6px" }, classicRight6, rendererRasterizationMeasurementSpec(runtime, shared, "02739f305658911a62964055dc2ba83eeda901548260509bab81c98547231431", "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a", "1e29b23f4fe5f7ed571dbeeb59a49105f0269d641ebf667853ac306d57495d98"));
    approved.alternatives = [{ captures, pixels: pixels12, triggerCropSha256: "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6" }, { captures, pixels: pixels6, triggerCropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50" }];
    return approved;
  }
  if (id === "error-codeblock-light-rasterization") {
    const captures = ["error-found@1440x960-light", "error-found@1440x960-system-light", "errors-affected-job-types@1440x960-light", "errors-application-vendor-frames@1440x960-light", "errors-linked-runs@1440x960-light", "errors-long-exception@1440x960-light", "errors-many-occurrences@1440x960-light", "errors-single-occurrence@1440x960-light", "errors-stack-expansion@1440x960-light"];
    const shared = rendererRasterizationElementSpec(selector, { x: 1072, y: 117, width: 356, height: 58 }, "6a8b83d2e8057045b6e96b0dac9fb7e569da5335379ed5a76f0f0ab01c569939", "ddeafe10e6831ec6dc1e62eab62f16fe3dfe68937cddcbb42c2fa96562d13096", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "ca33753c04b4519449c72aa01b71b3f6b8b2050a5c57ead95a3f5920d45460de");
    const measurement = rendererRasterizationMeasurementSpec(runtime, shared, "93768ec0233ea8b02028b19b7743d1d263219666ef23354eb3407f4c68759fa3", "a73802a7d3ac38e35d1bcd5119025c1818cae3d5dc9fdeafa69253aaa43332a8");
    const approved = definition(captures, ["Only exact Light full thirteen-pixel, right-edge six-pixel, or left-edge seven-pixel antialias states may differ across these exact captures; zero activates no exception and every other pixel and semantic remains exact."], lightCitations, { borderColor: "color(srgb 0.687749 0.693835 0.709051)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(255, 255, 255)", borderRadius: "6px" }, pixels13, measurement);
    approved.alternatives = [{
      captures,
      pixels: lightRight6,
      triggerCropSha256: "be64f3b53c93b4cc7145fb081f717e2b75becf66632a727985b68a57f3537864",
    }, {
      captures,
      pixels: lightLeft7,
      triggerCropSha256: "f5bba6c913b6a01d71f7926ac77447c974b40961a3ac51fb9f27bc979d95f1b5",
    }];
    return approved;
  }
  if (id === "error-codeblock-light-right-rasterization") {
    const captures = ["error-stale-refresh@1440x960-light"];
    const shared = rendererRasterizationElementSpec(selector, { x: 1072, y: 117, width: 356, height: 58 }, "6a8b83d2e8057045b6e96b0dac9fb7e569da5335379ed5a76f0f0ab01c569939", "ddeafe10e6831ec6dc1e62eab62f16fe3dfe68937cddcbb42c2fa96562d13096", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "ca33753c04b4519449c72aa01b71b3f6b8b2050a5c57ead95a3f5920d45460de");
    const approved = definition(captures, ["Only exact Light full thirteen-pixel, right-edge six-pixel, or left-edge seven-pixel antialias states may differ for this exact capture; zero activates no exception and every other pixel and semantic remains exact."], [...themeWideCitations, ...staleRefreshCitations], { borderColor: "color(srgb 0.687749 0.693835 0.709051)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(255, 255, 255)", borderRadius: "6px" }, lightRight6, rendererRasterizationMeasurementSpec(runtime, shared, "be64f3b53c93b4cc7145fb081f717e2b75becf66632a727985b68a57f3537864", "a73802a7d3ac38e35d1bcd5119025c1818cae3d5dc9fdeafa69253aaa43332a8", "1e29b23f4fe5f7ed571dbeeb59a49105f0269d641ebf667853ac306d57495d98"));
    approved.alternatives = [{ captures, pixels: pixels13, triggerCropSha256: "93768ec0233ea8b02028b19b7743d1d263219666ef23354eb3407f4c68759fa3" }, { captures, pixels: lightLeft7, triggerCropSha256: "f5bba6c913b6a01d71f7926ac77447c974b40961a3ac51fb9f27bc979d95f1b5" }];
    return approved;
  }
  if (id === "error-codeblock-dark-rasterization") {
    const staleCapture = "error-stale-refresh@1440x960-dark";
    const priorCaptures = ["error-found@1440x960-dark", "error-found@1440x960-system-dark", "errors-affected-job-types@1440x960-dark", "errors-application-vendor-frames@1440x960-dark", "errors-linked-runs@1440x960-dark", "errors-long-exception@1440x960-dark", "errors-many-occurrences@1440x960-dark", "errors-single-occurrence@1440x960-dark", "errors-stack-expansion@1440x960-dark"];
    const captures = [...priorCaptures, staleCapture];
    const shared = rendererRasterizationElementSpec(selector, { x: 1072, y: 117, width: 356, height: 58 }, "1e958c4fe09cb4648dc66fc7033ad54e0390980460e99a0c6fd29b5a4d222986", "878844aaa73ad5cf97576bef440101116d5c846226f1a6e6a94e2ab114debb34", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "df218850753b506666ad2bcaa018b0bd1cf137690bab6b79070a93b80c59b10f");
    const approved = definition(captures, ["Only exact Dark full thirteen-pixel, left-edge eight-pixel, or right-edge five-pixel antialias states may differ across the prior captures; for stale-refresh only full thirteen-pixel or right-edge five-pixel states may differ; zero activates no exception and every other pixel and semantic remains exact."], [...themeWideCitations, ...staleRefreshCitations], { borderColor: "color(srgb 0.271529 0.281647 0.295137)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "color(srgb 0.0698431 0.0725294 0.0832745)", borderRadius: "6px" }, darkPixels13, rendererRasterizationMeasurementSpec(runtime, shared, "cc599cedd33e4bc2c41e5055c216ac59f08433a663dd7813ac5d4bf04d43e6f4", "fad6b57ad8b49208f509ecddb3d2a06b014a0be0c8853de81fc3248349b31984"));
    approved.measurements[staleCapture] = rendererRasterizationMeasurementSpec(runtime, shared, "cc599cedd33e4bc2c41e5055c216ac59f08433a663dd7813ac5d4bf04d43e6f4", "fad6b57ad8b49208f509ecddb3d2a06b014a0be0c8853de81fc3248349b31984", "1e29b23f4fe5f7ed571dbeeb59a49105f0269d641ebf667853ac306d57495d98");
    approved.alternatives = [{
      captures,
      pixels: darkRight5,
      triggerCropSha256: "306da89ee227424ffb06634852e7116cb4fee904905ef7ed0305a62eb0df8297",
    }, {
      captures: priorCaptures,
      pixels: darkLeft8,
      triggerCropSha256: "e093373e48bc2777d172b84f3f668f3bbbf4bc6c2b8ee2dff89906bc59892a62",
    }];
    return approved;
  }
}

function rendererRasterizationElementSpec(selector: string, rect: Rect, computedStyleSha256: string, semanticDomSha256: string, boxModelSha256: string, quadsSha256: string, backdropSha256: string) {
  return { selector, rect, computedStyleSha256, accessibilitySha256: "b6167fd697fd410afc0259efd4e09027849b730af8f4af8af77591758aac8d6b", semanticDomSha256, effectiveCssRulesSha256: "eeedce158bc50c514818266694318ab8eae3d60904294b427103c5bbff3eb901", boxModelSha256, quadsSha256, backdropSha256 };
}

function rendererRasterizationMeasurementSpec(runtime: RendererRuntime, shared: ReturnType<typeof rendererRasterizationElementSpec>, triggerCropSha256: string, skylineCropSha256: string, skylineCssRulesSha256 = "751946618b4985c6a59b86417e539771259f74e794c7e5ad67377c495f9202a4") {
  return {
    runtime,
    trigger: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "8d795f3af25b11056ed60507ccd2c8614e8cc4d469515688018b5b0f9dab47ba", cropSha256: triggerCropSha256 },
    skyline: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: skylineCssRulesSha256, cropSha256: skylineCropSha256 },
  };
}

export function validateFrameworkExtensionDefinitions(manifest: AllowedDifferences) {
  const breadcrumbs = manifest.regions.filter(isBreadcrumbRasterizationManifest);
  if (breadcrumbs.length > 1) throw new Error("Breadcrumb renderer requires one exact approved manifest region.");
  if (breadcrumbs[0]) validateBreadcrumbRasterizationManifest(breadcrumbs[0]);
  const frameworks = manifest.regions.filter((region): region is FrameworkExtensionDefinition => region.category === "framework-extension");
  const presenters = manifest.regions.filter((region): region is PresenterExtensionDefinition => region.category === "presenter-extension");
  const identities = manifest.regions.filter((region): region is BrandingIdentityDefinition => region.category === "branding-identity");
  const renderers = manifest.regions.filter((region): region is RendererRasterizationDefinition => region.category === "renderer-rasterization" && !isBreadcrumbRasterizationManifest(region));
  for (const renderer of renderers) validateRendererRasterizationDefinition(renderer);
  for (const capture of new Set(identities.flatMap(({ captures }) => captures))) {
    if (identities.filter((definition) => definition.captures.includes(capture)).length !== 1) throw new Error(`Branding-identity capture ${capture} has duplicate ownership.`);
  }
  for (const capture of new Set([...frameworks, ...presenters].flatMap(({ captures }) => captures))) {
    const captureFrameworks = frameworks.filter((definition) => definition.captures.includes(capture));
    const capturePresenters = presenters.filter((definition) => definition.captures.includes(capture));
    if (capturePresenters.length > 1 || (capturePresenters.length && captureFrameworks.length)) throw new Error(`Framework and presenter extension regions overlap capture ${capture}.`);
    if (new Set(captureFrameworks.map(({ skylineSelector }) => skylineSelector)).size !== captureFrameworks.length) throw new Error(`Framework-extension capture ${capture} has duplicate Skyline selector ownership.`);
    const identities = captureFrameworks.map(({ accessibleRole, accessibleName }) => `${accessibleRole}\0${accessibleName}`);
    if (new Set(identities).size !== identities.length) throw new Error(`Framework-extension capture ${capture} has duplicate accessible identity.`);
  }

  const captureOwners = new Map<string, string>();
  const selectorOwners = new Map<string, { id: string; category: AllowedDifferenceDefinition["category"]; captures: string[]; kind: "extension" | "anchor" | "capability" | "identity"; anchorPair?: string }>();
  for (const definition of manifest.regions.filter((region): region is Exclude<AllowedDifferenceDefinition, BreadcrumbRasterizationManifestDefinition> => !isBreadcrumbRasterizationManifest(region))) {
    for (const capture of definition.category === "capability-omission" ? definition.captures : []) {
      const key = `capability-omission:${capture}`;
      const owner = captureOwners.get(key);
      if (owner) throw new Error(`Framework-extension regions ${owner} and ${definition.id} overlap capture ${capture}.`);
      captureOwners.set(key, definition.id);
    }
    const selectors = definition.category === "branding-identity"
      ? [...definition.identityPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]), definition.triggerNavigationSelector, definition.skylineNavigationSelector, ...definition.protectedPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector])]
      : definition.category === "renderer-rasterization"
      ? [definition.triggerSelector, definition.skylineSelector]
      : definition.category === "presenter-extension"
      ? [definition.triggerSelector, definition.skylineSelector, definition.triggerAnchorSelector, definition.skylineAnchorSelector]
      : definition.category === "framework-extension"
        ? [definition.skylineSelector, ...(definition.skylineAccessibilitySelector ? [definition.skylineAccessibilitySelector] : []), definition.triggerAnchorSelector, definition.skylineAnchorSelector]
        : [...definition.selectorPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]), ...(definition.protectedSelectors ?? []).map(({ selector }) => selector)];
    if (definition.category !== "capability-omission" && definition.category !== "branding-identity" && definition.category !== "renderer-rasterization") {
      const extensions = definition.category === "presenter-extension"
        ? [definition.triggerSelector, definition.skylineSelector]
        : [definition.skylineSelector, ...(definition.skylineAccessibilitySelector ? [definition.skylineAccessibilitySelector] : [])];
      if (definition.category === "framework-extension" && definition.skylineAccessibilitySelector === definition.skylineSelector) {
        throw new Error(`Framework-extension region ${definition.id} has duplicate extension selector ownership ${definition.skylineSelector}.`);
      }
      const collision = extensions.find((selector) => selector === definition.triggerAnchorSelector || selector === definition.skylineAnchorSelector);
      if (collision) throw new Error(`Framework-extension region ${definition.id} collides on extension and anchor selector ${collision}.`);
    }
    if (definition.category === "capability-omission") {
      const protectedSelectors = definition.protectedSelectors ?? [];
      if (new Set(definition.selectorPairs.map((pair) => pair.id)).size !== definition.selectorPairs.length || new Set(protectedSelectors.map(({ id }) => id)).size !== protectedSelectors.length || new Set(selectors).size !== selectors.length || definition.selectorPairs.some((pair) => pair.skylineBoundary !== undefined && pair.skylineBoundary !== true) || protectedSelectors.some((selector) => !hasValidProtectedSelectorViewportPolicy(selector))) throw new Error(`Capability-omission region ${definition.id} has invalid selector ownership.`);
      if (definition.selectorPairs.some((pair) => pair.skylineBoundary) && (protectedSelectors.length === 0 || !definition.protectedMeasurements || definition.captures.some((capture) => {
        const measurement = definition.protectedMeasurements?.[capture];
        return !measurement || Object.keys(measurement).length !== protectedSelectors.length || protectedSelectors.some(({ id }) => !measurement[id]);
      }))) throw new Error(`Capability-omission region ${definition.id} lacks protected reflow evidence.`);
    }
    if (definition.category === "branding-identity") {
      const triggerSelectors = [...definition.identityPairs.map(({ triggerSelector }) => triggerSelector), definition.triggerNavigationSelector, ...definition.protectedPairs.map(({ triggerSelector }) => triggerSelector)];
      const skylineSelectors = [...definition.identityPairs.map(({ skylineSelector }) => skylineSelector), definition.skylineNavigationSelector, ...definition.protectedPairs.map(({ skylineSelector }) => skylineSelector)];
      if (definition.identityPairs.length === 0 || definition.protectedPairs.length === 0 || new Set(definition.identityPairs.map(({ id }) => id)).size !== definition.identityPairs.length || new Set(definition.protectedPairs.map(({ id }) => id)).size !== definition.protectedPairs.length || new Set(triggerSelectors).size !== triggerSelectors.length || new Set(skylineSelectors).size !== skylineSelectors.length || definition.protectedPairs.some((pair) => pair.captures && (pair.captures.length === 0 || new Set(pair.captures).size !== pair.captures.length || pair.captures.some((capture) => !definition.captures.includes(capture))))) throw new Error(`Branding-identity region ${definition.id} has invalid selector ownership.`);
    }
    const anchorPair = definition.category === "capability-omission" || definition.category === "branding-identity" || definition.category === "renderer-rasterization" ? undefined : `${definition.triggerAnchorSelector}\0${definition.skylineAnchorSelector}`;
    for (const selector of new Set(selectors)) {
      const kind = definition.category === "capability-omission" ? "capability"
        : definition.category === "branding-identity" ? "identity"
        : definition.category === "renderer-rasterization" ? "extension"
        : selector === definition.skylineSelector
          || (definition.category === "framework-extension" && selector === definition.skylineAccessibilitySelector)
          || (definition.category === "presenter-extension" && selector === definition.triggerSelector) ? "extension" : "anchor";
      const owner = selectorOwners.get(selector);
      const disjointCapabilityReuse = owner?.category === "capability-omission"
        && definition.category === "capability-omission"
        && !definition.captures.some((capture) => owner.captures.includes(capture));
      const disjointRendererReuse = owner?.category === "renderer-rasterization"
        && definition.category === "renderer-rasterization"
        && !definition.captures.some((capture) => owner.captures.includes(capture));
      const sharedFrameworkAnchor = owner?.category === "framework-extension" && definition.category === "framework-extension"
        && owner.kind === "anchor" && kind === "anchor" && owner.anchorPair === anchorPair;
      if (owner && !disjointCapabilityReuse && !disjointRendererReuse && !sharedFrameworkAnchor) throw new Error(`Framework-extension regions ${owner.id} and ${definition.id} collide on selector ${selector}.`);
      if (!owner) selectorOwners.set(selector, { id: definition.id, category: definition.category, captures: definition.captures, kind, anchorPair });
    }
  }
}

function isBreadcrumbRasterizationManifest(definition: AllowedDifferenceDefinition): definition is BreadcrumbRasterizationManifestDefinition {
  return "rendererKind" in definition && definition.rendererKind === "breadcrumb";
}

function validateBreadcrumbRasterizationManifest(definition: BreadcrumbRasterizationManifestDefinition) {
  const expected = {
    id: "run-breadcrumb-rasterization",
    category: "renderer-rasterization",
    rendererKind: "breadcrumb",
    decision: "NW-216",
    acceptance: [
      "Lock the exact 196 visible breadcrumb captures to their audited finite state and strict DOM, source SVG, CSS, accessibility, geometry, stroke, backdrop, runtime, and crop evidence.",
      "Require the breadcrumb to remain absent on both sides for the other 243 canonical captures; reject unknown captures, states, crossed evidence, and one-sided presence.",
      "Apply no wildcard, coordinate mask, pixel tolerance, or lossy group compression.",
    ],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-900b4652",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-25c4c4f4",
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e414fc8c",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-cc5fa12d",
    ],
    policyFile: "tests/fidelity/breadcrumb-rasterization-policy.json",
    policySha256: "61eba8a5e611f39088a40f30b77921ed3f3ff8fc26571df1a886e12a87eda678",
    captures: [],
    measurements: {},
  } as const;
  if (!isDeepStrictEqual(definition, expected)) throw new Error("Breadcrumb renderer changed approved manifest metadata.");
}

function hasValidProtectedSelectorViewportPolicy(policy: ProtectedSelectorViewportPolicy) {
  return (policy.allowBelowViewport === undefined || policy.allowBelowViewport === true)
    && (policy.allowRightOfViewport === undefined
      || (policy.allowRightOfViewport.width === mobileProtectedSelectorViewport.width
        && policy.allowRightOfViewport.height === mobileProtectedSelectorViewport.height
        && Object.keys(policy.allowRightOfViewport).length === 2));
}

async function observeElement(page: Page, id: string, selector: string, label: string) {
  return observeElementAccessibility(page, selector, await observeElementDom(page, id, selector, label));
}

export async function resolveFrameworkExtensionAccessibilitySelector(page: Page, definition: FrameworkExtensionDefinition) {
  const selector = definition.skylineAccessibilitySelector ?? definition.skylineSelector;
  const count = await page.locator(selector).count();
  requireSingleMatch(count, definition.id, "Skyline extension accessibility selector");
  return selector;
}

export async function observeElementDom(page: Page, id: string, selector: string, label: string) {
  const result = await page.evaluate((target) => {
    const matches = document.querySelectorAll(target);
    if (matches.length !== 1) return { count: matches.length, observation: null };
    const element = matches[0];
    const identity = {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      className: element.getAttribute("class") ?? "",
      role: element.getAttribute("role"),
      ariaLabel: element.getAttribute("aria-label"),
    };
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const computedStyle = Array.from(style).sort().map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)] as [string, string, string]);
    return {
      count: matches.length,
      observation: {
        identity,
        rect: { x: box.x, y: box.y, width: box.width, height: box.height },
        computedStyle,
      },
    };
  }, selector);
  requireSingleMatch(result.count, id, label);
  if (!result.observation) throw new Error(`Allowed region ${id} ${label} must match exactly one element.`);
  const observation = result.observation;
  const computedStyle = standardComputedStyleEntries(observation.computedStyle);
  return { ...observation, computedStyle, computedStyleSha256: fingerprintComputedStyle(computedStyle) };
}

export async function observeElementAccessibility(
  page: Page,
  identitySelector: string,
  observation: Awaited<ReturnType<typeof observeElementDom>> | { rect: Rect; computedStyleSha256: string },
  snapshotSelector = identitySelector,
) {
  const locator = page.locator(snapshotSelector);
  const accessibility = await observeAccessibleIdentity(page, identitySelector);
  const accessibilitySnapshot = await locator.ariaSnapshot();
  return { ...observation, ...accessibility, accessibilitySha256: fingerprintAccessibility(accessibilitySnapshot) };
}

async function observeCapabilityElementAccessibility(page: Page, selector: string, observation: Awaited<ReturnType<typeof observeElementDom>>) {
  return { ...observation, accessibilitySha256: await fingerprintCapabilityAccessibility(page.locator(selector)) };
}

export async function fingerprintCapabilityAccessibility(locator: { ariaSnapshot(): Promise<string | null> }) {
  const snapshot = await locator.ariaSnapshot();
  return fingerprintAccessibility(snapshot === null ? "<null-capability-subtree>" : snapshot === "" ? "<empty-capability-subtree>" : snapshot);
}

export function requireSingleMatch(count: number, id: string, label: string) {
  if (count !== 1) throw new Error(`Allowed region ${id} ${label} must match exactly one element; observed ${count}.`);
}

/** Separate bundles expose different inherited, unused `--*` inventories; lock every resolved standard property instead. */
export function standardComputedStyleEntries(entries: ComputedStyleEntry[]) {
  return entries.filter(([property]) => !property.startsWith("--"));
}

export function fingerprintComputedStyle(entries: ComputedStyleEntry[]) {
  return createHash("sha256").update(JSON.stringify(standardComputedStyleEntries(entries))).digest("hex");
}

export function fingerprintAccessibility(snapshot: string) {
  return createHash("sha256").update(snapshot).digest("hex");
}

function relativeRect(rect: Rect, anchor: Rect): Rect {
  return { x: rect.x - anchor.x, y: rect.y - anchor.y, width: rect.width, height: rect.height };
}

function absoluteRect(rect: Rect, anchor: Rect): Rect {
  return { x: anchor.x + rect.x, y: anchor.y + rect.y, width: rect.width, height: rect.height };
}

function firstStyleDifference(trigger?: ComputedStyleEntry[], skyline?: ComputedStyleEntry[]) {
  if (!trigger || !skyline) return undefined;
  const length = Math.max(trigger.length, skyline.length);
  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(trigger[index]) !== JSON.stringify(skyline[index])) return `${trigger[index]?.[0] ?? skyline[index]?.[0]} (${JSON.stringify(trigger[index])} vs ${JSON.stringify(skyline[index])})`;
  }
  return undefined;
}

async function observeAccessibleIdentity(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Accessibility.enable");
    const document = await session.send("DOM.getDocument") as { root: { nodeId: number } };
    const match = await session.send("DOM.querySelector", { nodeId: document.root.nodeId, selector }) as { nodeId: number };
    const description = await session.send("DOM.describeNode", { nodeId: match.nodeId }) as { node: { backendNodeId: number } };
    const result = await session.send("Accessibility.getPartialAXTree", { backendNodeId: description.node.backendNodeId, fetchRelatives: false }) as { nodes: Array<{ ignored?: boolean; role?: { value?: unknown }; name?: { value?: unknown } }> };
    const node = result.nodes.find((candidate) => !candidate.ignored && typeof candidate.role?.value === "string");
    if (!node) throw new Error(`Selector ${selector} has no accessible node.`);
    return { accessibleRole: String(node.role?.value), accessibleName: typeof node.name?.value === "string" ? node.name.value : "" };
  } finally {
    await session.detach();
  }
}
