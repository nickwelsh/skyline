import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

type Rect = { x: number; y: number; width: number; height: number };
type ProtectedCrop = { status: "visible"; rect: Rect; screenshotSha256: string } | { status: "below-viewport" } | { status: "right-of-viewport" };
type Mask = { rect: Rect; source: Rect; application: "trigger" | "skyline" | "both" };
type Observation = { selector: string; rect: Rect; computedStyle: Record<string, string>; accessibleName: string };
type PairedRegion = { kind?: "paired"; id: string; trigger: Observation; skyline: Observation };
export type FrameworkExtensionRegion = {
  kind: "framework-extension";
  id: string;
  extension: { skylineSelector: string; triggerAnchorSelector: string; skylineAnchorSelector: string; accessibleRole: string; accessibleName: string; rect: Rect; relativeRect: Rect; computedStyleSha256: string; anchorRect: Rect; anchorComputedStyleSha256: string };
  expected: { skylineSelector: string; triggerAnchorSelector: string; skylineAnchorSelector: string; accessibleRole: string; accessibleName: string; relativeRect: Rect; computedStyleSha256: string; anchorRect: Rect; anchorComputedStyleSha256: string };
};
export type PresenterExtensionRegion = {
  kind: "presenter-extension";
  id: string;
  presenter: PresenterExtensionObservation;
  expected: Omit<PresenterExtensionObservation, "triggerRect" | "skylineRect">;
};
export type CapabilityOmissionRegion = {
  kind: "capability-omission";
  id: string;
  omissions: Array<{ id: string; triggerSelector: string; skylineSelector: string; skylineBoundary?: true } & CapabilityOmissionMeasurement>;
  protectedSelectors?: Array<{ id: string; application: "trigger" | "skyline"; selector: string; rect: Rect; computedStyleSha256: string; accessibilitySha256: string; crop: ProtectedCrop }>;
  expected: Record<string, CapabilityOmissionMeasurement>;
  expectedProtected?: Record<string, { rect: Rect; computedStyleSha256: string; accessibilitySha256: string; crop: ProtectedCrop }>;
};
type BrandingIdentityElement = { rect: Rect; computedStyleSha256: string; accessibilitySha256: string; crop: Extract<ProtectedCrop, { status: "visible" }> };
export type BrandingIdentityRegion = {
  kind: "branding-identity";
  id: string;
  identityPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElement; skyline: BrandingIdentityElement }>;
  navigation: { triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElement; skyline: BrandingIdentityElement };
  protectedPairs: Array<{ id: string; triggerSelector: string; skylineSelector: string; trigger: BrandingIdentityElement; skyline: BrandingIdentityElement }>;
  expected: { identityPairs: Record<string, { trigger: BrandingIdentityElement; skyline: BrandingIdentityElement }>; navigation: { trigger: BrandingIdentityElement; skyline: BrandingIdentityElement }; protectedPairs: Record<string, { trigger: BrandingIdentityElement; skyline: BrandingIdentityElement }> };
};
type CapabilityOmissionMeasurement = {
  triggerRect: Rect; skylineRect: Rect;
  triggerComputedStyleSha256: string; skylineComputedStyleSha256: string;
  triggerAccessibilitySha256: string; skylineAccessibilitySha256: string;
};
type PresenterExtensionObservation = {
  triggerSelector: string; skylineSelector: string; triggerAnchorSelector: string; skylineAnchorSelector: string;
  skylineAccessibleRole: string; skylineAccessibleName: string;
  triggerRect: Rect; skylineRect: Rect; triggerRelativeRect: Rect; skylineRelativeRect: Rect;
  triggerComputedStyleSha256: string; skylineComputedStyleSha256: string;
  triggerAccessibilitySha256: string; skylineAccessibilitySha256: string;
  anchorRect: Rect; anchorComputedStyleSha256: string; anchorAccessibilitySha256: string; anchorAccessibleName: string;
};
export type DifferenceRegion = PairedRegion | FrameworkExtensionRegion | PresenterExtensionRegion | CapabilityOmissionRegion | BrandingIdentityRegion;

export function comparePixels(triggerBuffer: Buffer, skylineBuffer: Buffer, regions: DifferenceRegion[]) {
  const comparison = measurePixels(triggerBuffer, skylineBuffer, regions);
  if (comparison.differingPixels > 0) throw new Error(`${comparison.differingPixels} unclassified pixel${comparison.differingPixels === 1 ? "" : "s"} differ outside accepted regions.`);
  return comparison;
}

