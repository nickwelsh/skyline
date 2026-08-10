import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { expectedCaptureIds, type FidelityMatrix } from "../../scripts/fidelity-oracle.mjs";
import allowedDifferences from "./allowed-differences.json" with { type: "json" };
import matrix from "./matrix.json" with { type: "json" };
import { captureAccessibilityTree, captureAccessibilityTreeOmitting } from "./support/accessibility";
import { observeAction } from "./support/actions";
import { additionalAxeViolations, captureAxe } from "./support/axe";
import { applyLiveSystemChange, assertFixedCanvas, prepareCapture, settleCapture } from "./support/capture";
import { captureStableBreadcrumbRasterization } from "./support/breadcrumb-rasterization-browser";
import { assertNoFidelityDifferences, collectFidelityDifferences } from "./support/differences";
import { accessibilityOmissionSelectors, captureStableBrandingIdentityObservation, observeDifferenceRegions, validateBrandingIdentityObservation, type AllowedDifferences, type BrandingIdentityDefinition, waitForDifferenceRegions } from "./support/difference-regions";
import { measurePixels } from "./support/pixels";
import { createReferenceFixture, installReferenceFixture } from "./support/reference";
import { installSkylineFixture, parseScenario, scenarioPath } from "./support/skyline";
import { exposeOwnedState, seedOwnedState } from "./support/states";
import { transitionToStaleRefresh } from "./support/stale-refresh";

const root = resolve(import.meta.dirname, "../..");
const captures = expectedCaptureIds(matrix as unknown as FidelityMatrix);
const record = process.env.SKYLINE_ORACLE_RECORD === "1";
const referenceFixture = createReferenceFixture();

test.describe.configure({ mode: "serial" });

