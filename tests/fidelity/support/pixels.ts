import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

type Rect = { x: number; y: number; width: number; height: number };
type Observation = { selector: string; rect: Rect; computedStyle: Record<string, string>; accessibleName: string };
export type DifferenceRegion = { id: string; trigger: Observation; skyline: Observation };

export function comparePixels(triggerBuffer: Buffer, skylineBuffer: Buffer, regions: DifferenceRegion[]) {
  const trigger = PNG.sync.read(triggerBuffer);
  const skyline = PNG.sync.read(skylineBuffer);
  if (trigger.width !== skyline.width || trigger.height !== skyline.height) throw new Error("Paired screenshots have different dimensions.");

  const masks = regions.map((region) => validateRegion(region, trigger.width, trigger.height));
  rejectOverlaps(masks);
  let maskedPixels = 0;
  for (const rect of masks) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const offset = (y * trigger.width + x) * 4;
        if (!samePixel(trigger.data, skyline.data, offset)) maskedPixels += 1;
        skyline.data.set(trigger.data.subarray(offset, offset + 4), offset);
      }
    }
  }

  const differingPixels = pixelmatch(trigger.data, skyline.data, undefined, trigger.width, trigger.height, { threshold: 0, includeAA: true });
  if (differingPixels > 0) throw new Error(`${differingPixels} unclassified pixel${differingPixels === 1 ? "" : "s"} differ outside accepted regions.`);
  return { differingPixels, maskedPixels, regions: regions.map(({ id }) => id) };
}

function validateRegion(region: DifferenceRegion, imageWidth: number, imageHeight: number): Rect {
  const triggerRect = integerRect(region.trigger.rect);
  const skylineRect = integerRect(region.skyline.rect);
  if (JSON.stringify(triggerRect) !== JSON.stringify(skylineRect)) throw new Error(`Allowed region ${region.id} changed geometry.`);
  if (JSON.stringify(region.trigger.computedStyle) !== JSON.stringify(region.skyline.computedStyle)) throw new Error(`Allowed region ${region.id} changed computed style.`);
  if (region.trigger.accessibleName !== region.skyline.accessibleName) throw new Error(`Allowed region ${region.id} changed accessible name.`);
  if (triggerRect.width * triggerRect.height > imageWidth * imageHeight * 0.15) throw new Error(`Allowed region ${region.id} is too broad.`);
  if (triggerRect.x < 0 || triggerRect.y < 0 || triggerRect.x + triggerRect.width > imageWidth || triggerRect.y + triggerRect.height > imageHeight) throw new Error(`Allowed region ${region.id} leaves the screenshot.`);
  return triggerRect;
}

function integerRect(rect: Rect): Rect {
  return { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
}

function rejectOverlaps(rects: Rect[]) {
  for (let left = 0; left < rects.length; left += 1) {
    for (let right = left + 1; right < rects.length; right += 1) {
      const a = rects[left]; const b = rects[right];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) throw new Error("Allowed-difference regions overlap.");
    }
  }
}

function samePixel(trigger: Buffer, skyline: Buffer, offset: number) {
  return trigger[offset] === skyline[offset]
    && trigger[offset + 1] === skyline[offset + 1]
    && trigger[offset + 2] === skyline[offset + 2]
    && trigger[offset + 3] === skyline[offset + 3];
}
