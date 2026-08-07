import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { PNG } from "pngjs";
import type { NormalizedAccessibilityNode } from "./accessibility";
import type { DiscoveryStep } from "./discovery";
import type { CapabilityOmissionRegion, DifferenceRegion, FrameworkExtensionRegion, PresenterExtensionRegion } from "./pixels";

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
export type CapabilityOmissionObservation = {
  selectorPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; skylineBoundary?: true } & CapabilityOmissionMeasurement>;
  protectedSelectors?: Array<ProtectedSelectorDefinition & ProtectedSelectorMeasurement>;
};
export type AllowedDifferenceDefinition = FrameworkExtensionDefinition | PresenterExtensionDefinition | CapabilityOmissionDefinition | BrandingIdentityDefinition;
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
  if (!definition.captures.includes(capture)) throw new Error(`Branding identity ${definition.id} does not permit capture ${capture}.`);
  const step: DiscoveryStep = diagnosticStep ?? ((_label, action) => action());
  const [triggerScreenshot, skylineScreenshot] = await Promise.all([
    step("branding:screenshot:trigger", () => trigger.screenshot({ animations: "disabled", caret: "hide" })),
    step("branding:screenshot:skyline", () => skyline.screenshot({ animations: "disabled", caret: "hide" })),
  ]);
  const observe = async (page: Page, screenshot: Buffer, selector: string, label: string): Promise<BrandingIdentityElementMeasurement> => {
    const dom = await step(`branding:dom:${label}`, () => observeElementDom(page, definition.id, selector, label));
    const element = await step(`branding:ax:${label}`, () => observeCapabilityElementAccessibility(page, selector, dom));
    validateProtectedElementPresentation(definition.id, label, element);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error(`Branding identity ${definition.id} requires a fixed viewport.`);
    const crop = captureProtectedElementCrop(screenshot, viewport, element.rect);
    if (crop.status !== "visible") throw new Error(`Branding identity ${definition.id} ${label} is outside the viewport.`);
    return { rect: element.rect, computedStyleSha256: element.computedStyleSha256, accessibilitySha256: element.accessibilitySha256, crop };
  };
  const identityPairs = [];
  for (const pair of definition.identityPairs) identityPairs.push({
    ...pair,
    trigger: await observe(trigger, triggerScreenshot, pair.triggerSelector, `${pair.id}:trigger`),
    skyline: await observe(skyline, skylineScreenshot, pair.skylineSelector, `${pair.id}:skyline`),
  });
  const protectedPairs = [];
  for (const pair of applicableBrandingProtectedPairs(definition, capture)) protectedPairs.push({
    ...pair,
    trigger: await observe(trigger, triggerScreenshot, pair.triggerSelector, `${pair.id}:protected:trigger`),
    skyline: await observe(skyline, skylineScreenshot, pair.skylineSelector, `${pair.id}:protected:skyline`),
  });
  return {
    identityPairs,
    navigation: {
      triggerSelector: definition.triggerNavigationSelector,
      skylineSelector: definition.skylineNavigationSelector,
      trigger: await observe(trigger, triggerScreenshot, definition.triggerNavigationSelector, "navigation:trigger"),
      skyline: await observe(skyline, skylineScreenshot, definition.skylineNavigationSelector, "navigation:skyline"),
    },
    protectedPairs,
  };
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
  return manifest.regions.filter((region) => region.captures.includes(capture));
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

export function validateFrameworkExtensionDefinitions(manifest: AllowedDifferences) {
  const frameworks = manifest.regions.filter((region): region is FrameworkExtensionDefinition => region.category === "framework-extension");
  const presenters = manifest.regions.filter((region): region is PresenterExtensionDefinition => region.category === "presenter-extension");
  const identities = manifest.regions.filter((region): region is BrandingIdentityDefinition => region.category === "branding-identity");
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
  for (const definition of manifest.regions) {
    for (const capture of definition.category === "capability-omission" ? definition.captures : []) {
      const key = `capability-omission:${capture}`;
      const owner = captureOwners.get(key);
      if (owner) throw new Error(`Framework-extension regions ${owner} and ${definition.id} overlap capture ${capture}.`);
      captureOwners.set(key, definition.id);
    }
    const selectors = definition.category === "branding-identity"
      ? [...definition.identityPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]), definition.triggerNavigationSelector, definition.skylineNavigationSelector, ...definition.protectedPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector])]
      : definition.category === "presenter-extension"
      ? [definition.triggerSelector, definition.skylineSelector, definition.triggerAnchorSelector, definition.skylineAnchorSelector]
      : definition.category === "framework-extension"
        ? [definition.skylineSelector, ...(definition.skylineAccessibilitySelector ? [definition.skylineAccessibilitySelector] : []), definition.triggerAnchorSelector, definition.skylineAnchorSelector]
        : [...definition.selectorPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]), ...(definition.protectedSelectors ?? []).map(({ selector }) => selector)];
    if (definition.category !== "capability-omission" && definition.category !== "branding-identity") {
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
    const anchorPair = definition.category === "capability-omission" || definition.category === "branding-identity" ? undefined : `${definition.triggerAnchorSelector}\0${definition.skylineAnchorSelector}`;
    for (const selector of new Set(selectors)) {
      const kind = definition.category === "capability-omission" ? "capability"
        : definition.category === "branding-identity" ? "identity"
        : selector === definition.skylineSelector
          || (definition.category === "framework-extension" && selector === definition.skylineAccessibilitySelector)
          || (definition.category === "presenter-extension" && selector === definition.triggerSelector) ? "extension" : "anchor";
      const owner = selectorOwners.get(selector);
      const disjointCapabilityReuse = owner?.category === "capability-omission"
        && definition.category === "capability-omission"
        && !definition.captures.some((capture) => owner.captures.includes(capture));
      const sharedFrameworkAnchor = owner?.category === "framework-extension" && definition.category === "framework-extension"
        && owner.kind === "anchor" && kind === "anchor" && owner.anchorPair === anchorPair;
      if (owner && !disjointCapabilityReuse && !sharedFrameworkAnchor) throw new Error(`Framework-extension regions ${owner.id} and ${definition.id} collide on selector ${selector}.`);
      if (!owner) selectorOwners.set(selector, { id: definition.id, category: definition.category, captures: definition.captures, kind, anchorPair });
    }
  }
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
