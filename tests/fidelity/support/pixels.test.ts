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

  test("masks the union of paired presenter subregions and rejects drift", () => {
    const trigger = image([255, 0, 0, 255], 10, 10);
    const skyline = image([255, 0, 0, 255], 10, 10, [[0, 0, [0, 0, 0, 255]], [1, 0, [0, 0, 0, 255]]]);
    const presenter = presenterRegion();

    expect(comparePixels(trigger, skyline, [presenter])).toMatchObject({ differingPixels: 0, maskedPixels: 2 });
    expect(() => comparePixels(trigger, skyline, [{ ...presenter, presenter: { ...presenter.presenter, skylineAccessibilitySha256: "0".repeat(64) } }])).toThrow(/skylineAccessibilitySha256/i);
  });

  test("allows an exact dialog presenter union but keeps a bounded ceiling", () => {
    const screenshot = image([255, 0, 0, 255], 10, 10);

    expect(comparePixels(screenshot, screenshot, [sizedPresenter(8, 8)])).toMatchObject({ differingPixels: 0 });
    expect(() => comparePixels(screenshot, screenshot, [sizedPresenter(9, 8)])).toThrow(/too broad/i);
  });

  test("masks only the union of disjoint capability-omission selector pairs", () => {
    const trigger = image([255, 0, 0, 255], 10, 10);
    const skyline = image([255, 0, 0, 255], 10, 10, [[0, 0, [0, 0, 0, 255]], [2, 0, [0, 0, 0, 255]]]);
    const omission = capabilityOmissionRegion();
    const overlappingPair = { ...omission.omissions[1], triggerRect: { x: 0, y: 0, width: 1, height: 1 }, skylineRect: { x: 0, y: 0, width: 1, height: 1 } };
    const overlapping = { ...omission, omissions: [omission.omissions[0], overlappingPair], expected: { ...omission.expected, [overlappingPair.id]: { ...omission.expected[overlappingPair.id], triggerRect: overlappingPair.triggerRect, skylineRect: overlappingPair.skylineRect } } };

    expect(comparePixels(trigger, skyline, [omission])).toMatchObject({ differingPixels: 0, maskedPixels: 2 });
    expect(() => comparePixels(trigger, skyline, [overlapping])).toThrow(/overlap/i);
    expect(() => comparePixels(trigger, skyline, [{ ...omission, omissions: omission.omissions.map((pair, index) => index ? pair : { ...pair, triggerComputedStyleSha256: "0".repeat(64) }) }])).toThrow(/triggerComputedStyleSha256/i);
  });

  test("unions quantized masks for touching fractional regions but rejects true overlap", () => {
    const trigger = image([255, 0, 0, 255], 10, 10);
    const skyline = image([255, 0, 0, 255], 10, 10, [
      [0, 0, [0, 0, 0, 255]],
      [1, 0, [0, 0, 0, 255]],
      [2, 0, [0, 0, 0, 255]],
    ]);

    expect(comparePixels(trigger, skyline, [fractionalCapabilityOmissionRegion(1.75)]))
      .toMatchObject({ differingPixels: 0, maskedPixels: 3 });
    expect(() => comparePixels(trigger, skyline, [fractionalCapabilityOmissionRegion(1.5)]))
      .toThrow(/overlap/i);
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

function presenterRegion(): Extract<DifferenceRegion, { kind: "presenter-extension" }> {
  const expected = {
    triggerSelector: "[translate='no']", skylineSelector: "[data-presenter]", triggerAnchorSelector: "[data-anchor]", skylineAnchorSelector: "[data-anchor]",
    skylineAccessibleRole: "region", skylineAccessibleName: "Exception",
    triggerRelativeRect: { x: 0, y: 0, width: 2, height: 1 }, skylineRelativeRect: { x: 0, y: 0, width: 2, height: 1 },
    triggerComputedStyleSha256: "a".repeat(64), skylineComputedStyleSha256: "b".repeat(64), triggerAccessibilitySha256: "c".repeat(64), skylineAccessibilitySha256: "d".repeat(64),
    anchorRect: { x: 0, y: 0, width: 2, height: 1 }, anchorComputedStyleSha256: "e".repeat(64), anchorAccessibilitySha256: "f".repeat(64), anchorAccessibleName: "Illuminate\\Database\\DeadlockException",
  };
  return { kind: "presenter-extension", id: "attempt-exception-evidence", expected, presenter: { ...expected, triggerRect: { x: 0, y: 0, width: 2, height: 1 }, skylineRect: { x: 0, y: 0, width: 2, height: 1 } } };
}

function sizedPresenter(width: number, height: number) {
  const region = presenterRegion();
  const relativeRect = { x: 0, y: 0, width, height };
  const anchorRect = { x: 0, y: 0, width, height };
  const expected = { ...region.expected, triggerRelativeRect: relativeRect, skylineRelativeRect: relativeRect, anchorRect };
  return { ...region, expected, presenter: { ...region.presenter, ...expected, triggerRect: relativeRect, skylineRect: relativeRect } };
}

function capabilityOmissionRegion(): Extract<DifferenceRegion, { kind: "capability-omission" }> {
  const hashes = {
    triggerComputedStyleSha256: "a".repeat(64), skylineComputedStyleSha256: "b".repeat(64),
    triggerAccessibilitySha256: "c".repeat(64), skylineAccessibilitySha256: "d".repeat(64),
  };
  const omissions = [0, 2].map((x, index) => ({
    id: `pair-${index}`,
    triggerSelector: `[data-trigger='${index}']`,
    skylineSelector: `[data-skyline='${index}']`,
    triggerRect: { x, y: 0, width: 1, height: 1 },
    skylineRect: { x, y: 0, width: 1, height: 1 },
    ...hashes,
  }));
  return { kind: "capability-omission", id: "queue-unavailable-capabilities", omissions, expected: Object.fromEntries(omissions.map(({ id, triggerRect, skylineRect, ...measurement }) => [id, { triggerRect, skylineRect, ...measurement }])) };
}

function fractionalCapabilityOmissionRegion(secondX: number): Extract<DifferenceRegion, { kind: "capability-omission" }> {
  const region = capabilityOmissionRegion();
  const omissions = [
    { ...region.omissions[0], triggerRect: { x: 0.25, y: 0, width: 1.5, height: 1 }, skylineRect: { x: 0.25, y: 0, width: 1.5, height: 1 } },
    { ...region.omissions[1], triggerRect: { x: secondX, y: 0, width: 1.5, height: 1 }, skylineRect: { x: secondX, y: 0, width: 1.5, height: 1 } },
  ];
  return { ...region, omissions, expected: Object.fromEntries(omissions.map(({ id, triggerRect, skylineRect, ...measurement }) => [id, { triggerRect, skylineRect, ...measurement }])) };
}
