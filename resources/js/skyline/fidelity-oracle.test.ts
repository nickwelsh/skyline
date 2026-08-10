import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { actionCaptureId, expectedCaptureIds, fidelityInputHashes, type FidelityMatrix, recordFidelityBundle, validateAllowedDifferences as validateAllowedDifferencesRaw, validateFidelityBundleEnvelope } from "../../../scripts/fidelity-oracle.mjs";
import { assertPinnedRecordingEnvironment } from "../../../tests/fidelity/global-setup";
import allowedDifferences from "../../../tests/fidelity/allowed-differences.json" with { type: "json" };

const root = resolve(import.meta.dirname, "../../..");
const breadcrumbRegion = allowedDifferences.regions.find(({ id }) => id === "run-breadcrumb-rasterization")!;
const validateAllowedDifferences = (differences: { regions?: unknown[]; [key: string]: unknown }) => validateAllowedDifferencesRaw({
  ...differences,
  regions: [...(differences.regions ?? []), breadcrumbRegion],
});
describe("source-fidelity oracle", () => {
  test("the acceptance matrix expands every required capture", () => {
    const matrix = JSON.parse(readFileSync(join(root, "tests/fidelity/matrix.json"), "utf8"));
    const captures = expectedCaptureIds(matrix);

    expect(captures).toHaveLength(439);
    expect(captures).toContain("runs-loading@1440x960-classic");
    expect(captures).toContain("run-stale-refresh@1440x960-dark");
    expect(captures).toContain("shell-customized@390x844-classic");
    expect(captures).toContain("log-found@1440x960-system-light");
    expect(captures).toContain("shell-live-change@1440x960-system-dark");
    expect(captures).toContain("runs-exception-unavailable@1440x960-dark");
  });

  test("capture IDs follow every declared matrix dimension", () => {
    const matrix: FidelityMatrix = {
      schemaVersion: 1,
      roots: ["widgets"], details: ["widget"], rootStates: ["ready"], detailStates: ["opened"], ownedStates: {},
      primary: { viewport: [1111, 777], themes: ["sepia"] },
      core: { viewports: [[800, 600]], theme: "contrast", shellStates: ["folded"] },
      system: { viewport: [900, 700], schemes: ["dim"], states: ["populated-roots", "found-details", "appearance", "diagnostics"] },
      actions: [],
    };

    expect(expectedCaptureIds(matrix)).toEqual([
      "shell-appearance@900x700-system-dim",
      "shell-diagnostics@900x700-system-dim",
      "shell-folded@800x600-contrast",
      "widget-found@800x600-contrast",
      "widget-found@900x700-system-dim",
      "widget-opened@1111x777-sepia",
      "widgets-populated@800x600-contrast",
      "widgets-populated@900x700-system-dim",
      "widgets-ready@1111x777-sepia",
    ]);
  });

  test("action proofs use the declared primary viewport and theme", () => {
    const matrix: FidelityMatrix = {
      schemaVersion: 1,
      roots: [], details: [], rootStates: [], detailStates: [], ownedStates: {},
      primary: { viewport: [1111, 777], themes: ["sepia", "light"] },
      core: { viewports: [], theme: "contrast", shellStates: [] },
      system: { viewport: [900, 700], schemes: [], states: [] },
      actions: [],
    };

    expect(actionCaptureId(matrix, "widgets-ready")).toBe("widgets-ready@1111x777-sepia");
  });

  test("allowed differences require a narrow accepted category and selectors", () => {
    expect(() => validateAllowedDifferences({
      decision: "NW-216",
      categories: ["visual-tolerance"],
      regions: [],
    })).toThrow(/unclassified/i);
  });

  test("renderer rasterization requires the exact pinned corner decision", () => {
    const region = rendererRasterizationRegion();
    const manifest = (renderer = region) => ({ decision: "NW-216", categories: ["renderer-rasterization"], regions: [renderer] });

    expect(() => validateAllowedDifferences(manifest())).not.toThrow();
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: ["error-found@1440x960-classic"] }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, triggerSelector: ".text-text-dimmed > [translate='no'], main" }))).toThrow(/selector/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, environment: { ...region.environment, chromiumVersion: "150.0.0.0" } }))).toThrow(/environment/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: region.pixels.slice(0, 5) }))).toThrow(/pixel/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: region.pixels.map((pixel, index) => index ? pixel : { ...pixel, x: 5 }) }))).toThrow(/coordinate|duplicate/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { "error-found@1024x768-classic": { ...region.measurements["error-found@1024x768-classic"], skyline: { ...region.measurements["error-found@1024x768-classic"].skyline, domSha256: "f".repeat(64) } } } }))).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, acceptance: ["Changed"] }))).toThrow(/metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, citations: region.citations.slice(0, 1) }))).toThrow(/metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { "error-found@1024x768-classic": { ...region.measurements["error-found@1024x768-classic"], trigger: { ...region.measurements["error-found@1024x768-classic"].trigger, cropSha256: "f".repeat(64) } } } }))).toThrow(/measurement/i);
  });

  test("renderer rasterization requires the exact approved Classic8 decision", () => {
    const region = rendererRasterizationClassicRegion();
    const manifest = (renderer = region) => ({ decision: "NW-216", categories: ["renderer-rasterization"], regions: [renderer] });

    expect(() => validateAllowedDifferences(manifest())).not.toThrow();
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: region.captures.slice(1) }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: [...region.captures, "error-stale-refresh@1440x960-classic"] }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: [...region.captures].reverse() }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: region.pixels.slice(1) }))).toThrow(/pixel/i);
    expect(region.alternatives).toHaveLength(2);
    expect(region.alternatives[0].captures).toEqual(region.captures);
    expect(() => validateAllowedDifferences(manifest({ ...region, alternatives: [{ ...region.alternatives[0], captures: region.captures.slice(1) }] }))).toThrow(/alternative|metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: [...region.pixels].reverse() }))).toThrow(/pixel/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { ...region.measurements, [region.captures[0]]: { ...region.measurements[region.captures[0]], trigger: { ...region.measurements[region.captures[0]].trigger, cropSha256: "f".repeat(64) } } } }))).toThrow(/measurement/i);
  });

  test("renderer rasterization requires the exact approved Light9 decision", () => {
    const region = rendererRasterizationLightRegion();
    const manifest = (renderer = region) => ({ decision: "NW-216", categories: ["renderer-rasterization"], regions: [renderer] });

    expect(() => validateAllowedDifferences(manifest())).not.toThrow();
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: region.captures.slice(1) }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: [...region.captures, "error-stale-refresh@1440x960-light"] }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: [...region.captures].reverse() }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: region.pixels.slice(1) }))).toThrow(/pixel/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: [...region.pixels].reverse() }))).toThrow(/pixel/i);
    expect(region.alternatives).toHaveLength(2);
    expect(region.alternatives[1].captures).toEqual(region.captures);
    expect(() => validateAllowedDifferences(manifest({ ...region, alternatives: [{ ...region.alternatives[0], pixels: region.alternatives[0].pixels.slice(1) }] }))).toThrow(/pixel|metadata|alternative/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, alternatives: [{ ...region.alternatives[0], triggerCropSha256: "f".repeat(64) }] }))).toThrow(/alternative|metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, alternatives: [region.alternatives[0], { ...region.alternatives[1], captures: region.captures.slice(1) }] }))).toThrow(/alternative|metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, presentation: { ...region.presentation, backdropColor: "rgb(254, 254, 254)" } }))).toThrow(/presentation/i);
  });

  test("branding identity reflow requires the exact NW-226 seam and protected evidence", () => {
    const capture = "error-found@1024x768-classic";
    const element = (rect: { x: number; y: number; width: number; height: number }, pixel = "d") => ({
      rect,
      computedStyleSha256: "a".repeat(64),
      accessibilitySha256: "b".repeat(64),
      crop: { status: "visible", rect, screenshotSha256: pixel.repeat(64) },
    });
    const identityPairs = [
      { id: "brand", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)", skylineSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)" },
      { id: "application", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(2)", skylineSelector: "[data-testid='side-menu-application']" },
    ];
    const protectedPairs = ["tasks", "runs", "logs", "errors", "queues"].map((id) => ({ id, triggerSelector: `[data-action='${id}']`, skylineSelector: `[data-action='${id}']` })).concat([{
      id: "observability",
      triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) button[aria-expanded='true']",
      skylineSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) button[aria-expanded='true']",
    }]);
    const protectedMeasurements = Object.fromEntries(protectedPairs.map(({ id }) => [id, {
      trigger: element({ x: 10, y: 153, width: 205, height: 32 }),
      skyline: element({ x: 10, y: 117, width: 205, height: 32 }),
    }]));
    const region = {
      id: "shell-branding-identity",
      category: "branding-identity",
      decision: "NW-226",
      acceptance: [
        "Skyline retains one Application identity while upstream organization/project switching remains unavailable.",
        "Supported Tasks, Runs, Observability, Logs, Errors, and Queues remain pixel-identical after the exact identity-height reflow, with exact per-side style and accessibility evidence.",
      ],
      citations: [
        "https://linear.app/nickwelsh/issue/NW-226/complete-shell-capabilities-and-preferences",
        "https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/components/navigation/SideMenu.tsx#L1078-L1126",
      ],
      captures: [capture],
      identityPairs,
      triggerNavigationSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) > :first-child",
      skylineNavigationSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) > :first-child",
      protectedPairs,
      measurements: { [capture]: {
        identityPairs: {
          brand: { trigger: element({ x: 0, y: 0, width: 223, height: 40 }), skyline: element({ x: 0, y: 0, width: 223, height: 40 }) },
          application: { trigger: element({ x: 0, y: 40, width: 223, height: 103 }, "c"), skyline: element({ x: 0, y: 40, width: 223, height: 67 }, "e") },
        },
        navigation: { trigger: element({ x: 0, y: 153, width: 215, height: 200 }, "c"), skyline: element({ x: 0, y: 117, width: 215, height: 202 }, "e") },
        protectedPairs: protectedMeasurements,
      } },
    };
    const manifest = (value: unknown) => ({ decision: "NW-216", categories: ["branding-identity"], regions: [value] });

    expect(() => validateAllowedDifferences(manifest(region))).not.toThrow();
    expect(() => validateAllowedDifferences(manifest({ ...region, id: "broad-branding" }))).toThrow(/branding-identity/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, decision: "NW-216" }))).toThrow(/branding-identity/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, identityPairs: identityPairs.slice(1) }))).toThrow(/selector/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, protectedPairs: protectedPairs.slice(1) }))).toThrow(/protected|selector/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: {} }))).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { [capture]: { ...region.measurements[capture], navigation: { ...region.measurements[capture].navigation, skyline: { ...region.measurements[capture].navigation.skyline, rect: { x: 0, y: 118, width: 215, height: 202 }, crop: { ...region.measurements[capture].navigation.skyline.crop, rect: { x: 0, y: 118, width: 215, height: 202 } } } } } } }))).toThrow(/reflow/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { [capture]: { ...region.measurements[capture], protectedPairs: { ...protectedMeasurements, runs: { ...protectedMeasurements.runs, skyline: { ...protectedMeasurements.runs.skyline, crop: { ...protectedMeasurements.runs.skyline.crop, screenshotSha256: "f".repeat(64) } } } } } } }))).toThrow(/protected/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { [capture]: { ...region.measurements[capture], protectedPairs: { ...protectedMeasurements, runs: { ...protectedMeasurements.runs, skyline: { ...protectedMeasurements.runs.skyline, accessibilitySha256: "bad" } } } } } }))).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { [capture]: { ...region.measurements[capture], protectedPairs: { ...protectedMeasurements, runs: { ...protectedMeasurements.runs, skyline: { ...protectedMeasurements.runs.skyline, computedStyleSha256: "c".repeat(64) } } } } } }))).toThrow(/protected.*style/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { [capture]: { ...region.measurements[capture], protectedPairs: { ...protectedMeasurements, runs: { ...protectedMeasurements.runs, skyline: { ...protectedMeasurements.runs.skyline, accessibilitySha256: "c".repeat(64) } } } } } }))).toThrow(/protected.*accessibility/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { [capture]: { ...region.measurements[capture], protectedPairs: { ...protectedMeasurements, runs: { ...protectedMeasurements.runs, skyline: { ...protectedMeasurements.runs.skyline, rect: { x: 10, y: 116, width: 205, height: 32 }, crop: { ...protectedMeasurements.runs.skyline.crop, rect: { x: 10, y: 116, width: 205, height: 32 } } } } } } } }))).toThrow(/protected.*reflow/i);
  });

  test("framework extensions require an exact fail-closed ledger entry", () => {
    const region = {
      id: "php-exception-evidence",
      category: "framework-extension",
      decision: "NW-224",
      acceptance: "Detail adds representative application/vendor frames, occurrence activity, and cursor-paginated failed Attempts.",
      captures: ["error-found@1440x960-classic"],
      skylineSelector: "[data-skyline-extension='error-exception-evidence']",
      triggerAnchorSelector: ".error-details-heading",
      skylineAnchorSelector: ".error-details-heading",
      accessibleRole: "region",
      accessibleName: "Exception",
      anchorAccessibleRole: "heading",
      anchorAccessibleName: "Details",
      measurements: {
        "error-found@1440x960-classic": {
          relativeRect: { x: 0, y: 8, width: 300, height: 120 },
          computedStyleSha256: "a".repeat(64),
          anchorRect: { x: 10, y: 10, width: 300, height: 24 },
          anchorComputedStyleSha256: "b".repeat(64),
        },
      },
    };
    const queueRegion = {
      ...region,
      id: "queue-recorded-runs",
      decision: "NW-221",
      acceptance: "Detail adds queue-time/activity series and cursor-paginated filtered Runs.",
      captures: ["queue-found@1440x960-classic"],
      skylineSelector: "[data-skyline-extension='queue-recorded-runs']",
      triggerAnchorSelector: ".queue-heading",
      skylineAnchorSelector: ".queue-heading",
      accessibleName: "Recorded runs",
      anchorAccessibleName: "default",
      measurements: {
        "queue-found@1440x960-classic": { ...region.measurements["error-found@1440x960-classic"], accessibilitySha256: "d".repeat(64) },
      },
    };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region, queueRegion] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region, { ...queueRegion, captures: region.captures, measurements: { "error-found@1440x960-classic": { ...region.measurements["error-found@1440x960-classic"], accessibilitySha256: "d".repeat(64) } } }] })).toThrow(/overlap/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [region, { ...queueRegion, triggerAnchorSelector: region.skylineSelector }] })).toThrow(/selector/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [{ ...region, captures: ["error-found@1440x960-dark"] }] })).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [{ ...region, acceptance: "" }] })).toThrow(/incomplete/i);
    const connection = {
      ...queueRegion,
      id: "queue-connection-filter",
      acceptance: "Connection, search, and time-range filters are URL-backed and use valid server-supplied options.",
      skylineSelector: '[data-skyline-extension="queue-connection-filter"]',
      triggerAnchorSelector: '[data-trigger-anchor="queue-filter-controls"]',
      skylineAnchorSelector: '[data-skyline-anchor="queue-filter-controls"]',
      accessibleRole: "combobox",
      accessibleName: "Connection",
      anchorAccessibleRole: "search",
      anchorAccessibleName: "Queue search",
      measurements: { "queue-found@1440x960-classic": { ...queueRegion.measurements["queue-found@1440x960-classic"], accessibilitySha256: "c".repeat(64) } },
    };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [connection] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [{ ...connection, measurements: { "queue-found@1440x960-classic": region.measurements["error-found@1440x960-classic"] } }] })).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [{ ...queueRegion, measurements: { "queue-found@1440x960-classic": region.measurements["error-found@1440x960-classic"] } }] })).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["framework-extension"], regions: [{ ...connection, acceptance: "Paraphrased." }] })).toThrow(/acceptance/i);
  });

  test("capability omissions require owned disjoint selector pairs and pinned evidence", () => {
    const measurement = {
      allocated: {
        triggerRect: { x: 1, y: 1, width: 20, height: 10 }, skylineRect: { x: 1, y: 1, width: 20, height: 10 },
        triggerComputedStyleSha256: "a".repeat(64), skylineComputedStyleSha256: "b".repeat(64),
        triggerAccessibilitySha256: "c".repeat(64), skylineAccessibilitySha256: "d".repeat(64),
      },
    };
    const region = {
      id: "queue-unavailable-capabilities",
      category: "capability-omission",
      decision: "NW-223",
      acceptance: ["Unavailable broker metrics remain absent."],
      citations: ["https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/_app.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.queues/route.tsx#L211-L268"],
      captures: ["queues-busy@1440x960-classic"],
      selectorPairs: [{ id: "allocated", triggerSelector: "[data-trigger-capability='allocated']", skylineSelector: "[data-skyline-capability='allocated']" }],
      measurements: { "queues-busy@1440x960-classic": measurement },
    };
    const extension = {
      id: "queue-recorded-runs", category: "framework-extension", decision: "NW-223", acceptance: "Captured Runs extension.", captures: region.captures,
      skylineSelector: "[data-skyline-extension='queue-recorded-runs']", triggerAnchorSelector: "[data-trigger-anchor='queue']", skylineAnchorSelector: "[data-skyline-anchor='queue']",
      accessibleRole: "region", accessibleName: "Recorded runs", anchorAccessibleRole: "heading", anchorAccessibleName: "Queue",
      measurements: { [region.captures[0]]: { relativeRect: { x: 0, y: 0, width: 20, height: 10 }, computedStyleSha256: "a".repeat(64), accessibilitySha256: "c".repeat(64), anchorRect: { x: 0, y: 0, width: 20, height: 10 }, anchorComputedStyleSha256: "b".repeat(64) } },
    };

    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [region] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission", "framework-extension"], regions: [region, extension] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...region, citations: [] }] })).toThrow(/citation|incomplete/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...region, selectorPairs: [...region.selectorPairs, { ...region.selectorPairs[0], id: "duplicate" }] }] })).toThrow(/selector/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [region, { ...region, id: "duplicate" }] })).toThrow(/overlap|owner/i);
    const disjoint = { ...region, id: "queue-unavailable-capabilities-filtered", captures: ["queues-filtering@1440x960-classic"], measurements: { "queues-filtering@1440x960-classic": measurement } };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [region, disjoint] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...region, measurements: { [region.captures[0]]: { allocated: { ...measurement.allocated, triggerAccessibilitySha256: "bad" } } } }] })).toThrow(/measurement/i);
    const protectedRegion = {
      ...region,
      selectorPairs: [{ ...region.selectorPairs[0], skylineBoundary: true }],
      protectedSelectors: [{ id: "search", application: "skyline", selector: "[data-skyline-protected='search']" }],
      protectedMeasurements: { [region.captures[0]]: { search: { rect: { x: 1, y: 1, width: 20, height: 10 }, computedStyleSha256: "a".repeat(64), accessibilitySha256: "b".repeat(64), crop: { status: "visible", rect: { x: 1, y: 1, width: 20, height: 10 }, screenshotSha256: "c".repeat(64) } } } },
    };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [protectedRegion] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...protectedRegion, protectedSelectors: [] }] })).toThrow(/protected/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...protectedRegion, protectedMeasurements: { [region.captures[0]]: { search: { ...protectedRegion.protectedMeasurements[region.captures[0]].search, crop: { ...protectedRegion.protectedMeasurements[region.captures[0]].search.crop, screenshotSha256: "bad" } } } } }] })).toThrow(/protected/i);
    const belowViewport = { ...protectedRegion, protectedMeasurements: { [region.captures[0]]: { search: { ...protectedRegion.protectedMeasurements[region.captures[0]].search, rect: { x: 1, y: 961, width: 20, height: 10 }, crop: { status: "below-viewport" } } } } };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [belowViewport] })).toThrow(/protected/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...belowViewport, protectedSelectors: [{ ...belowViewport.protectedSelectors[0], allowBelowViewport: true }] }] })).not.toThrow();
    const mobileCapture = "queues-busy@390x844-classic";
    const mobileRightPolicy = { width: 390, height: 844 };
    const protectedSearch = protectedRegion.protectedMeasurements[region.captures[0]].search;
    const mobileRightViewport = {
      ...protectedRegion,
      captures: [mobileCapture],
      measurements: { [mobileCapture]: measurement },
      protectedSelectors: [{ ...protectedRegion.protectedSelectors[0], allowRightOfViewport: mobileRightPolicy }],
      protectedMeasurements: { [mobileCapture]: { search: { ...protectedSearch, rect: { x: 391, y: 1, width: 20, height: 10 }, crop: { status: "right-of-viewport" } } } },
    };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...mobileRightViewport, protectedSelectors: protectedRegion.protectedSelectors }] })).toThrow(/protected/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [mobileRightViewport] })).not.toThrow();
    for (const [capture, width, height] of [["queues-busy@390x844-dark", 390, 844], ["queues-busy@1024x768-classic", 1024, 768], ["queues-busy@1440x960-classic", 1440, 960]] as const) {
      const desktopRightViewport = {
        ...mobileRightViewport,
        captures: [capture],
        measurements: { [capture]: measurement },
        protectedMeasurements: { [capture]: { search: { ...protectedSearch, rect: { x: width + 1, y: 1, width: 20, height: 10 }, crop: { status: "right-of-viewport" } } } },
      };
      expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [desktopRightViewport] })).toThrow(/protected/i);
    }
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...mobileRightViewport, protectedSelectors: [{ ...mobileRightViewport.protectedSelectors[0], allowRightOfViewport: { width: 1440, height: 960 } }] }] })).toThrow(/selector|protected/i);
    const belowRightViewport = { ...mobileRightViewport, protectedMeasurements: { [mobileCapture]: { search: { ...protectedSearch, rect: { x: 391, y: 845, width: 20, height: 10 }, crop: { status: "right-of-viewport" } } } } };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [belowRightViewport] })).toThrow(/protected/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["capability-omission"], regions: [{ ...belowRightViewport, protectedSelectors: [{ ...belowRightViewport.protectedSelectors[0], allowBelowViewport: true }] }] })).not.toThrow();
  });

  test("presenter extensions require paired evidence locks and pinned citations", () => {
    const region = {
      id: "attempt-exception-evidence",
      category: "presenter-extension",
      decision: "NW-222",
      acceptance: ["Failed-Attempt detail exposes captured exception evidence."],
      citations: ["https://github.com/triggerdotdev/trigger.dev/blob/ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0/apps/webapp/app/routes/resources.orgs.%24organizationSlug.projects.%24projectParam.env.%24envParam.runs.%24runParam.spans.%24spanParam/route.tsx#L1446-L1513"],
      captures: ["runs-exception@1440x960-classic"],
      triggerSelector: ".attempt-error > [translate='no']",
      skylineSelector: "[data-skyline-extension='attempt-exception-evidence']",
      triggerAnchorSelector: ".attempt-error",
      skylineAnchorSelector: ".attempt-error",
      skylineAccessibleRole: "region",
      skylineAccessibleName: "Exception",
      anchorAccessibleRole: "heading",
      anchorAccessibleName: "Illuminate\\Database\\DeadlockException",
      measurements: {
        "runs-exception@1440x960-classic": {
          triggerRelativeRect: { x: 1, y: 1, width: 300, height: 60 }, skylineRelativeRect: { x: 1, y: 1, width: 300, height: 60 },
          triggerComputedStyleSha256: "a".repeat(64), skylineComputedStyleSha256: "b".repeat(64),
          triggerAccessibilitySha256: "c".repeat(64), skylineAccessibilitySha256: "d".repeat(64),
          anchorRect: { x: 1, y: 1, width: 300, height: 100 }, anchorComputedStyleSha256: "e".repeat(64), anchorAccessibilitySha256: "f".repeat(64), anchorAccessibleName: "Illuminate\\Database\\DeadlockException",
        },
      },
    };
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["presenter-extension"], regions: [region] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["presenter-extension"], regions: [{ ...region, skylineAccessibleName: "" }] })).not.toThrow();
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["presenter-extension"], regions: [{ ...region, skylineAccessibleName: null }] })).toThrow(/incomplete/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["presenter-extension"], regions: [{ ...region, citations: [] }] })).toThrow(/citation|incomplete/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["presenter-extension"], regions: [{ ...region, measurements: { "runs-exception@1440x960-classic": { ...region.measurements["runs-exception@1440x960-classic"], skylineAccessibilitySha256: "bad" } } }] })).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences({ decision: "NW-216", categories: ["presenter-extension"], regions: [{ ...region, measurements: { "runs-exception@1440x960-classic": { ...region.measurements["runs-exception@1440x960-classic"], skylineRelativeRect: { x: 1, y: 1, width: 300, height: 61 } } } }] })).toThrow(/measurement/i);
  });

  test("the runner applies allowed pixels and AX omissions instead of raw empty masks", () => {
    const runner = readFileSync(join(root, "tests/fidelity/fidelity.spec.ts"), "utf8");
    expect(runner).toContain("observeDifferenceRegions(reference, page, capture");
    expect(runner).toContain("captureStableBreadcrumbRasterization(reference, page, capture");
    expect(runner).toContain("captureStableBrandingIdentityObservation(reference, page, brandingDefinition, capture");
    expect(runner).toContain('captureAccessibilityTreeOmitting(reference, accessibilityOmissionSelectors(regions, "trigger"))');
    expect(runner).toContain('captureAccessibilityTreeOmitting(page, accessibilityOmissionSelectors(regions, "skyline"))');
    expect(runner).toContain("measurePixels(triggerPng, skylinePng, regions)");
    expect(runner).not.toContain("measurePixels(triggerPng, skylinePng, [])");
  });

  test("measurement discovery is read-only and uses the strict paired observer", () => {
    const discovery = readFileSync(join(root, "tests/fidelity/framework-extension.discovery.ts"), "utf8");
    expect(discovery).toContain("discoverFrameworkExtensionObservation(trigger, skyline, definition, step)");
    expect(discovery).toContain("expect(captures).toHaveLength(31)");
    expect(discovery).toContain('capture.startsWith("error-stale-refresh@")');
    expect(discovery).toContain("transitionToStaleRefresh(skyline, trigger, fixture, scenario)");
    expect(discovery).toContain('test(`discover exact NW-224 ${capture}`');
    expect(discovery.indexOf("for (const capture of captures)")).toBeLessThan(discovery.indexOf('test(`discover exact NW-224 ${capture}`'));
    expect(discovery).toContain("FRAMEWORK_EXTENSION_MEASUREMENT=");
    expect(discovery).not.toContain("const measurements:");
    expect(discovery).not.toContain("writeFile");
  });

  test("regeneration requires an accepted decision reference", () => {
    expect(() => recordFidelityBundle(root, "refresh screenshots")).toThrow(/NW-216/i);
    expect(() => recordFidelityBundle(root, "NW-227")).toThrow(/NW-216/i);
  });

  test("the committed bundle embeds the exact oracle environment", () => {
    const environment = { schemaVersion: 1, fixtureVersion: "nw-227-v1" };
    const matrix: FidelityMatrix = {
      schemaVersion: 1,
      roots: ["jobs"], details: [], rootStates: ["populated"], detailStates: [], ownedStates: {},
      primary: { viewport: [1440, 960], themes: ["classic"] },
      core: { viewports: [], theme: "classic", shellStates: [] },
      system: { viewport: [1440, 960], schemes: [], states: [] },
      actions: ["navigation-history"],
    };
    const actions = { schemaVersion: 1, scripts: [{ id: "navigation-history", start: "jobs-populated", steps: [] }] };
    const capture = "jobs-populated@1440x960-classic";
    const bundle = {
      schemaVersion: 1,
      environment,
      captures: [capture],
      regeneration: { basis: "accepted-difference", decision: "NW-216" },
      artifacts: [
        { path: `tests/fidelity/oracle/artifacts/${capture}/trigger.png`, capture, type: "screenshot", application: "trigger", sha256: "a".repeat(64) },
        { path: `tests/fidelity/oracle/artifacts/${capture}/skyline.png`, capture, type: "screenshot", application: "skyline", sha256: "b".repeat(64) },
        { path: `tests/fidelity/oracle/artifacts/${capture}/comparison.json`, capture, type: "comparison", sha256: "c".repeat(64) },
        { path: `tests/fidelity/oracle/artifacts/${capture}/accessibility.json`, capture, type: "accessibility-tree", sha256: "d".repeat(64) },
        { path: `tests/fidelity/oracle/artifacts/${capture}/interactions.json`, capture, type: "interaction-transcript", sha256: "e".repeat(64) },
        { path: "tests/fidelity/oracle/actions/navigation-history.json", type: "interaction-transcript", action: "navigation-history", sha256: "f".repeat(64) },
      ],
    };

    expect(() => validateFidelityBundleEnvelope(environment, matrix, actions, bundle)).not.toThrow();
    expect(() => validateFidelityBundleEnvelope(environment, matrix, actions, { ...bundle, environment: { ...environment, fixtureVersion: "stale" } })).toThrow(/environment/i);
    expect(() => validateFidelityBundleEnvelope(environment, matrix, actions, { ...bundle, captures: [capture, capture] })).toThrow(/capture/i);
    expect(() => validateFidelityBundleEnvelope(environment, matrix, actions, {
      ...bundle,
      artifacts: [...bundle.artifacts, { path: "README.md", type: "unclassified", sha256: "0".repeat(64) }],
    })).toThrow(/artifact/i);
    expect(() => validateFidelityBundleEnvelope(environment, matrix, actions, { ...bundle, schemaVersion: 2 })).toThrow(/schema/i);
    expect(() => validateFidelityBundleEnvelope(environment, matrix, { ...actions, scripts: [] }, bundle)).toThrow(/action/i);
    expect(() => validateFidelityBundleEnvelope(environment, matrix, actions, { ...bundle, regeneration: { ...bundle.regeneration, decision: "NW-227" } })).toThrow(/decision/i);
  });

  test("proof provenance binds runtime and import verification inputs", () => {
    const inputs = fidelityInputHashes(root);
    expect(inputs.serveFixtureSha256).toBe(fileHash("scripts/serve-fixture.mjs"));
    expect(inputs.uiPreferencesPrepaintSha256).toBe(fileHash("resources/js/skyline/uiPreferencesPrepaint.js"));
    expect(inputs.referenceImportCheckerSha256).toBe(fileHash("scripts/import-fidelity-reference.mjs"));
    expect(inputs.triggerImportCheckerSha256).toBe(fileHash("scripts/import-trigger.mjs"));
    expect(inputs.nw223EvidenceLedgerSha256).toBe(fileHash("tests/fidelity/nw223-evidence-ledger.json"));
  });

  test("recording cannot bypass the pinned Linux environment", () => {
    expect(() => assertPinnedRecordingEnvironment(true, true)).toThrow(/recording.*pinned Linux/i);
    expect(() => assertPinnedRecordingEnvironment(false, true)).not.toThrow();
    expect(() => assertPinnedRecordingEnvironment(true, false)).not.toThrow();
  });

  function fileHash(path: string) {
    return createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
  }
});

