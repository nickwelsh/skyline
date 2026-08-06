import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { NormalizedAccessibilityNode } from "./accessibility";
import type { CapabilityOmissionRegion, DifferenceRegion, FrameworkExtensionRegion, PresenterExtensionRegion } from "./pixels";

type Rect = { x: number; y: number; width: number; height: number };
export type FrameworkExtensionDefinition = {
  id: string;
  category: "framework-extension";
  decision: string;
  acceptance: string;
  captures: string[];
  skylineSelector: string;
  triggerAnchorSelector: string;
  skylineAnchorSelector: string;
  accessibleRole: string;
  accessibleName: string;
  anchorAccessibleRole: string;
  anchorAccessibleName: string;
  measurements: Record<string, {
    relativeRect: Rect;
    computedStyleSha256: string;
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
export type CapabilityOmissionDefinition = {
  id: string;
  category: "capability-omission";
  decision: string;
  acceptance: string[];
  citations: string[];
  captures: string[];
  selectorPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string }>;
  measurements: Record<string, Record<string, CapabilityOmissionMeasurement>>;
};
export type CapabilityOmissionObservation = {
  selectorPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string } & CapabilityOmissionMeasurement>;
};
export type AllowedDifferenceDefinition = FrameworkExtensionDefinition | PresenterExtensionDefinition | CapabilityOmissionDefinition;
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
    const resolved = validateCapabilityOmissionObservation(definition, await discoverCapabilityOmissionObservation(trigger, skyline, definition), capture);
    regions.push({ kind: "capability-omission", id: definition.id, omissions: resolved.selectorPairs, expected: definition.measurements[capture] } satisfies CapabilityOmissionRegion);
  }
  return regions;
}

export async function waitForDifferenceRegions(trigger: Page, skyline: Page, capture: string, manifest: AllowedDifferences) {
  const waits: Promise<void>[] = [];
  for (const definition of applicableExtensionDefinitions(capture, manifest)) {
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
  }
  await Promise.all(waits);
}

export async function discoverCapabilityOmissionObservation(trigger: Page, skyline: Page, definition: CapabilityOmissionDefinition): Promise<CapabilityOmissionObservation> {
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
    const triggerElement = await observeElementAccessibility(trigger, observation.pair.triggerSelector, observation.trigger);
    const skylineElement = await observeElementAccessibility(skyline, observation.pair.skylineSelector, observation.skyline);
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
  return { selectorPairs };
}

export function validateCapabilityOmissionObservation(definition: CapabilityOmissionDefinition, observation: CapabilityOmissionObservation, capture: string) {
  const measurement = definition.measurements[capture];
  if (!measurement) throw new Error(`Allowed region ${definition.id} lacks measurement for ${capture}.`);
  if (observation.selectorPairs.length !== definition.selectorPairs.length) throw new Error(`Allowed region ${definition.id} changed selector pair count.`);
  for (const [index, pair] of definition.selectorPairs.entries()) {
    const observed = observation.selectorPairs[index];
    const expected = measurement[pair.id];
    if (!observed || !expected || observed.id !== pair.id || observed.triggerSelector !== pair.triggerSelector || observed.skylineSelector !== pair.skylineSelector) throw new Error(`Allowed region ${definition.id} changed selector pair ${pair.id}.`);
    for (const key of ["triggerRect", "skylineRect", "triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256"] as const) {
      if (JSON.stringify(observed[key]) !== JSON.stringify(expected[key])) throw new Error(`Allowed region ${definition.id} pair ${pair.id} changed ${key}.`);
    }
  }
  return observation;
}

