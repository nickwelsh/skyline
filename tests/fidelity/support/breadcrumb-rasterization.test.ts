import { describe, expect, test } from "vitest";
import { PNG } from "pngjs";
import { validateAllowedDifferences } from "../../../scripts/fidelity-oracle.mjs";
import allowedDifferences from "../allowed-differences.json" with { type: "json" };
import policy from "../breadcrumb-rasterization-policy.json" with { type: "json" };
import {
  breadcrumbRasterizationRegion,
  fingerprintBreadcrumbRasterizationCandidate,
  validateBreadcrumbRasterizationObservation,
  validateBreadcrumbRasterizationPolicy,
  type BreadcrumbRasterizationObservation,
  type BreadcrumbRasterizationPolicy,
} from "./breadcrumb-rasterization";
import { comparePixels, type DifferenceRegion } from "./pixels";

const approved = policy as unknown as BreadcrumbRasterizationPolicy;
const classic = "error-found@1024x768-classic";
const vendorDark = "errors-application-vendor-frames@1440x960-dark";
const absent = approved.absentCaptures[0];
const zeroState = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
const historicalVendorDarkState = "361d5528a4e4c5a51b8a64c51a9db94b3dd3c9ea550a66d4f3e5e772945615dc";
const historicalVendorDarkCandidate = "66b6ceeac77d3e922878ebf34acf2aafa8e132c80372e072531882ceb139456b";
const vendorDarkCandidate = "a441c92601b7e59ec6ac2f2e4295de67154fb8d9ee17c0bc52d4edb4dc75120a";

