import { PNG } from "pngjs";
import { describe, expect, test } from "vitest";
import { comparePixels, type DifferenceRegion } from "./pixels";

describe("paired fidelity pixels", () => {
  test("allows differing glyph pixels only inside an equivalent named selector region", () => {
    const trigger = image([255, 0, 0, 255], 10, 10);
    const skyline = image([255, 0, 0, 255], 10, 10, [[0, 0, [0, 0, 0, 255]]]);

    expect(comparePixels(trigger, skyline, [region()])).toMatchObject({ differingPixels: 0, maskedPixels: 1 });
  });

  test("fails on pixels outside masks or changed selector observations", () => {
    const trigger = image([255, 0, 0, 255], 10, 10);
    const skyline = image([255, 0, 0, 255], 10, 10, [[9, 9, [0, 0, 0, 255]]]);

    expect(() => comparePixels(trigger, skyline, [region()])).toThrow(/1 unclassified pixel/i);
    expect(() => comparePixels(trigger, trigger, [region({ accessibleName: "Changed" })])).toThrow(/accessible name/i);
  });

  test("allows an exact narrow framework extension and fails closed on drift", () => {
    const trigger = image([255, 0, 0, 255], 10, 10);
    const skyline = image([255, 0, 0, 255], 10, 10, [[0, 0, [0, 0, 0, 255]]]);
    const extension = extensionRegion();

    expect(comparePixels(trigger, skyline, [extension])).toMatchObject({ differingPixels: 0, maskedPixels: 1 });
    expect(() => comparePixels(trigger, skyline, [{ ...extension, extension: { ...extension.extension, accessibleName: "Changed" } }])).toThrow(/accessibleName/i);
  });
});

function image(color: [number, number, number, number], width: number, height: number, changes: Array<[number, number, [number, number, number, number]]> = []) {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) png.data.set(color, offset);
  for (const [x, y, changed] of changes) png.data.set(changed, (y * width + x) * 4);
  return PNG.sync.write(png);
}

function region(skyline: Partial<Extract<DifferenceRegion, { kind?: "paired" }>["skyline"]> = {}): DifferenceRegion {
  const observation = { selector: "[data-oracle-region='identity']", rect: { x: 0, y: 0, width: 1, height: 1 }, computedStyle: { color: "rgb(255, 0, 0)", fontSize: "12px" }, accessibleName: "Application identity" };
  return { id: "identity", trigger: observation, skyline: { ...observation, ...skyline } };
}

function extensionRegion(): Extract<DifferenceRegion, { kind: "framework-extension" }> {
  const expected = { skylineSelector: "[data-extension]", triggerAnchorSelector: "[data-anchor]", skylineAnchorSelector: "[data-anchor]", accessibleRole: "region", accessibleName: "Exception", relativeRect: { x: 0, y: 1, width: 1, height: 1 }, computedStyleSha256: "a".repeat(64), anchorRect: { x: 0, y: 0, width: 1, height: 1 }, anchorComputedStyleSha256: "b".repeat(64) };
  return { kind: "framework-extension", id: "php-exception-evidence", expected, extension: { ...expected, rect: { x: 0, y: 0, width: 1, height: 1 } } };
}