for (const capture of captures) {
  test(capture, async ({ page, context }) => {
    test.setTimeout(60_000);
    const scenario = parseScenario(capture);
    const reference = await context.newPage();
    await Promise.all([prepareCapture(page, capture, "/skyline"), prepareCapture(reference, capture, "/reference")]);
    await Promise.all([seedOwnedState(page, scenario), seedOwnedState(reference, scenario, "/reference")]);
    await installReferenceFixture(reference, await referenceFixture);
    const fixture = await installSkylineFixture(page, scenario);

    await Promise.all([
      page.goto(scenarioPath(scenario, fixture.catalog)),
      reference.goto(`http://127.0.0.1:4185/oracle/${scenario.id}`),
    ]);
    await reference.locator("html[data-oracle-ready='true']").waitFor();
    if (scenario.state === "stale-refresh") {
      await transitionToStaleRefresh(page, reference, fixture, scenario);
    }
    await Promise.all([exposeOwnedState(page, scenario, "skyline"), exposeOwnedState(reference, scenario, "trigger")]);
    await waitForDifferenceRegions(reference, page, capture, allowedDifferences as unknown as AllowedDifferences);
    await Promise.all([applyLiveSystemChange(page, capture), applyLiveSystemChange(reference, capture)]);
    await Promise.all([settleCapture(page), settleCapture(reference)]);
    await Promise.all([assertFixedCanvas(page, capture), assertFixedCanvas(reference, capture)]);
    const manifest = allowedDifferences as unknown as AllowedDifferences;
    const serializeRendererScreenshots = manifest.regions.some((region) => region.category === "renderer-rasterization" && !("rendererKind" in region && region.rendererKind === "breadcrumb") && region.captures.includes(capture));
    const captureScreenshots = async () => {
      const [triggerScreenshot, skylineScreenshot] = serializeRendererScreenshots
        ? [await reference.screenshot({ animations: "disabled", caret: "hide" }), await page.screenshot({ animations: "disabled", caret: "hide" })]
        : await Promise.all([reference.screenshot({ animations: "disabled", caret: "hide" }), page.screenshot({ animations: "disabled", caret: "hide" })]);
      return { triggerScreenshot, skylineScreenshot };
    };
    const brandingDefinition = manifest.regions.find((region): region is BrandingIdentityDefinition => region.category === "branding-identity" && region.captures.includes(capture));
    if (!brandingDefinition) throw new Error(`Branding identity lacks ${capture}.`);
    let identityCapture: Awaited<ReturnType<typeof captureStableBrandingIdentityObservation>> | undefined;
    const breadcrumbCapture = await captureStableBreadcrumbRasterization(reference, page, capture, async () => {
      identityCapture = await captureStableBrandingIdentityObservation(reference, page, brandingDefinition, capture, undefined, captureScreenshots);
      return {
        triggerScreenshot: identityCapture.triggerScreenshot,
        skylineScreenshot: identityCapture.skylineScreenshot,
      };
    });
    if (!identityCapture) throw new Error(`Branding identity ${capture} was not captured.`);
    const identity = validateBrandingIdentityObservation(brandingDefinition, identityCapture.observation, capture);
    const retainedManifest = { regions: manifest.regions.filter((region) => region.id !== brandingDefinition.id) };
    const baseRegions = await observeDifferenceRegions(reference, page, capture, retainedManifest);
    const { triggerScreenshot: triggerPng, skylineScreenshot: skylinePng, region: breadcrumbRegion } = breadcrumbCapture;
    const regions = [...baseRegions, {
      kind: "branding-identity" as const,
      id: brandingDefinition.id,
      identityPairs: identity.identityPairs,
      navigation: identity.navigation,
      protectedPairs: identity.protectedPairs,
      expected: brandingDefinition.measurements[capture],
    }, ...(breadcrumbRegion ? [breadcrumbRegion] : [])];
    const [triggerTree, rawSkylineTree, triggerAxe, skylineAxe, triggerInteraction, skylineInteraction] = await Promise.all([
      captureAccessibilityTree(reference),
      captureAccessibilityTree(page),
      captureAxe(reference),
      captureAxe(page),
      observeAction(reference, "captured"),
      observeAction(page, "captured"),
    ]);
    const [comparedTriggerTree, comparedSkylineTree] = regions.length ? await Promise.all([
      captureAccessibilityTreeOmitting(reference, accessibilityOmissionSelectors(regions, "trigger")),
      captureAccessibilityTreeOmitting(page, accessibilityOmissionSelectors(regions, "skyline")),
    ]) : [triggerTree, rawSkylineTree];
    const comparison = measurePixels(triggerPng, skylinePng, regions);
    assertNoFidelityDifferences(collectFidelityDifferences({
      differingPixels: comparison.differingPixels,
      triggerTree: comparedTriggerTree,
      skylineTree: comparedSkylineTree,
      additionalAxeViolations: additionalAxeViolations(triggerAxe, skylineAxe),
      triggerInteractions: [triggerInteraction],
      skylineInteractions: [skylineInteraction],
    }));

    const directory = resolve(root, "tests/fidelity/oracle/artifacts", capture);
    proof(`${directory}/trigger.png`, triggerPng);
    proof(`${directory}/skyline.png`, skylinePng);
    proof(`${directory}/comparison.json`, json(comparison));
    const accessibilityProof = regions.length
      ? { trigger: triggerTree, skyline: rawSkylineTree, comparedTrigger: comparedTriggerTree, comparedSkyline: comparedSkylineTree, allowedRegions: regions.map(({ id }) => id), axe: { trigger: triggerAxe, skyline: skylineAxe } }
      : { trigger: triggerTree, skyline: rawSkylineTree, axe: { trigger: triggerAxe, skyline: skylineAxe } };
    proof(`${directory}/accessibility.json`, json(accessibilityProof));
    proof(`${directory}/interactions.json`, json({ trigger: triggerInteraction, skyline: skylineInteraction }));
    if (capture.includes("-system-")) {
      const explicit = capture.replace(/-system-(light|dark)$/, "-$1");
      expect(triggerPng.equals(readFileSync(resolve(root, "tests/fidelity/oracle/artifacts", explicit, "trigger.png"))), "System Trigger output must equal its explicit theme.").toBe(true);
      expect(skylinePng.equals(readFileSync(resolve(root, "tests/fidelity/oracle/artifacts", explicit, "skyline.png"))), "System Skyline output must equal its explicit theme.").toBe(true);
    }
    await reference.close();
  });
}

function proof(path: string, value: Buffer | string) {
  const contents = typeof value === "string" ? Buffer.from(value) : value;
  if (record) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
    return;
  }
  expect(contents.equals(readFileSync(path)), `Stale oracle artifact: ${path}`).toBe(true);
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