describe("breadcrumb renderer rasterization policy", () => {
  test("requires exactly one approved manifest region", () => {
    const breadcrumb = allowedDifferences.regions.find(({ id }) => id === "run-breadcrumb-rasterization")!;
    const minimal = { decision: "NW-216", categories: [], regions: [breadcrumb] };
    expect(() => validateAllowedDifferences({ ...minimal, regions: [] })).toThrow(/breadcrumb renderer manifest/i);
    expect(() => validateAllowedDifferences({ ...minimal, regions: [breadcrumb, breadcrumb] })).toThrow(/breadcrumb renderer manifest/i);
    expect(() => validateAllowedDifferences({ ...minimal, regions: [{ ...breadcrumb, category: "framework-extension" }] })).toThrow(/breadcrumb renderer manifest/i);
  });

  test("locks the complete canonical capture partition and finite states", () => {
    expect(validateBreadcrumbRasterizationPolicy(approved)).toBe(approved);
    expect(Object.keys(approved.captures)).toHaveLength(196);
    expect(approved.absentCaptures).toHaveLength(243);
    expect(approved.states).toHaveLength(9);
    expect(new Set([...Object.keys(approved.captures), ...approved.absentCaptures])).toHaveProperty("size", 439);

    expect(() => validateBreadcrumbRasterizationPolicy({
      ...approved,
      captures: { ...approved.captures, [absent]: approved.captures[classic] },
      absentCaptures: approved.absentCaptures.slice(1),
    })).toThrow(/approved policy/i);
    expect(() => validateBreadcrumbRasterizationPolicy({
      ...approved,
      states: approved.states.map((state, index) => index ? state : { ...state, sha256: "f".repeat(64) }),
    })).toThrow(/approved policy/i);
  });

  test("accepts only one exact per-capture state and evidence pairing", () => {
    const observation = classicObservation();
    const resolved = validateBreadcrumbRasterizationObservation(approved, classic, observation);

    expect(resolved).toMatchObject({ status: "visible", stateSha256: zeroState });
    expect(approved.captures[classic].candidates).toContainEqual({
      sha256: fingerprintBreadcrumbRasterizationCandidate(zeroState, observation.trigger!, observation.skyline!),
    });
    expect(breadcrumbRasterizationRegion(approved, classic, observation)).toBeUndefined();

    const otherState = approved.states.find(({ sha256 }) => sha256 !== zeroState)!;
    expect(() => validateBreadcrumbRasterizationObservation(approved, classic, { ...observation, pixels: otherState.pixels })).toThrow(/capture evidence/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, classic, { ...observation, pixels: [{ x: 0, y: 0, trigger: [0, 0, 0, 255], skyline: [1, 1, 1, 255] }] })).toThrow(/finite state/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, classic, {
      ...observation,
      skyline: { ...observation.skyline!, svg: { ...observation.skyline!.svg, cropSha256: "f".repeat(64) } },
    })).toThrow(/capture evidence/i);
  });

  test("rejects the replaced historical vendor-dark raster state", () => {
    const historical = vendorDarkObservation(true);
    expect(fingerprintBreadcrumbRasterizationCandidate(historicalVendorDarkState, historical.trigger!, historical.skyline!))
      .toBe(historicalVendorDarkCandidate);
    expect(() => validateBreadcrumbRasterizationObservation(approved, vendorDark, historical)).toThrow(/capture evidence/i);
  });

  test("accepts only the observed vendor-dark zero state and exact evidence", () => {
    const observation = vendorDarkObservation(false);
    expect(validateBreadcrumbRasterizationObservation(approved, vendorDark, observation)).toMatchObject({
      status: "visible",
      stateSha256: zeroState,
      candidateSha256: vendorDarkCandidate,
    });
    expect(approved.captures[vendorDark].candidates).toEqual([{ sha256: vendorDarkCandidate }]);
    expect(() => validateBreadcrumbRasterizationObservation(approved, vendorDark, {
      ...observation,
      trigger: {
        ...observation.trigger!,
        svg: { ...observation.trigger!.svg, cropSha256: "6b70e79e11a0c0e539c6f9af4f4b77556478ebc2c632980978f8650bd2aa2666" },
      },
    })).toThrow(/capture evidence/i);
  });

  test("fingerprints exact evidence independently of object insertion order", () => {
    const observation = classicObservation();
    const reorder = (element: NonNullable<BreadcrumbRasterizationObservation["trigger"]>["svg"]) => {
      const { cropSha256, ...snapshot } = element;
      return { ...snapshot, cropSha256 };
    };
    const reorderedTrigger = { svg: reorder(observation.trigger!.svg), line: reorder(observation.trigger!.line) };
    const reorderedSkyline = { svg: reorder(observation.skyline!.svg), line: reorder(observation.skyline!.line) };

    expect(fingerprintBreadcrumbRasterizationCandidate(zeroState, reorderedTrigger, reorderedSkyline))
      .toBe(fingerprintBreadcrumbRasterizationCandidate(zeroState, observation.trigger!, observation.skyline!));
    expect(fingerprintBreadcrumbRasterizationCandidate(zeroState, {
      ...reorderedTrigger,
      svg: { ...reorderedTrigger.svg, computedStyleSha256: "f".repeat(64) },
    }, reorderedSkyline)).not.toBe(fingerprintBreadcrumbRasterizationCandidate(zeroState, observation.trigger!, observation.skyline!));
  });

  test("rejects missing and unclassified candidate evidence keys", () => {
    const observation = classicObservation();
    const trigger = observation.trigger!;
    const skyline = observation.skyline!;
    expect(() => fingerprintBreadcrumbRasterizationCandidate(zeroState, { ...trigger, unexpected: true } as typeof trigger, skyline)).toThrow(/evidence keys/i);
    expect(() => fingerprintBreadcrumbRasterizationCandidate(zeroState, {
      ...trigger,
      svg: { ...trigger.svg, rect: { ...trigger.svg.rect, unexpected: 1 } } as typeof trigger.svg,
    }, skyline)).toThrow(/evidence keys/i);
    const { accessibilitySha256: _missing, ...incompleteSvg } = trigger.svg;
    expect(() => fingerprintBreadcrumbRasterizationCandidate(zeroState, {
      ...trigger,
      svg: incompleteSvg as typeof trigger.svg,
    }, skyline)).toThrow(/evidence keys/i);
  });

  test("fails closed on unknown captures, one-sided presence, and absent surfaces", () => {
    const observation = classicObservation();
    expect(() => validateBreadcrumbRasterizationObservation(approved, "runs-new@1440x960-classic", observation)).toThrow(/unknown capture/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, classic, { ...observation, runtime: { ...observation.runtime, browserVersion: "150.0.0.0" } })).toThrow(/runtime/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, classic, { ...observation, skyline: null })).toThrow(/one-sided presence/i);
    expect(() => validateBreadcrumbRasterizationObservation(approved, absent, observation)).toThrow(/must remain absent/i);
    expect(validateBreadcrumbRasterizationObservation(approved, absent, absentObservation())).toEqual({ status: "absent" });
  });

  test("masks only an exact approved finite pixel state", () => {
    const state = approved.states.find(({ pixels }) => pixels.length > 0)!;
    const region = { kind: "breadcrumb-rasterization", id: "run-breadcrumb-rasterization", capture: classic, rect: { x: 1, y: 1, width: 9, height: 20 }, pixels: state.pixels } as DifferenceRegion;
    const trigger = image(state.pixels.map(({ x, y, trigger }) => [1 + x, 1 + y, trigger]));
    const skyline = image(state.pixels.map(({ x, y, skyline }) => [1 + x, 1 + y, skyline]));

    expect(comparePixels(trigger, skyline, [region])).toMatchObject({ differingPixels: 0, maskedPixels: state.pixels.length });
    const partial = state.pixels.slice(1);
    expect(() => comparePixels(
      image(partial.map(({ x, y, trigger }) => [1 + x, 1 + y, trigger])),
      image(partial.map(({ x, y, skyline }) => [1 + x, 1 + y, skyline])),
      [region],
    )).toThrow(/breadcrumb pixel evidence/i);
  });
});