export function measurePixels(triggerBuffer: Buffer, skylineBuffer: Buffer, regions: DifferenceRegion[]) {
  const trigger = PNG.sync.read(triggerBuffer);
  const skyline = PNG.sync.read(skylineBuffer);
  if (trigger.width !== skyline.width || trigger.height !== skyline.height) throw new Error("Paired screenshots have different dimensions.");

  const regionMasks = regions.map((region) => validateRegion(region, trigger.width, trigger.height, trigger, skyline));
  rejectOverlaps(regionMasks, trigger.width, trigger.height);
  const masks = regionMasks.flat();
  const visited = new Uint8Array(trigger.width * trigger.height);
  let maskedPixels = 0;
  for (const { rect } of masks) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const pixel = y * trigger.width + x;
        if (visited[pixel]) continue;
        visited[pixel] = 1;
        const offset = (y * trigger.width + x) * 4;
        if (!samePixel(trigger.data, skyline.data, offset)) maskedPixels += 1;
        skyline.data.set(trigger.data.subarray(offset, offset + 4), offset);
      }
    }
  }

  const differingPixels = pixelmatch(trigger.data, skyline.data, undefined, trigger.width, trigger.height, { threshold: 0, includeAA: true });
  return { differingPixels, maskedPixels, regions: regions.map(({ id }) => id) };
}

