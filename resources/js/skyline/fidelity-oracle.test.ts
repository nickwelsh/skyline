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

  test("renderer rasterization requires the exact pinned six-pixel decision", () => {
    const region = rendererRasterizationRegion();
    const manifest = (renderer = region) => ({ decision: "NW-216", categories: ["renderer-rasterization"], regions: [renderer] });

    expect(() => validateAllowedDifferences(manifest())).not.toThrow();
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: ["error-found@1440x960-classic"] }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, triggerSelector: ".text-text-dimmed > [translate='no'], main" }))).toThrow(/selector/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, environment: { ...region.environment, chromiumVersion: "150.0.0.0" } }))).toThrow(/environment/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: region.pixels.slice(0, 5) }))).toThrow(/six|pixel/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: region.pixels.map((pixel, index) => index ? pixel : { ...pixel, x: 5 }) }))).toThrow(/coordinate|duplicate/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { "error-found@1024x768-classic": { ...region.measurements["error-found@1024x768-classic"], skyline: { ...region.measurements["error-found@1024x768-classic"].skyline, domSha256: "f".repeat(64) } } } }))).toThrow(/measurement/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, acceptance: ["Changed"] }))).toThrow(/metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, citations: region.citations.slice(0, 1) }))).toThrow(/metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { "error-found@1024x768-classic": { ...region.measurements["error-found@1024x768-classic"], trigger: { ...region.measurements["error-found@1024x768-classic"].trigger, cropSha256: "f".repeat(64) } } } }))).toThrow(/measurement/i);
  });

  test("renderer rasterization requires the exact approved Classic5 twelve-pixel decision", () => {
    const region = rendererRasterizationClassicRegion();
    const manifest = (renderer = region) => ({ decision: "NW-216", categories: ["renderer-rasterization"], regions: [renderer] });

    expect(() => validateAllowedDifferences(manifest())).not.toThrow();
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: region.captures.slice(1) }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: [...region.captures, "errors-linked-runs@1440x960-classic"] }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: [...region.captures].reverse() }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: region.pixels.slice(1) }))).toThrow(/pixel/i);
    expect(region.alternatives).toHaveLength(1);
    expect(region.alternatives[0].captures).toEqual(region.captures);
    expect(() => validateAllowedDifferences(manifest({ ...region, alternatives: [{ ...region.alternatives[0], captures: region.captures.slice(1) }] }))).toThrow(/alternative|metadata/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, pixels: [...region.pixels].reverse() }))).toThrow(/pixel/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, measurements: { ...region.measurements, [region.captures[0]]: { ...region.measurements[region.captures[0]], trigger: { ...region.measurements[region.captures[0]].trigger, cropSha256: "f".repeat(64) } } } }))).toThrow(/measurement/i);
  });

  test("renderer rasterization requires the exact approved Light3 full or right-edge decision", () => {
    const region = rendererRasterizationLightRegion();
    const manifest = (renderer = region) => ({ decision: "NW-216", categories: ["renderer-rasterization"], regions: [renderer] });

    expect(() => validateAllowedDifferences(manifest())).not.toThrow();
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: region.captures.slice(1) }))).toThrow(/capture/i);
    expect(() => validateAllowedDifferences(manifest({ ...region, captures: [...region.captures, "errors-stack-expansion@1440x960-light"] }))).toThrow(/capture/i);
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
  const capture = "error-found@1024x768-classic";
  const rect = { x: 656, y: 117, width: 356, height: 58 };
  const shared = {
    selector: ".text-text-dimmed > [translate='no']",
    rect,
    computedStyleSha256: "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b",
    accessibilitySha256: "b6167fd697fd410afc0259efd4e09027849b730af8f4af8af77591758aac8d6b",
    semanticDomSha256: "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2",
    effectiveCssRulesSha256: "eeedce158bc50c514818266694318ab8eae3d60904294b427103c5bbff3eb901",
    boxModelSha256: "206a05c0a410e6f813bf12948198abbb381269566b3f0e98b3d822e5cc599f83",
    quadsSha256: "260e3e345b11618f2b4d6214d5941be3b01ae92dd3596e1efe87db8d707fafd7",
    backdropSha256: "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9",
  };
  return {
    id: "error-codeblock-corner-rasterization",
    category: "renderer-rasterization",
    decision: "NW-216",
    acceptance: ["Only the six exact pinned Chromium antialias samples may differ; every other pixel and semantic must remain exact."],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-af981c01",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-5f779354",
    ],
    captures: [capture],
    triggerSelector: ".text-text-dimmed > [translate='no']",
    skylineSelector: ".text-text-dimmed > [translate='no']",
    environment: {
      chromiumRevision: "1208",
      chromiumVersion: "145.0.7632.6",
      architecture: "x64",
      deviceScaleFactor: 1,
      locale: "en-US",
      timezone: "UTC",
    },
    presentation: {
      borderColor: "rgb(39, 42, 46)",
      backgroundColor: "rgba(0, 0, 0, 0)",
      backdropColor: "rgb(26, 27, 31)",
      borderRadius: "6px",
    },
    pixels: [
      { x: 3, y: 0, trigger: [29, 30, 35, 255], skyline: [29, 31, 35, 255] },
      { x: 5, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
      { x: 3, y: 1, trigger: [33, 34, 38, 255], skyline: [33, 35, 39, 255] },
      { x: 4, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
      { x: 5, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
      { x: 2, y: 2, trigger: [31, 33, 37, 255], skyline: [31, 34, 38, 255] },
    ],
    measurements: {
      [capture]: {
        runtime: { browserVersion: "145.0.7632.6", platform: "Linux x86_64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" },
        trigger: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "8d795f3af25b11056ed60507ccd2c8614e8cc4d469515688018b5b0f9dab47ba", cropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50" },
        skyline: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "751946618b4985c6a59b86417e539771259f74e794c7e5ad67377c495f9202a4", cropSha256: "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a" },
      },
    },
  };
}

