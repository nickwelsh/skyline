import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { expectedCaptureIds, fidelityInputHashes, type FidelityMatrix, recordFidelityBundle, validateAllowedDifferences, validateFidelityBundleEnvelope } from "../../../scripts/fidelity-oracle.mjs";

const root = resolve(import.meta.dirname, "../../..");
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

  test("allowed differences require a narrow accepted category and selectors", () => {
    expect(() => validateAllowedDifferences({
      decision: "NW-216",
      categories: ["visual-tolerance"],
      regions: [],
    })).toThrow(/unclassified/i);
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
    expect(runner).toContain('captureAccessibilityTreeOmitting(reference, accessibilityOmissionSelectors(regions, "trigger"))');
    expect(runner).toContain('captureAccessibilityTreeOmitting(page, accessibilityOmissionSelectors(regions, "skyline"))');
    expect(runner).toContain("measurePixels(triggerPng, skylinePng, regions)");
    expect(runner).not.toContain("measurePixels(triggerPng, skylinePng, [])");
  });

  test("measurement discovery is read-only and uses the strict paired observer", () => {
    const discovery = readFileSync(join(root, "tests/fidelity/framework-extension.discovery.ts"), "utf8");
    expect(discovery).toContain("discoverFrameworkExtensionObservation(trigger, skyline, definition, step)");
    expect(discovery).toContain("expect(captures).toHaveLength(28)");
    expect(discovery).toContain('test(`discover exact NW-224 ${capture}`');
    expect(discovery.indexOf("for (const capture of captures)")).toBeLessThan(discovery.indexOf('test(`discover exact NW-224 ${capture}`'));
    expect(discovery).toContain("FRAMEWORK_EXTENSION_MEASUREMENT=");
    expect(discovery).not.toContain("const measurements:");
    expect(discovery).not.toContain("writeFile");
  });

  test("regeneration requires an accepted decision reference", () => {
    expect(() => recordFidelityBundle(root, "refresh screenshots")).toThrow(/requires --decision NW-/i);
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
  });

  test("proof provenance binds the Skyline fixture server", () => {
    const source = readFileSync(join(root, "scripts/serve-fixture.mjs"));
    expect(fidelityInputHashes(root).serveFixtureSha256).toBe(createHash("sha256").update(source).digest("hex"));
  });
});