function validateRegion(region: DifferenceRegion, imageWidth: number, imageHeight: number, triggerImage: PNG, skylineImage: PNG): Mask[] {
  if (region.kind === "branding-identity") {
    if (region.identityPairs.length !== Object.keys(region.expected.identityPairs).length) throw new Error(`Allowed region ${region.id} changed identity pair count.`);
    for (const pair of region.identityPairs) {
      const expected = region.expected.identityPairs[pair.id];
      if (!expected || JSON.stringify({ trigger: pair.trigger, skyline: pair.skyline }) !== JSON.stringify(expected)) throw new Error(`Allowed region ${region.id} changed identity pair ${pair.id} evidence.`);
    }
    if (JSON.stringify({ trigger: region.navigation.trigger, skyline: region.navigation.skyline }) !== JSON.stringify(region.expected.navigation)) throw new Error(`Allowed region ${region.id} changed protected navigation evidence.`);
    if (region.protectedPairs.length !== Object.keys(region.expected.protectedPairs).length) throw new Error(`Allowed region ${region.id} changed protected pair count.`);
    for (const pair of region.protectedPairs) {
      const expected = region.expected.protectedPairs[pair.id];
      if (!expected || JSON.stringify({ trigger: pair.trigger, skyline: pair.skyline }) !== JSON.stringify(expected)) throw new Error(`Allowed region ${region.id} changed protected pair ${pair.id} evidence.`);
      assertMatchingProtectedNavigationPixels(triggerImage, skylineImage, `${region.id} ${pair.id}`, pair.trigger.rect, pair.skyline.rect);
    }
    return [
      ...region.identityPairs.flatMap((pair) => [
        boundedMask(`${region.id}:${pair.id}:trigger`, pair.trigger.rect, "trigger", imageWidth, imageHeight),
        boundedMask(`${region.id}:${pair.id}:skyline`, pair.skyline.rect, "skyline", imageWidth, imageHeight),
      ]),
      boundedMask(`${region.id}:navigation:trigger`, region.navigation.trigger.rect, "trigger", imageWidth, imageHeight),
      boundedMask(`${region.id}:navigation:skyline`, region.navigation.skyline.rect, "skyline", imageWidth, imageHeight),
    ];
  }
  if (region.kind === "framework-extension") {
    for (const key of ["skylineSelector", "triggerAnchorSelector", "skylineAnchorSelector", "accessibleRole", "accessibleName", "computedStyleSha256", "anchorComputedStyleSha256"] as const) {
      if (region.extension[key] !== region.expected[key]) throw new Error(`Allowed region ${region.id} changed ${key}.`);
    }
    if (JSON.stringify(region.extension.relativeRect) !== JSON.stringify(region.expected.relativeRect)) throw new Error(`Allowed region ${region.id} changed anchor-relative geometry.`);
    if (JSON.stringify(region.extension.anchorRect) !== JSON.stringify(region.expected.anchorRect)) throw new Error(`Allowed region ${region.id} anchor changed locked geometry.`);
    return [boundedMask(region.id, region.extension.rect, "skyline", imageWidth, imageHeight)];
  }
  if (region.kind === "presenter-extension") {
    for (const key of ["triggerSelector", "skylineSelector", "triggerAnchorSelector", "skylineAnchorSelector", "skylineAccessibleRole", "skylineAccessibleName", "triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256", "anchorComputedStyleSha256", "anchorAccessibilitySha256", "anchorAccessibleName"] as const) {
      if (region.presenter[key] !== region.expected[key]) throw new Error(`Allowed region ${region.id} changed ${key}.`);
    }
    for (const key of ["triggerRelativeRect", "skylineRelativeRect", "anchorRect"] as const) {
      if (JSON.stringify(region.presenter[key]) !== JSON.stringify(region.expected[key])) throw new Error(`Allowed region ${region.id} changed ${key}.`);
    }
    if (JSON.stringify(region.expected.triggerRelativeRect) !== JSON.stringify(region.expected.skylineRelativeRect)
      || JSON.stringify(region.presenter.triggerRect) !== JSON.stringify(region.presenter.skylineRect)) throw new Error(`Allowed region ${region.id} changed cross-side geometry.`);
    for (const [label, rect, relative] of [["Trigger", region.presenter.triggerRect, region.expected.triggerRelativeRect], ["Skyline", region.presenter.skylineRect, region.expected.skylineRelativeRect]] as const) {
      const expectedRect = { x: region.expected.anchorRect.x + relative.x, y: region.expected.anchorRect.y + relative.y, width: relative.width, height: relative.height };
      if (JSON.stringify(rect) !== JSON.stringify(expectedRect)) throw new Error(`Allowed region ${region.id} changed ${label} outer geometry.`);
    }
    return [
      boundedMask(region.id, region.presenter.triggerRect, "trigger", imageWidth, imageHeight, 0.65),
      boundedMask(region.id, region.presenter.skylineRect, "skyline", imageWidth, imageHeight, 0.65),
    ];
  }
  if (region.kind === "capability-omission") {
    const protectedSelectors = region.protectedSelectors ?? [];
    const expectedProtected = region.expectedProtected ?? {};
    const protectedIds = protectedSelectors.map(({ id }) => id);
    if (region.omissions.some(({ skylineBoundary }) => skylineBoundary) && (protectedSelectors.length === 0 || new Set(protectedIds).size !== protectedIds.length || Object.keys(expectedProtected).length !== protectedSelectors.length || protectedIds.some((id) => !expectedProtected[id]))) throw new Error(`Allowed region ${region.id} lacks exact protected reflow evidence.`);
    for (const protectedSelector of protectedSelectors) {
      const expected = expectedProtected[protectedSelector.id];
      if (!expected) throw new Error(`Allowed region ${region.id} lacks protected measurement for ${protectedSelector.id}.`);
      for (const key of ["rect", "computedStyleSha256", "accessibilitySha256", "crop"] as const) {
        if (JSON.stringify(protectedSelector[key]) !== JSON.stringify(expected[key])) throw new Error(`Allowed region ${region.id} protected selector ${protectedSelector.id} changed ${key}.`);
      }
    }
    const pairMasks = region.omissions.map((pair) => {
      const expected = region.expected[pair.id];
      if (!expected) throw new Error(`Allowed region ${region.id} lacks measurement for pair ${pair.id}.`);
      for (const key of ["triggerRect", "skylineRect", "triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256"] as const) {
        if (JSON.stringify(pair[key]) !== JSON.stringify(expected[key])) throw new Error(`Allowed region ${region.id} pair ${pair.id} changed ${key}.`);
      }
      return [
        boundedMask(`${region.id}:${pair.id}:trigger`, pair.triggerRect, "trigger", imageWidth, imageHeight),
        ...(pair.skylineBoundary ? [] : [boundedMask(`${region.id}:${pair.id}:skyline`, pair.skylineRect, "skyline", imageWidth, imageHeight)]),
      ];
    });
    rejectOverlaps(pairMasks, imageWidth, imageHeight);
    return pairMasks.flat();
  }
  const triggerRect = integerRect(region.trigger.rect);
  const skylineRect = integerRect(region.skyline.rect);
  if (JSON.stringify(triggerRect) !== JSON.stringify(skylineRect)) throw new Error(`Allowed region ${region.id} changed geometry.`);
  if (JSON.stringify(region.trigger.computedStyle) !== JSON.stringify(region.skyline.computedStyle)) throw new Error(`Allowed region ${region.id} changed computed style.`);
  if (region.trigger.accessibleName !== region.skyline.accessibleName) throw new Error(`Allowed region ${region.id} changed accessible name.`);
  return [boundedMask(region.id, region.trigger.rect, "both", imageWidth, imageHeight)];
}

function assertMatchingProtectedNavigationPixels(trigger: PNG, skyline: PNG, id: string, triggerRect: Rect, skylineRect: Rect) {
  const triggerCrop = visibleCrop(trigger, triggerRect);
  const skylineCrop = visibleCrop(skyline, skylineRect);
  if (triggerCrop.width !== skylineCrop.width || triggerCrop.height !== skylineCrop.height || !triggerCrop.pixels.equals(skylineCrop.pixels)) throw new Error(`Allowed region ${id} changed protected navigation pixels.`);
}

