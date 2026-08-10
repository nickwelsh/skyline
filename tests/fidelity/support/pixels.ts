import { createHash } from "node:crypto";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { BreadcrumbRasterizationRegion } from "./breadcrumb-rasterization";

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
type Rgba = [number, number, number, number];
export type RendererRasterizationElement = {
  selector: string;
  rect: Rect;
  computedStyleSha256: string;
  accessibilitySha256: string;
  domSha256: string;
  semanticDomSha256: string;
  cssRulesSha256: string;
  effectiveCssRulesSha256: string;
  boxModelSha256: string;
  quadsSha256: string;
  backdropSha256: string;
  cropSha256: string;
};
export type RendererRasterizationPresentation = { borderColor: string; backgroundColor: string; backdropColor: string; borderRadius: string };
export type RendererRasterizationObservation = {
  runtime: { browserVersion: string; platform: string; deviceScaleFactor: number; locale: string; timezone: string };
  presentation: RendererRasterizationPresentation;
  trigger: RendererRasterizationElement;
  skyline: RendererRasterizationElement;
};
export type RendererRasterizationRegion = {
  kind: "renderer-rasterization";
  id: string;
  observation: RendererRasterizationObservation;
  expected: RendererRasterizationObservation;
  pixels: Array<{ x: number; y: number; trigger: Rgba; skyline: Rgba }>;
  alternatives?: Array<{ expected: RendererRasterizationObservation; pixels: Array<{ x: number; y: number; trigger: Rgba; skyline: Rgba }> }>;
};
export type DifferenceRegion = PairedRegion | FrameworkExtensionRegion | PresenterExtensionRegion | CapabilityOmissionRegion | BrandingIdentityRegion | RendererRasterizationRegion | BreadcrumbRasterizationRegion;

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
  if (region.kind === "breadcrumb-rasterization") {
    validateRendererPixels(region.id, region.rect, region.pixels);
    const actual = exactRendererDeltas(triggerImage, skylineImage, region.rect);
    if (JSON.stringify(canonicalRendererPixels(actual)) !== JSON.stringify(canonicalRendererPixels(region.pixels))) throw new Error(`Allowed region ${region.id} changed exact breadcrumb pixel evidence.`);
    return region.pixels.map(({ x, y }, index) => boundedMask(`${region.id}:pixel-${index}`, {
      x: region.rect.x + x,
      y: region.rect.y + y,
      width: 1,
      height: 1,
    }, "both", imageWidth, imageHeight));
  }
  if (region.kind === "renderer-rasterization") {
    const pixels = validateRendererRasterization(region, triggerImage, skylineImage);
    return pixels.map(({ x, y }, index) => boundedMask(`${region.id}:pixel-${index}`, {
      x: region.observation.trigger.rect.x + x,
      y: region.observation.trigger.rect.y + y,
      width: 1,
      height: 1,
    }, "both", imageWidth, imageHeight));
  }
  if (region.kind === "branding-identity") {
    if (region.identityPairs.length !== Object.keys(region.expected.identityPairs).length) throw new Error(`Allowed region ${region.id} changed identity pair count.`);
    for (const pair of region.identityPairs) {
      const expected = region.expected.identityPairs[pair.id];
      if (!expected || JSON.stringify({ trigger: pair.trigger, skyline: pair.skyline }) !== JSON.stringify(expected)) throw new Error(`Allowed region ${region.id} changed identity pair ${pair.id} evidence.`);
    }
    if (JSON.stringify({ trigger: region.navigation.trigger, skyline: region.navigation.skyline }) !== JSON.stringify(region.expected.navigation)) throw new Error(`Allowed region ${region.id} changed protected navigation evidence.`);
    const identityDelta = region.identityPairs.reduce((total, pair) => total + pair.trigger.rect.height - pair.skyline.rect.height, 0);
    if (region.navigation.trigger.rect.x !== region.navigation.skyline.rect.x || region.navigation.trigger.rect.width !== region.navigation.skyline.rect.width || region.navigation.trigger.rect.y - region.navigation.skyline.rect.y !== identityDelta) throw new Error(`Allowed region ${region.id} changed navigation reflow.`);
    if (region.protectedPairs.length !== Object.keys(region.expected.protectedPairs).length) throw new Error(`Allowed region ${region.id} changed protected pair count.`);
    for (const pair of region.protectedPairs) {
      const expected = region.expected.protectedPairs[pair.id];
      if (!expected || JSON.stringify({ trigger: pair.trigger, skyline: pair.skyline }) !== JSON.stringify(expected)) throw new Error(`Allowed region ${region.id} changed protected pair ${pair.id} evidence.`);
      if (pair.trigger.rect.x !== pair.skyline.rect.x || pair.trigger.rect.width !== pair.skyline.rect.width || pair.trigger.rect.height !== pair.skyline.rect.height) throw new Error(`Allowed region ${region.id} changed protected ${pair.id} geometry.`);
      if (pair.trigger.rect.y - pair.skyline.rect.y !== identityDelta) throw new Error(`Allowed region ${region.id} changed protected ${pair.id} reflow.`);
      if (pair.trigger.computedStyleSha256 !== pair.skyline.computedStyleSha256) throw new Error(`Allowed region ${region.id} changed protected ${pair.id} style.`);
      if (pair.trigger.accessibilitySha256 !== pair.skyline.accessibilitySha256) throw new Error(`Allowed region ${region.id} changed protected ${pair.id} accessibility.`);
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

function validateRendererRasterization(region: RendererRasterizationRegion, triggerImage: PNG, skylineImage: PNG) {
  if (JSON.stringify(region.observation.runtime) !== JSON.stringify(region.expected.runtime)) throw new Error(`Allowed region ${region.id} changed renderer runtime.`);
  if (JSON.stringify(region.observation.presentation) !== JSON.stringify(region.expected.presentation)) throw new Error(`Allowed region ${region.id} changed renderer presentation.`);
  for (const application of ["trigger", "skyline"] as const) {
    const observed = region.observation[application];
    const expected = region.expected[application];
    if (observed.selector !== expected.selector) throw new Error(`Allowed region ${region.id} changed ${application} selector.`);
    if (JSON.stringify(observed.rect) !== JSON.stringify(expected.rect)) throw new Error(`Allowed region ${region.id} changed ${application} geometry.`);
    for (const [key, label] of [
      ["computedStyleSha256", "style"],
      ["accessibilitySha256", "accessibility"],
      ["domSha256", "DOM"],
      ["semanticDomSha256", "semantic DOM"],
      ["cssRulesSha256", "CSS rules"],
      ["effectiveCssRulesSha256", "effective CSS rules"],
      ["boxModelSha256", "box model"],
      ["quadsSha256", "quads"],
      ["backdropSha256", "backdrop"],
    ] as const) if (observed[key] !== expected[key]) throw new Error(`Allowed region ${region.id} changed ${application} ${label}.`);
  }
  const approvedObservations = [region.expected, ...(region.alternatives ?? []).map(({ expected }) => expected)];
  const approvedCrop = approvedObservations.some((expected) => region.observation.trigger.cropSha256 === expected.trigger.cropSha256
    && region.observation.skyline.cropSha256 === expected.skyline.cropSha256);
  const inactiveObservation = region.observation.trigger.cropSha256 === region.observation.skyline.cropSha256;
  if (!inactiveObservation && !approvedCrop) throw new Error(`Allowed region ${region.id} changed exact crop evidence.`);
  const trigger = region.observation.trigger;
  const skyline = region.observation.skyline;
  for (const [key, label] of [
    ["selector", "selector"],
    ["rect", "geometry"],
    ["computedStyleSha256", "style"],
    ["accessibilitySha256", "accessibility"],
    ["semanticDomSha256", "semantic DOM"],
    ["effectiveCssRulesSha256", "effective CSS rules"],
    ["boxModelSha256", "box model"],
    ["quadsSha256", "quads"],
    ["backdropSha256", "backdrop"],
  ] as const) if (JSON.stringify(trigger[key]) !== JSON.stringify(skyline[key])) throw new Error(`Allowed region ${region.id} changed cross-side ${label}.`);

  const alternatives = [region.pixels, ...(region.alternatives ?? []).map(({ pixels }) => pixels)];
  for (const pixels of alternatives) validateRendererPixels(region.id, trigger.rect, pixels);
  const actual = exactRendererDeltas(triggerImage, skylineImage, trigger.rect);
  if (actual.length === 0) return [];
  const actualEvidence = JSON.stringify(canonicalRendererPixels(actual));
  const triggerCropSha256 = rendererCropSha256(triggerImage, trigger.rect);
  const skylineCropSha256 = rendererCropSha256(skylineImage, skyline.rect);
  const states = [
    { expected: region.expected, pixels: region.pixels },
    ...(region.alternatives ?? []),
  ];
  const approvedState = states.find(({ expected, pixels }) => expected.trigger.cropSha256 === triggerCropSha256
    && expected.skyline.cropSha256 === skylineCropSha256
    && JSON.stringify(canonicalRendererPixels(pixels)) === actualEvidence);
  if (!approvedState) throw new Error(`Allowed region ${region.id} changed exact renderer crop and pixel evidence.`);
  return approvedState.pixels;
}

function canonicalRendererPixels(pixels: RendererRasterizationRegion["pixels"]) {
  return [...pixels].sort((left, right) => left.y - right.y || left.x - right.x);
}

function rendererCropSha256(image: PNG, rect: Rect) {
  const crop = visibleCrop(image, rect);
  return createHash("sha256").update(`${crop.width}x${crop.height}\0`).update(crop.pixels).digest("hex");
}

function validateRendererPixels(id: string, rect: Rect, pixels: RendererRasterizationRegion["pixels"]) {
  if (pixels.length === 0) throw new Error(`Allowed region ${id} must contain at least one exact pixel.`);
  const coordinates = new Set<string>();
  for (const pixel of pixels) {
    const coordinate = `${pixel.x},${pixel.y}`;
    if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y) || pixel.x < 0 || pixel.y < 0
      || pixel.x >= rect.width || pixel.y >= rect.height || coordinates.has(coordinate)) throw new Error(`Allowed region ${id} has an invalid or duplicate coordinate.`);
    coordinates.add(coordinate);
    if (![pixel.trigger, pixel.skyline].every(validRgba)) throw new Error(`Allowed region ${id} has invalid RGBA evidence.`);
  }
}

function exactRendererDeltas(trigger: PNG, skyline: PNG, rect: Rect): RendererRasterizationRegion["pixels"] {
  const pixels: RendererRasterizationRegion["pixels"] = [];
  const bounded = boundedRect("renderer rasterization", rect, trigger.width, trigger.height, 1);
  for (let y = bounded.y; y < bounded.y + bounded.height; y += 1) {
    for (let x = bounded.x; x < bounded.x + bounded.width; x += 1) {
      const offset = (y * trigger.width + x) * 4;
      const triggerPixel = [...trigger.data.subarray(offset, offset + 4)] as Rgba;
      const skylinePixel = [...skyline.data.subarray(offset, offset + 4)] as Rgba;
      if (triggerPixel.every((channel, index) => channel === skylinePixel[index])) continue;
      pixels.push({ x: x - bounded.x, y: y - bounded.y, trigger: triggerPixel, skyline: skylinePixel });
    }
  }
  return pixels;
}

function validRgba(value: Rgba) {
  return Array.isArray(value) && value.length === 4 && value.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255);
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
