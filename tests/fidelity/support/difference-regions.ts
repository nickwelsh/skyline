import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { NormalizedAccessibilityNode } from "./accessibility";
import type { DifferenceRegion, FrameworkExtensionRegion } from "./pixels";

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
export type AllowedDifferences = { regions: FrameworkExtensionDefinition[] };
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
type ElementObservation = { rect: Rect; accessibleRole: string; accessibleName: string; computedStyleSha256: string; computedStyle?: ComputedStyleEntry[] };

export async function observeDifferenceRegions(trigger: Page, skyline: Page, capture: string, manifest: AllowedDifferences): Promise<DifferenceRegion[]> {
  const definitions = applicableFrameworkExtensions(capture, manifest);
  return Promise.all(definitions.map(async (definition) => {
    const resolved = validateFrameworkExtensionObservation(definition, await discoverFrameworkExtensionObservation(trigger, skyline, definition), capture);
    return { kind: "framework-extension", id: definition.id, extension: resolved, expected: { ...definition, ...definition.measurements[capture] } } satisfies FrameworkExtensionRegion;
  }));
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

export function validatePairedAnchorIdentity(definition: FrameworkExtensionDefinition, trigger: ElementObservation, skyline: ElementObservation) {
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
  const definitions = manifest.regions.filter((region) => region.category === "framework-extension" && region.captures.includes(capture));
  if (definitions.length > 1) throw new Error(`Capture ${capture} has multiple framework-extension regions.`);
  return definitions;
}

async function observeElement(page: Page, id: string, selector: string, label: string) {
  const locator = page.locator(selector);
  requireSingleMatch(await locator.count(), id, label);
  const [observation, accessibility] = await Promise.all([locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const computedStyle = Array.from(style).sort().map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)] as [string, string, string]);
    return {
      rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      computedStyle,
    };
  }), observeAccessibleIdentity(page, selector)]);
  const computedStyle = standardComputedStyleEntries(observation.computedStyle);
  return { ...observation, ...accessibility, computedStyle, computedStyleSha256: fingerprintComputedStyle(computedStyle) };
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