function rendererRasterizationClassicRegion() {
  const base = rendererRasterizationRegion();
  const captures = [
    "error-found@1440x960-classic",
    "errors-affected-job-types@1440x960-classic",
    "errors-application-vendor-frames@1440x960-classic",
    "errors-long-exception@1440x960-classic",
    "errors-stack-expansion@1440x960-classic",
  ];
  const rect = { x: 1072, y: 117, width: 356, height: 58 };
  const shared = {
    selector: base.triggerSelector,
    rect,
    computedStyleSha256: "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b",
    accessibilitySha256: "b6167fd697fd410afc0259efd4e09027849b730af8f4af8af77591758aac8d6b",
    semanticDomSha256: "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2",
    effectiveCssRulesSha256: "eeedce158bc50c514818266694318ab8eae3d60904294b427103c5bbff3eb901",
    boxModelSha256: "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486",
    quadsSha256: "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f",
    backdropSha256: "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9",
  };
  const measurement = {
    runtime: { browserVersion: "145.0.7632.6", platform: "Linux x86_64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" },
    trigger: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "8d795f3af25b11056ed60507ccd2c8614e8cc4d469515688018b5b0f9dab47ba", cropSha256: "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6" },
    skyline: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "751946618b4985c6a59b86417e539771259f74e794c7e5ad67377c495f9202a4", cropSha256: "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a" },
  };
  const pixels = [
    { x: 3, y: 0, trigger: [29, 30, 35, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 350, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 352, y: 0, trigger: [29, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 3, y: 1, trigger: [33, 34, 38, 255], skyline: [33, 35, 39, 255] },
    { x: 4, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 350, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 351, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 353, y: 1, trigger: [33, 34, 39, 255], skyline: [33, 35, 39, 255] },
    { x: 2, y: 2, trigger: [31, 33, 37, 255], skyline: [31, 34, 38, 255] },
    { x: 353, y: 2, trigger: [32, 33, 38, 255], skyline: [32, 34, 38, 255] },
  ];
  return {
    ...base,
    id: "error-codeblock-classic-rasterization",
    acceptance: ["Only the exact pinned Chromium Classic full twelve-pixel or left-edge six-pixel antialias state may differ across the five approved captures; zero activates no exception and every other pixel and semantic must remain exact."],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6938d6dc",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-9cebc0a5",
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-4d0553c1",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-299d4a96",
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
    ],
    captures,
    pixels,
    measurements: Object.fromEntries(captures.map((capture) => [capture, structuredClone(measurement)])),
    alternatives: [{
      captures,
      pixels: [pixels[0], pixels[1], pixels[4], pixels[5], pixels[6], pixels[10]],
      triggerCropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50",
    }],
  };
}