export async function discoverPresenterExtensionObservation(trigger: Page, skyline: Page, definition: PresenterExtensionDefinition, capture?: string): Promise<PresenterExtensionObservation> {
  const triggerPresenterDom = await observeElementDom(trigger, definition.id, definition.triggerSelector, "Trigger presenter");
  const triggerAnchorDom = await observeElementDom(trigger, definition.id, definition.triggerAnchorSelector, "Trigger anchor");
  const skylinePresenterDom = await observeElementDom(skyline, definition.id, definition.skylineSelector, "Skyline presenter");
  const skylineAnchorDom = await observeElementDom(skyline, definition.id, definition.skylineAnchorSelector, "Skyline anchor");
  const triggerPresenter = await observeElementAccessibility(trigger, definition.triggerSelector, triggerPresenterDom);
  const triggerAnchor = await observeElementAccessibility(trigger, definition.triggerAnchorSelector, triggerAnchorDom);
  const skylinePresenter = await observeElementAccessibility(skyline, definition.skylineSelector, skylinePresenterDom);
  const skylineAnchor = await observeElementAccessibility(skyline, definition.skylineAnchorSelector, skylineAnchorDom);
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

export async function discoverFrameworkExtensionObservation(trigger: Page, skyline: Page, definition: FrameworkExtensionDefinition): Promise<FrameworkExtensionObservation> {
  const [extension, triggerAnchor, skylineAnchor] = await Promise.all([
    observeElement(skyline, definition.id, definition.skylineSelector, "Skyline extension"),
    observeElement(trigger, definition.id, definition.triggerAnchorSelector, "Trigger anchor"),
    observeElement(skyline, definition.id, definition.skylineAnchorSelector, "Skyline anchor"),
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
  const definitions = manifest.regions.filter((region): region is FrameworkExtensionDefinition => region.category === "framework-extension" && region.captures.includes(capture));
  if (definitions.length > 1) throw new Error(`Capture ${capture} has multiple framework-extension regions.`);
  return definitions;
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
    if (region.kind === "framework-extension") return application === "skyline" ? [region.extension.skylineSelector] : [];
    if (region.kind === "presenter-extension") return [application === "trigger" ? region.expected.triggerSelector : region.expected.skylineSelector];
    if (region.kind === "capability-omission") return region.omissions.map((pair) => application === "trigger" ? pair.triggerSelector : pair.skylineSelector);
    return [];
  });
}

export function validateFrameworkExtensionDefinitions(manifest: AllowedDifferences) {
  const captureOwners = new Map<string, string>();
  const selectorOwners = new Map<string, string>();
  for (const definition of manifest.regions.filter((region) => region.category === "framework-extension" || region.category === "presenter-extension" || region.category === "capability-omission")) {
    for (const capture of definition.captures) {
      const ownership = definition.category === "capability-omission" ? "capability-omission" : "extension";
      const key = `${ownership}:${capture}`;
      const owner = captureOwners.get(key);
      if (owner) throw new Error(`Framework-extension regions ${owner} and ${definition.id} overlap capture ${capture}.`);
      captureOwners.set(key, definition.id);
    }
    const selectors = definition.category === "presenter-extension"
      ? [definition.triggerSelector, definition.skylineSelector, definition.triggerAnchorSelector, definition.skylineAnchorSelector]
      : definition.category === "framework-extension"
        ? [definition.skylineSelector, definition.triggerAnchorSelector, definition.skylineAnchorSelector]
        : definition.selectorPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]);
    if (definition.category === "capability-omission" && (new Set(definition.selectorPairs.map((pair) => pair.id)).size !== definition.selectorPairs.length || new Set(selectors).size !== selectors.length)) throw new Error(`Capability-omission region ${definition.id} has duplicate selector ownership.`);
    for (const selector of new Set(selectors)) {
      const owner = selectorOwners.get(selector);
      if (owner) throw new Error(`Framework-extension regions ${owner} and ${definition.id} collide on selector ${selector}.`);
      selectorOwners.set(selector, definition.id);
    }
  }
}

async function observeElement(page: Page, id: string, selector: string, label: string) {
  return observeElementAccessibility(page, selector, await observeElementDom(page, id, selector, label));
}

async function observeElementDom(page: Page, id: string, selector: string, label: string) {
  const locator = page.locator(selector);
  await locator.first().waitFor({ state: "attached" });
  requireSingleMatch(await locator.count(), id, label);
  const observation = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const computedStyle = Array.from(style).sort().map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)] as [string, string, string]);
    return {
      rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      computedStyle,
    };
  });
  const computedStyle = standardComputedStyleEntries(observation.computedStyle);
  return { ...observation, computedStyle, computedStyleSha256: fingerprintComputedStyle(computedStyle) };
}

async function observeElementAccessibility(page: Page, selector: string, observation: Awaited<ReturnType<typeof observeElementDom>>) {
  const locator = page.locator(selector);
  const accessibility = await observeAccessibleIdentity(page, selector);
  const accessibilitySnapshot = await locator.ariaSnapshot();
  return { ...observation, ...accessibility, accessibilitySha256: fingerprintAccessibility(accessibilitySnapshot) };
}

export function requireSingleMatch(count: number, id: string, label: string) {
  if (count !== 1) throw new Error(`Allowed region ${id} ${label} must match exactly one element.`);
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