function absentObservation(): BreadcrumbRasterizationObservation {
  return { runtime: runtime(), trigger: null, skyline: null, pixels: [] };
}

function classicObservation(): BreadcrumbRasterizationObservation {
  const svg = {
    rect: { x: 279, y: 9.5, width: 9, height: 20 },
    canonicalDomSha256: "0bd2673317f03e98aea81f9607fa1e455c93a2cb41269bd53cd76a5f007451ff",
    semanticDomSha256: "0bd2673317f03e98aea81f9607fa1e455c93a2cb41269bd53cd76a5f007451ff",
    accessibilitySha256: "b889d027cd41e6cbb7e78b236333f7a963c9f6b70a7b67e8fe8c9e6c06a81ea2",
    computedStyleSha256: "fff6154654aab48e46a61230144f6b1e19cd1bbeef6b883e020a29f23dff1b97",
    effectiveCssSha256: "eb359c2030b8f7c720dac1d1f055a1efc2cdf1b7cf280c3f9b5818bba97fca17",
    quadsSha256: "ac85d95db9ba8cf81f0be1eb572895ff0ab280f65f901e107601f0ce4ffe2cdb",
    backdropSha256: "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9",
    cropSha256: "f2f43d4f07c17d0b8127c7ee47b2f4f2db26fc8c75ba9c1aab304917c3682ad9",
    paint: { currentColor: "rgb(59, 62, 69)", stroke: "none", strokeWidth: "1px", strokeLinecap: "butt" },
    outerHtmlSha256: "9893dc48f811b2e1591a40cd0ee77336194ff3ff54c106893aa308c64789d14b",
  };
  const line = {
    rect: { x: 280.5769348144531, y: 10.038461685180664, width: 6.384613037109375, height: 18.69230842590332 },
    canonicalDomSha256: "57c2f9f99667ea73c3e8e3c76ca68823add37254432d22ef225d61b9a319e6e5",
    semanticDomSha256: "57c2f9f99667ea73c3e8e3c76ca68823add37254432d22ef225d61b9a319e6e5",
    accessibilitySha256: "6f573a28394abd36fabf576dfc4edca27e3dec19c9e3076a5f56e917d494297d",
    computedStyleSha256: "078b0da345497c509730006f410df40eda22a673905e9660f70fa827bdbb2fcc",
    effectiveCssSha256: "3178c812d30ba758b59ca68f385ea49bbd29730646b0e426c50ad8eeac1cb23a",
    quadsSha256: "deeb8e87df7abc9348adea10de5dcfa24998a1fa1dbe8a3c78c1f3d11568abd8",
    backdropSha256: "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9",
    cropSha256: "71965163b3842a7453cfa7fb3e12954604231356d54db5d62150b57b5f789bb3",
    paint: { currentColor: "rgb(59, 62, 69)", stroke: "rgb(59, 62, 69)", strokeWidth: "1.4px", strokeLinecap: "round" },
    outerHtmlSha256: "74168b60a70c7e8fbdf53907f25292d24c282a62e2110c679e5e156e855572b2",
  };
  return {
    runtime: runtime(),
    viewport: { width: 1024, height: 768 },
    trigger: { svg: { ...svg, matchingRulesSha256: "f67b3269e2bc6d467a5dac73a9b7dde31f73b7b1f0725bd6aed40c9cfe42ffa6" }, line: { ...line, matchingRulesSha256: "b1467680233711311e31e401e829bfd70385bd843468498c7b5ec83bbfd2867b" } },
    skyline: { svg: { ...svg, matchingRulesSha256: "a43da8d69ed70c41654a3fcedca23dd114c46293832a645563ea4cbb470e63a4" }, line: { ...line, matchingRulesSha256: "9aa9b0223811298c2d4600598f6acd62cdb18075a425483777bd435fa2fc0e5b" } },
    pixels: [],
  };
}