function rendererRasterizationLightRegion() {
  const base = rendererRasterizationClassicRegion();
  const captures = [
    "error-found@1440x960-light",
    "error-found@1440x960-system-light",
    "errors-affected-job-types@1440x960-light",
  ];
  const shared = {
    ...base.measurements[base.captures[0]].trigger,
    computedStyleSha256: "6a8b83d2e8057045b6e96b0dac9fb7e569da5335379ed5a76f0f0ab01c569939",
    semanticDomSha256: "ddeafe10e6831ec6dc1e62eab62f16fe3dfe68937cddcbb42c2fa96562d13096",
    backdropSha256: "ca33753c04b4519449c72aa01b71b3f6b8b2050a5c57ead95a3f5920d45460de",
  };
  const measurement = {
    runtime: base.measurements[base.captures[0]].runtime,
    trigger: { ...shared, cropSha256: "93768ec0233ea8b02028b19b7743d1d263219666ef23354eb3407f4c68759fa3" },
    skyline: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "751946618b4985c6a59b86417e539771259f74e794c7e5ad67377c495f9202a4", cropSha256: "a73802a7d3ac38e35d1bcd5119025c1818cae3d5dc9fdeafa69253aaa43332a8" },
  };
  const pixels = [
    { x: 3, y: 0, trigger: [227, 227, 229, 255], skyline: [226, 227, 228, 255] },
    { x: 4, y: 0, trigger: [197, 198, 201, 255], skyline: [196, 198, 201, 255] },
    { x: 352, y: 0, trigger: [228, 229, 230, 255], skyline: [227, 228, 229, 255] },
    { x: 2, y: 1, trigger: [208, 209, 211, 255], skyline: [207, 208, 211, 255] },
    { x: 3, y: 1, trigger: [207, 208, 211, 255], skyline: [207, 208, 210, 255] },
    { x: 4, y: 1, trigger: [233, 234, 235, 255], skyline: [233, 233, 234, 255] },
    { x: 5, y: 1, trigger: [248, 248, 248, 255], skyline: [247, 247, 248, 255] },
    { x: 350, y: 1, trigger: [248, 248, 248, 255], skyline: [247, 247, 248, 255] },
    { x: 351, y: 1, trigger: [233, 233, 234, 255], skyline: [232, 233, 234, 255] },
    { x: 352, y: 1, trigger: [206, 207, 210, 255], skyline: [206, 207, 209, 255] },
    { x: 353, y: 1, trigger: [209, 210, 213, 255], skyline: [209, 210, 212, 255] },
    { x: 2, y: 2, trigger: [214, 215, 217, 255], skyline: [214, 214, 217, 255] },
    { x: 353, y: 2, trigger: [213, 214, 216, 255], skyline: [212, 214, 216, 255] },
  ];
  return {
    ...base,
    id: "error-codeblock-light-rasterization",
    acceptance: ["Only the exact pinned Chromium Light full thirteen-pixel, right-edge six-pixel, or left-edge seven-pixel antialias state may differ across the three approved captures; zero activates no exception and every other pixel and semantic must remain exact."],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6938d6dc",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-9cebc0a5",
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6b20c68e",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-86de4313",
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-27e039b2",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-721d1ae5",
    ],
    captures,
    presentation: { borderColor: "color(srgb 0.687749 0.693835 0.709051)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(255, 255, 255)", borderRadius: "6px" },
    pixels,
    measurements: Object.fromEntries(captures.map((capture) => [capture, structuredClone(measurement)])),
    alternatives: [{
      captures,
      pixels: [pixels[2], pixels[7], pixels[8], pixels[9], pixels[10], pixels[12]],
      triggerCropSha256: "be64f3b53c93b4cc7145fb081f717e2b75becf66632a727985b68a57f3537864",
    }, {
      captures,
      pixels: [pixels[0], pixels[1], pixels[3], pixels[4], pixels[5], pixels[6], pixels[11]],
      triggerCropSha256: "f5bba6c913b6a01d71f7926ac77447c974b40961a3ac51fb9f27bc979d95f1b5",
    }],
  };
}