function rendererRasterizationRegion() {
  return exactRendererRegion("error-codeblock-corner-rasterization", "d537de800693f4f278938979c73a9d572d0e0c210dc321cf6b85ca68adce756b");
}

function rendererRasterizationClassicRegion() {
  return exactRendererRegion("error-codeblock-classic-rasterization", "296a201d3f9fa59b45207c457db5c6aee82a479fe7754c9a639edebfef279ddb");
}

function rendererRasterizationLightRegion() {
  return exactRendererRegion("error-codeblock-light-rasterization", "b28c45c29a6f4274e11cf394bd09704f0393ebd498ee3c9270f451d7ed0c62d6");
}

function exactRendererRegion(id: string, sha256: string): RendererRasterizationTestRegion {
  const value = allowedDifferences.regions.find((region) => region.id === id);
  if (!value) throw new Error(`Missing renderer rasterization region ${id}.`);
  expect(createHash("sha256").update(JSON.stringify(value)).digest("hex")).toBe(sha256);
  return structuredClone(value) as unknown as RendererRasterizationTestRegion;
}

type RendererRasterizationTestRegion = {
  acceptance: string[];
  alternatives: Array<{ captures: string[]; pixels: unknown[]; triggerCropSha256: string }>;
  captures: string[];
  citations: string[];
  environment: Record<string, unknown>;
  measurements: Record<string, { trigger: Record<string, unknown>; skyline: Record<string, unknown> }>;
  pixels: Array<{ x: number; y: number }>;
  presentation: Record<string, unknown>;
  triggerSelector: string;
};
