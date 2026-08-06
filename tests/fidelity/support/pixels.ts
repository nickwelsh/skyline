import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

type Rect = { x: number; y: number; width: number; height: number };
type Mask = { rect: Rect; source: Rect };
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
  omissions: Array<{ id: string; triggerSelector: string; skylineSelector: string } & CapabilityOmissionMeasurement>;
  expected: Record<string, CapabilityOmissionMeasurement>;
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
export type DifferenceRegion = PairedRegion | FrameworkExtensionRegion | PresenterExtensionRegion | CapabilityOmissionRegion;

export function comparePixels(triggerBuffer: Buffer, skylineBuffer: Buffer, regions: DifferenceRegion[]) {
  const comparison = measurePixels(triggerBuffer, skylineBuffer, regions);
  if (comparison.differingPixels > 0) throw new Error(`${comparison.differingPixels} unclassified pixel${comparison.differingPixels === 1 ? "" : "s"} differ outside accepted regions.`);
  return comparison;
}

export function measurePixels(triggerBuffer: Buffer, skylineBuffer: Buffer, regions: DifferenceRegion[]) {
  const trigger = PNG.sync.read(triggerBuffer);
  const skyline = PNG.sync.read(skylineBuffer);
  if (trigger.width !== skyline.width || trigger.height !== skyline.height) throw new Error("Paired screenshots have different dimensions.");

  const regionMasks = regions.map((region) => validateRegion(region, trigger.width, trigger.height));
  rejectOverlaps(regionMasks);
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

function validateRegion(region: DifferenceRegion, imageWidth: number, imageHeight: number): Mask[] {
  if (region.kind === "framework-extension") {
    for (const key of ["skylineSelector", "triggerAnchorSelector", "skylineAnchorSelector", "accessibleRole", "accessibleName", "computedStyleSha256", "anchorComputedStyleSha256"] as const) {
      if (region.extension[key] !== region.expected[key]) throw new Error(`Allowed region ${region.id} changed ${key}.`);
    }
    if (JSON.stringify(region.extension.relativeRect) !== JSON.stringify(region.expected.relativeRect)) throw new Error(`Allowed region ${region.id} changed anchor-relative geometry.`);
    if (JSON.stringify(region.extension.anchorRect) !== JSON.stringify(region.expected.anchorRect)) throw new Error(`Allowed region ${region.id} anchor changed locked geometry.`);
    return [boundedMask(region.id, region.extension.rect, imageWidth, imageHeight)];
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
      boundedMask(region.id, region.presenter.triggerRect, imageWidth, imageHeight, 0.65),
      boundedMask(region.id, region.presenter.skylineRect, imageWidth, imageHeight, 0.65),
    ];
  }
  if (region.kind === "capability-omission") {
    const pairMasks = region.omissions.map((pair) => {
      const expected = region.expected[pair.id];
      if (!expected) throw new Error(`Allowed region ${region.id} lacks measurement for pair ${pair.id}.`);
      for (const key of ["triggerRect", "skylineRect", "triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256"] as const) {
        if (JSON.stringify(pair[key]) !== JSON.stringify(expected[key])) throw new Error(`Allowed region ${region.id} pair ${pair.id} changed ${key}.`);
      }
      return [
        boundedMask(`${region.id}:${pair.id}:trigger`, pair.triggerRect, imageWidth, imageHeight),
        boundedMask(`${region.id}:${pair.id}:skyline`, pair.skylineRect, imageWidth, imageHeight),
      ];
    });
    rejectOverlaps(pairMasks);
    return pairMasks.flat();
  }
  const triggerRect = integerRect(region.trigger.rect);
  const skylineRect = integerRect(region.skyline.rect);
  if (JSON.stringify(triggerRect) !== JSON.stringify(skylineRect)) throw new Error(`Allowed region ${region.id} changed geometry.`);
  if (JSON.stringify(region.trigger.computedStyle) !== JSON.stringify(region.skyline.computedStyle)) throw new Error(`Allowed region ${region.id} changed computed style.`);
  if (region.trigger.accessibleName !== region.skyline.accessibleName) throw new Error(`Allowed region ${region.id} changed accessible name.`);
  return [boundedMask(region.id, region.trigger.rect, imageWidth, imageHeight)];
}

function boundedMask(id: string, source: Rect, imageWidth: number, imageHeight: number, maximumFraction = 0.15): Mask {
  return { rect: boundedRect(id, source, imageWidth, imageHeight, maximumFraction), source };
}

function boundedRect(id: string, rect: Rect, imageWidth: number, imageHeight: number, maximumFraction = 0.15) {
  const integer = integerRect(rect);
  if (integer.width * integer.height > imageWidth * imageHeight * maximumFraction) throw new Error(`Allowed region ${id} is too broad.`);
  if (integer.x < 0 || integer.y < 0 || integer.x + integer.width > imageWidth || integer.y + integer.height > imageHeight) throw new Error(`Allowed region ${id} leaves the screenshot.`);
  return integer;
}

function integerRect(rect: Rect): Rect {
  return { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
}

function rejectOverlaps(regions: Mask[][]) {
  for (let left = 0; left < regions.length; left += 1) {
    for (let right = left + 1; right < regions.length; right += 1) {
      for (const a of regions[left]) for (const b of regions[right]) {
        if (overlaps(a.rect, b.rect) && overlaps(a.source, b.source)) throw new Error("Allowed-difference regions overlap.");
      }
    }
  }
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function samePixel(trigger: Buffer, skyline: Buffer, offset: number) {
  return trigger[offset] === skyline[offset]
    && trigger[offset + 1] === skyline[offset + 1]
    && trigger[offset + 2] === skyline[offset + 2]
    && trigger[offset + 3] === skyline[offset + 3];
}