function vendorDarkObservation(historical: boolean): BreadcrumbRasterizationObservation {
  const observation = classicObservation();
  const darkSvg = {
    computedStyleSha256: "509ecdc16ce9a54f35fb4dc93770117a48721d28e24e42350098c00d82a894fa",
    backdropSha256: "df218850753b506666ad2bcaa018b0bd1cf137690bab6b79070a93b80c59b10f",
    paint: { currentColor: "color(srgb 0.360502 0.37029 0.393129)", stroke: "none", strokeWidth: "1px", strokeLinecap: "butt" },
    cropSha256: "98c77bb342473b48101a04025efbc88414c4527990ae5ff5ffb77352afb25bf6",
  };
  const darkLine = {
    computedStyleSha256: "2c501aa721727d8b0fe01bcb0a29e32755c38a7046121ac3d9b416ec777b4f05",
    backdropSha256: "df218850753b506666ad2bcaa018b0bd1cf137690bab6b79070a93b80c59b10f",
    paint: { currentColor: "color(srgb 0.360502 0.37029 0.393129)", stroke: "color(srgb 0.360502 0.37029 0.393129)", strokeWidth: "1.4px", strokeLinecap: "round" },
    cropSha256: "131f61d3cf2d0a8d72ac3abbcd60349cf35974491fdf4955edefd8ed38f0dcde",
  };
  const trigger = {
    svg: { ...observation.trigger!.svg, ...darkSvg, ...(historical ? { cropSha256: "6b70e79e11a0c0e539c6f9af4f4b77556478ebc2c632980978f8650bd2aa2666" } : {}) },
    line: { ...observation.trigger!.line, ...darkLine, ...(historical ? { cropSha256: "5e3f06c6a59dfc8b42d326eaad168e78295fe03d93514a15bd3fb78755bdf73c" } : {}) },
  };
  const skyline = {
    svg: { ...observation.skyline!.svg, ...darkSvg },
    line: { ...observation.skyline!.line, ...darkLine },
  };
  return {
    runtime: observation.runtime,
    viewport: { width: 1440, height: 960 },
    trigger,
    skyline,
    pixels: historical ? approved.states.find(({ sha256 }) => sha256 === historicalVendorDarkState)!.pixels : [],
  };
}

function runtime() {
  return { browserVersion: "145.0.7632.6", platform: "Linux x86_64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" };
}

function image(changes: Array<[number, number, [number, number, number, number]]>) {
  const png = new PNG({ width: 12, height: 24 });
  for (let offset = 0; offset < png.data.length; offset += 4) png.data.set([255, 255, 255, 255], offset);
  for (const [x, y, rgba] of changes) png.data.set(rgba, (y * png.width + x) * 4);
  return PNG.sync.write(png);
}
