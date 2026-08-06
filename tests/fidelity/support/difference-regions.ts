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
type ElementObservation = { rect: Rect; accessibleRole: string; accessibleName: string; computedStyleSha256: string };

export async function observeDifferenceRegions(trigger: Page, skyline: Page, capture: string, manifest: AllowedDifferences): Promise<DifferenceRegion[]> {
  const definitions = applicableFrameworkExtensions(capture, manifest);
  return Promise.all(definitions.map(async (definition) => {
    const [extension, triggerAnchor, skylineAnchor] = await Promise.all([
      observeElement(skyline, definition.id, definition.skylineSelector, "Skyline extension"),
      observeElement(trigger, definition.id, definition.triggerAnchorSelector, "Trigger anchor"),
      observeElement(skyline, definition.id, definition.skylineAnchorSelector, "Skyline anchor"),
    ]);
    validatePairedAnchor(definition, triggerAnchor, skylineAnchor, capture);
    const observation = {
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
    const resolved = validateFrameworkExtensionObservation(definition, {
      ...observation,
    }, capture);
    return { kind: "framework-extension", id: definition.id, extension: resolved, expected: { ...definition, ...definition.measurements[capture] } } satisfies FrameworkExtensionRegion;
  }));
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
  if (JSON.stringify(trigger.rect) !== JSON.stringify(skyline.rect)) throw new Error(`Allowed region ${definition.id} anchor changed geometry.`);
  if (trigger.computedStyleSha256 !== skyline.computedStyleSha256) throw new Error(`Allowed region ${definition.id} anchor changed computed style.`);
  if (trigger.accessibleRole !== definition.anchorAccessibleRole || skyline.accessibleRole !== definition.anchorAccessibleRole
    || trigger.accessibleName !== definition.anchorAccessibleName || skyline.accessibleName !== definition.anchorAccessibleName) throw new Error(`Allowed region ${definition.id} anchor changed accessible identity.`);
  if (JSON.stringify(skyline.rect) !== JSON.stringify(measurement.anchorRect) || skyline.computedStyleSha256 !== measurement.anchorComputedStyleSha256) throw new Error(`Allowed region ${definition.id} anchor changed locked observation.`);
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
  const observation = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const computedStyle = Array.from(style).sort().map((property) => [property, style.getPropertyValue(property), style.getPropertyPriority(property)]);
    const explicitRole = element.getAttribute("role");
    const accessibleRole = explicitRole ?? (element.matches("section[aria-label]") ? "region" : /^H[1-6]$/.test(element.tagName) ? "heading" : element.tagName.toLowerCase());
    return {
      rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      accessibleRole,
      accessibleName: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
      computedStyle,
    };
  });
  return { ...observation, computedStyleSha256: createHash("sha256").update(JSON.stringify(observation.computedStyle)).digest("hex") };
}

export function requireSingleMatch(count: number, id: string, label: string) {
  if (count !== 1) throw new Error(`Allowed region ${id} ${label} must match exactly one element.`);
}