function visibleCrop(image: PNG, rect: Rect) {
  const bounded = boundedRect("protected navigation", rect, image.width, image.height, 1);
  const pixels = Buffer.alloc(bounded.width * bounded.height * 4);
  for (let row = 0; row < bounded.height; row += 1) image.data.copy(pixels, row * bounded.width * 4, ((bounded.y + row) * image.width + bounded.x) * 4, ((bounded.y + row) * image.width + bounded.x + bounded.width) * 4);
  return { width: bounded.width, height: bounded.height, pixels };
}

function boundedMask(id: string, source: Rect, application: Mask["application"], imageWidth: number, imageHeight: number, maximumFraction = 0.15): Mask {
  return { rect: boundedRect(id, source, imageWidth, imageHeight, maximumFraction), source, application };
}

function boundedRect(id: string, rect: Rect, imageWidth: number, imageHeight: number, maximumFraction = 0.15) {
  const integer = integerRect(rect);
  const x = Math.max(0, integer.x);
  const y = Math.max(0, integer.y);
  const right = Math.min(imageWidth, integer.x + integer.width);
  const bottom = Math.min(imageHeight, integer.y + integer.height);
  const visible = { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  if (visible.width * visible.height > imageWidth * imageHeight * maximumFraction) throw new Error(`Allowed region ${id} is too broad.`);
  return visible;
}

function integerRect(rect: Rect): Rect {
  return { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
}

function rejectOverlaps(regions: Mask[][], imageWidth: number, imageHeight: number) {
  for (let left = 0; left < regions.length; left += 1) {
    for (let right = left + 1; right < regions.length; right += 1) {
      for (const a of regions[left]) for (const b of regions[right]) {
        if (sameCoordinateSpace(a, b) && overlaps(a.rect, b.rect) && overlaps(a.source, b.source)
          && !isEdgeOccluded(a, b, imageWidth, imageHeight)
          && !isEdgeOccluded(b, a, imageWidth, imageHeight)) throw new Error("Allowed-difference regions overlap.");
      }
    }
  }
}

type Edge = "left" | "right" | "top" | "bottom";

function isEdgeOccluded(child: Mask, owner: Mask, imageWidth: number, imageHeight: number) {
  if (!hasArea(child.rect) || !hasArea(owner.rect) || !contains(owner.rect, child.rect)) return false;
  const childEdges = crossingEdges(child.source, imageWidth, imageHeight);
  const ownerEdges = crossingEdges(owner.source, imageWidth, imageHeight);
  const qualifyingEdges = childEdges.filter((edge) => !ownerEdges.includes(edge) && isPinned(owner.source, edge, imageWidth, imageHeight));
  if (qualifyingEdges.length !== 1) return false;
  const occlusionEdge = qualifyingEdges[0];
  return sameEdges(childEdges.filter((edge) => edge !== occlusionEdge), ownerEdges);
}

function crossingEdges(rect: Rect, imageWidth: number, imageHeight: number): Edge[] {
  if (!hasArea(rect)) return [];
  const edges: Edge[] = [];
  if (rect.x < 0 && rect.x + rect.width > 0) edges.push("left");
  if (rect.x < imageWidth && rect.x + rect.width > imageWidth) edges.push("right");
  if (rect.y < 0 && rect.y + rect.height > 0) edges.push("top");
  if (rect.y < imageHeight && rect.y + rect.height > imageHeight) edges.push("bottom");
  return edges;
}

function isPinned(rect: Rect, edge: Edge, imageWidth: number, imageHeight: number) {
  if (edge === "left") return rect.x === 0;
  if (edge === "right") return rect.x + rect.width === imageWidth;
  if (edge === "top") return rect.y === 0;
  return rect.y + rect.height === imageHeight;
}

function sameEdges(left: Edge[], right: Edge[]) {
  return left.length === right.length && left.every((edge) => right.includes(edge));
}

function contains(owner: Rect, child: Rect) {
  return child.x >= owner.x && child.y >= owner.y
    && child.x + child.width <= owner.x + owner.width
    && child.y + child.height <= owner.y + owner.height;
}

function hasArea(rect: Rect) {
  return rect.width > 0 && rect.height > 0;
}

function overlaps(a: Rect, b: Rect) {
  return hasArea(a) && hasArea(b)
    && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function sameCoordinateSpace(a: Mask, b: Mask) {
  return a.application === "both" || b.application === "both" || a.application === b.application;
}

function samePixel(trigger: Buffer, skyline: Buffer, offset: number) {
  return trigger[offset] === skyline[offset]
    && trigger[offset + 1] === skyline[offset + 1]
    && trigger[offset + 2] === skyline[offset + 2]
    && trigger[offset + 3] === skyline[offset + 3];
}
