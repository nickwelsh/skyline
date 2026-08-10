import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const oracleDecision = "NW-216";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { throw new Error(message); };
const validProtectedSelectorViewportPolicy = ({ allowBelowViewport, allowRightOfViewport } = {}) =>
  (allowBelowViewport === undefined || allowBelowViewport === true)
  && (allowRightOfViewport === undefined
    || (allowRightOfViewport && allowRightOfViewport.width === 390 && allowRightOfViewport.height === 844 && Object.keys(allowRightOfViewport).length === 2));

export function verifyFidelityBundle(root = scriptRoot) {
  const fidelity = join(root, "tests/fidelity");
  const environment = readJson(join(fidelity, "environment.json"));
  const fixturesPath = join(fidelity, "fixtures.json");
  const fixtures = readJson(fixturesPath);
  const differences = readJson(join(fidelity, "allowed-differences.json"));
  const matrix = readJson(join(fidelity, "matrix.json"));
  const actions = readJson(join(fidelity, "actions.json"));
  const bundle = readJson(join(fidelity, "oracle/bundle.json"));

  enforceEnvironment(root, environment, fixtures, fixturesPath);
  validateFidelityBundleEnvelope(environment, matrix, actions, bundle);
  execFileSync(process.execPath, [join(root, "scripts/import-fidelity-reference.mjs"), "--check"], { stdio: "pipe" });
  const actualInputs = fidelityInputHashes(root);
  if (JSON.stringify(bundle.inputs) !== JSON.stringify(actualInputs)) fail("Oracle input hashes drifted.");
  validateAllowedDifferences(differences);
  enforceArtifacts(root, bundle);

  return {
    fixtureVersion: environment.fixtureVersion,
    triggerCommit: environment.triggerCommit,
    chromiumRevision: environment.chromiumRevision,
    artifacts: bundle.artifacts.length,
  };
}

export function validateFidelityBundleEnvelope(environment, matrix, actions, bundle) {
  for (const [name, document] of Object.entries({ environment, matrix, actions, bundle })) {
    if (document?.schemaVersion !== 1) fail(`Oracle ${name} schema drifted.`);
  }
  if (!isDeepStrictEqual(bundle.environment, environment)) fail("Oracle bundle environment drifted.");
  enforceOracleDecision(bundle.regeneration?.decision);
  const captures = expectedCaptureIds(matrix);
  if (!isDeepStrictEqual(bundle.captures, captures)) fail("Oracle capture set drifted.");
  if (!isDeepStrictEqual(actions.scripts?.map(({ id }) => id), matrix.actions)) fail("Oracle action-script coverage drifted.");
  const expectedArtifacts = [...captures.flatMap(expectedArtifactDescriptors), ...(matrix.actions ?? []).map(expectedActionDescriptor)];
  const actualArtifacts = Array.isArray(bundle.artifacts)
    ? bundle.artifacts.map(({ sha256: _sha256, ...artifact }) => artifact)
    : undefined;
  if (!isDeepStrictEqual(actualArtifacts, expectedArtifacts)) fail("Oracle artifact set drifted.");
}

export function recordFidelityBundle(root = scriptRoot, decision) {
  enforceOracleDecision(decision);
  const fidelity = join(root, "tests/fidelity");
  const bundlePath = join(fidelity, "oracle/bundle.json");
  const environment = readJson(join(fidelity, "environment.json"));
  const matrix = readJson(join(fidelity, "matrix.json"));
  const captures = expectedCaptureIds(matrix);
  const artifacts = [...captures.flatMap((capture) => expectedArtifactDescriptors(capture)), ...matrix.actions.map(expectedActionDescriptor)].map((artifact) => {
    const path = join(root, artifact.path);
    if (!existsSync(path)) fail(`Missing oracle artifact while recording: ${artifact.path}`);
    return { ...artifact, sha256: digest(readFileSync(path)) };
  });
  const inputs = fidelityInputHashes(root);
  let basis = "upstream-pin";
  if (existsSync(bundlePath)) {
    const previous = readJson(bundlePath);
    const upstreamChanged = previous.environment?.triggerCommit !== environment.triggerCommit || previous.inputs?.environmentSha256 !== inputs.environmentSha256;
    const differencesChanged = previous.inputs?.differencesSha256 !== inputs.differencesSha256;
    if (!upstreamChanged && !differencesChanged) fail("Oracle regeneration requires a changed upstream/environment pin or accepted-difference decision.");
    basis = upstreamChanged ? "upstream-pin" : "accepted-difference";
  }
  const bundle = {
    schemaVersion: 1,
    environment,
    inputs,
    captures,
    artifacts,
    regeneration: { basis, decision },
  };
  writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  return bundle;
}

function enforceEnvironment(root, environment, fixtures, fixturesPath) {
  const expected = {
    triggerCommit: "ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0",
    playwrightVersion: "1.58.2",
    chromiumRevision: "1208",
    chromiumVersion: "145.0.7632.6",
    linuxImage: "mcr.microsoft.com/playwright:v1.58.2-noble@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d",
    nodeImage: "node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d",
    nodeVersion: "24.18.0",
    pnpmVersion: "10.33.2",
    architecture: "x64",
    fixtureVersion: "nw-227-v1",
    locale: "en-US",
    timezone: "UTC",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    frozenClock: "2026-08-05T12:00:00.000Z",
  };
  for (const [key, value] of Object.entries(expected)) {
    if (environment[key] !== value) fail(`Oracle environment ${key} drifted.`);
  }
  if (fixtures.version !== environment.fixtureVersion) fail("Oracle fixture version mismatched.");

  const packageJson = readJson(join(root, "package.json"));
  if (packageJson.devDependencies?.["@playwright/test"] !== environment.playwrightVersion) fail("Playwright package pin mismatched.");
  if (packageJson.engines?.node !== environment.nodeVersion || packageJson.engines?.pnpm !== environment.pnpmVersion) fail("Contributor toolchain pin mismatched.");

  const importManifest = readJson(join(root, "resources/js/trigger/import-manifest.json"));
  if (importManifest.commit !== environment.triggerCommit) fail("Trigger import and oracle commits mismatched.");
  if (digest(readFileSync(fixturesPath)) !== bundleFixtureHash(root)) fail("Oracle fixture hash mismatched.");

  const expectedFonts = {
    "GeistVariableVF.woff2": "60e11d985314d4843c7a741d67bc7744c4bf519e50ce08e1d5e74e43414aaff0",
    "GeistMonoVariableVF.woff2": "35b975ebbcd7e79f2cc7b2008fabe8343372a86610c959c1f58b510e2a281aed",
  };
  if (JSON.stringify(environment.fonts) !== JSON.stringify(expectedFonts)) fail("Oracle font checksums drifted.");
}

function bundleFixtureHash(root) {
  const bundle = readJson(join(root, "tests/fidelity/oracle/bundle.json"));
  return bundle.inputs.fixturesSha256;
}

export function validateAllowedDifferences(differences) {
  const accepted = new Set(["branding-terminology", "branding-identity", "equivalent-fixture-data", "capability-omission", "react-router-url", "invisible-integration", "framework-extension", "presenter-extension", "renderer-rasterization"]);
  if (differences.decision !== "NW-216") fail("Allowed-difference manifest lacks its accepted decision.");
  for (const category of differences.categories ?? []) if (!accepted.has(category)) fail(`Unclassified allowed-difference category: ${category}`);
  const breadcrumbRegions = (differences.regions ?? []).filter((region) => region.category === "renderer-rasterization" && region.rendererKind === "breadcrumb");
  if (breadcrumbRegions.length !== 1) fail("Breadcrumb renderer manifest requires exactly one approved region.");
  const lockedRegions = [];
  for (const region of differences.regions ?? []) {
    if (!accepted.has(region.category)) fail(`Unclassified allowed-difference region: ${region.id}`);
    if (region.category === "renderer-rasterization") {
      if (region.rendererKind === "breadcrumb") validateBreadcrumbRasterizationRegion(region);
      else {
        validateRendererRasterizationRegion(region);
        lockedRegions.push(region);
      }
    } else if (region.category === "framework-extension") {
      const complete = region.skylineSelector && region.triggerAnchorSelector && region.skylineAnchorSelector
        && region.accessibleRole && region.accessibleName && region.anchorAccessibleRole && region.anchorAccessibleName
        && region.decision && region.acceptance && Array.isArray(region.captures) && region.captures.length > 0
        && region.measurements && typeof region.measurements === "object";
      if (!complete) fail(`Incomplete framework-extension region: ${region.id}`);
      if (!region.captures.every((capture) => typeof capture === "string" && capture.includes("@"))) fail(`Invalid framework-extension capture: ${region.id}`);
      if (new Set(region.captures).size !== region.captures.length) fail(`Duplicate framework-extension capture: ${region.id}`);
      const measurements = Object.keys(region.measurements);
      if (measurements.length !== region.captures.length || region.captures.some((capture) => !region.measurements[capture])) fail(`Missing framework-extension measurement: ${region.id}`);
      for (const measurement of Object.values(region.measurements)) {
        const valid = /^[a-f0-9]{64}$/.test(measurement.computedStyleSha256 ?? "")
          && /^[a-f0-9]{64}$/.test(measurement.anchorComputedStyleSha256 ?? "")
          && (!["queue-connection-filter", "queue-recorded-runs"].includes(region.id) || /^[a-f0-9]{64}$/.test(measurement.accessibilitySha256 ?? ""))
          && [measurement.relativeRect, measurement.anchorRect].every((rect) => ["x", "y", "width", "height"].every((key) => Number.isFinite(rect?.[key])));
        if (!valid) fail(`Invalid framework-extension measurement: ${region.id}`);
      }
      if (region.id === "queue-connection-filter" && region.acceptance !== "Connection, search, and time-range filters are URL-backed and use valid server-supplied options.") fail(`Invalid framework-extension acceptance: ${region.id}`);
      lockedRegions.push(region);
    } else if (region.category === "presenter-extension") {
      const complete = region.triggerSelector && region.skylineSelector && region.triggerAnchorSelector && region.skylineAnchorSelector
        && region.skylineAccessibleRole && typeof region.skylineAccessibleName === "string" && region.anchorAccessibleRole && typeof region.anchorAccessibleName === "string"
        && region.decision && Array.isArray(region.acceptance) && region.acceptance.length > 0
        && Array.isArray(region.citations) && region.citations.length > 0
        && Array.isArray(region.captures) && region.captures.length > 0
        && region.measurements && typeof region.measurements === "object";
      if (!complete) fail(`Incomplete presenter-extension region: ${region.id}`);
      if (!region.citations.every((citation) => /^https:\/\/github\.com\/triggerdotdev\/trigger\.dev\/blob\/[a-f0-9]{40}\/apps\/webapp\/.+#L\d+-L\d+$/.test(citation))) fail(`Invalid presenter-extension citation: ${region.id}`);
      if (!region.captures.every((capture) => typeof capture === "string" && capture.includes("@"))) fail(`Invalid presenter-extension capture: ${region.id}`);
      if (new Set(region.captures).size !== region.captures.length) fail(`Duplicate presenter-extension capture: ${region.id}`);
      const measurements = Object.keys(region.measurements);
      if (measurements.length !== region.captures.length || region.captures.some((capture) => !region.measurements[capture])) fail(`Missing presenter-extension measurement: ${region.id}`);
      for (const measurement of Object.values(region.measurements)) {
        const hashes = ["triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256", "anchorComputedStyleSha256", "anchorAccessibilitySha256"];
        const valid = hashes.every((key) => /^[a-f0-9]{64}$/.test(measurement[key] ?? ""))
          && typeof measurement.anchorAccessibleName === "string" && measurement.anchorAccessibleName.length > 0
          && [measurement.triggerRelativeRect, measurement.skylineRelativeRect, measurement.anchorRect].every((rect) => ["x", "y", "width", "height"].every((key) => Number.isFinite(rect?.[key])))
          && JSON.stringify(measurement.triggerRelativeRect) === JSON.stringify(measurement.skylineRelativeRect);
        if (!valid) fail(`Invalid presenter-extension measurement: ${region.id}`);
      }
      lockedRegions.push(region);
    } else if (region.category === "branding-identity") {
      validateBrandingIdentityRegion(region);
      lockedRegions.push(region);
    } else if (region.category === "capability-omission") {
      const complete = region.id && region.decision && Array.isArray(region.acceptance) && region.acceptance.length > 0 && region.acceptance.every((criterion) => typeof criterion === "string" && criterion.trim())
        && Array.isArray(region.citations) && region.citations.length > 0
        && Array.isArray(region.captures) && region.captures.length > 0
        && Array.isArray(region.selectorPairs) && region.selectorPairs.length > 0
        && region.measurements && typeof region.measurements === "object";
      if (!complete) fail(`Incomplete capability-omission region: ${region.id}`);
      if (!region.citations.every((citation) => /^https:\/\/github\.com\/triggerdotdev\/trigger\.dev\/blob\/[a-f0-9]{40}\/apps\/webapp\/.+#L\d+-L\d+$/.test(citation))) fail(`Invalid capability-omission citation: ${region.id}`);
      if (!region.captures.every((capture) => typeof capture === "string" && capture.includes("@"))) fail(`Invalid capability-omission capture: ${region.id}`);
      if (new Set(region.captures).size !== region.captures.length) fail(`Duplicate capability-omission capture: ${region.id}`);
      const pairIds = region.selectorPairs.map((pair) => pair.id);
      const pairSelectors = region.selectorPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]);
      const protectedSelectors = region.protectedSelectors ?? [];
      const protectedIds = protectedSelectors.map((entry) => entry.id);
      const ownedSelectors = [...pairSelectors, ...protectedSelectors.map((entry) => entry.selector)];
      if (new Set(pairIds).size !== pairIds.length || new Set(protectedIds).size !== protectedIds.length || new Set(ownedSelectors).size !== ownedSelectors.length || region.selectorPairs.some((pair) => !pair.id || !pair.triggerSelector || !pair.skylineSelector || (pair.skylineBoundary !== undefined && pair.skylineBoundary !== true)) || protectedSelectors.some((entry) => !entry.id || !entry.selector || !["trigger", "skyline"].includes(entry.application) || !validProtectedSelectorViewportPolicy(entry))) fail(`Invalid capability-omission selector pair: ${region.id}`);
      if (region.selectorPairs.some((pair) => pair.skylineBoundary) && protectedSelectors.length === 0) fail(`Missing protected capability-omission selectors: ${region.id}`);
      const measurements = Object.keys(region.measurements);
      if (measurements.length !== region.captures.length || region.captures.some((capture) => !region.measurements[capture])) fail(`Missing capability-omission measurement: ${region.id}`);
      for (const measurement of Object.values(region.measurements)) {
        if (Object.keys(measurement).length !== pairIds.length || pairIds.some((id) => !measurement[id])) fail(`Missing capability-omission pair measurement: ${region.id}`);
        for (const pair of Object.values(measurement)) {
          const hashes = ["triggerComputedStyleSha256", "skylineComputedStyleSha256", "triggerAccessibilitySha256", "skylineAccessibilitySha256"];
          const valid = hashes.every((key) => /^[a-f0-9]{64}$/.test(pair[key] ?? ""))
            && [pair.triggerRect, pair.skylineRect].every((rect) => ["x", "y", "width", "height"].every((key) => Number.isFinite(rect?.[key])));
          if (!valid) fail(`Invalid capability-omission measurement: ${region.id}`);
        }
      }
      if (protectedSelectors.length > 0) {
        if (!region.protectedMeasurements || Object.keys(region.protectedMeasurements).length !== region.captures.length || region.captures.some((capture) => !region.protectedMeasurements[capture])) fail(`Missing protected capability-omission measurement: ${region.id}`);
        for (const [capture, measurement] of Object.entries(region.protectedMeasurements)) {
          const viewport = capture.match(/@(\d+)x(\d+)-/);
          if (!viewport) fail(`Invalid protected capability-omission capture: ${region.id}`);
          const width = Number(viewport[1]);
          const height = Number(viewport[2]);
          if (Object.keys(measurement).length !== protectedIds.length || protectedIds.some((id) => !measurement[id])) fail(`Missing protected capability-omission selector measurement: ${region.id}`);
          for (const [id, protectedMeasurement] of Object.entries(measurement)) {
            const definition = protectedSelectors.find((entry) => entry.id === id);
            const rect = protectedMeasurement.rect;
            const validRect = ["x", "y", "width", "height"].every((key) => Number.isFinite(rect?.[key])) && rect.width > 0 && rect.height > 0;
            const crop = protectedMeasurement.crop;
            const verticallyVisible = rect?.y < height && rect?.y + rect?.height > 0;
            const horizontallyVisible = rect?.x < width && rect?.x + rect?.width > 0;
            const rightPolicyMatchesCapture = capture.endsWith("@390x844-classic")
              && definition?.allowRightOfViewport?.width === width
              && definition?.allowRightOfViewport?.height === height;
            const validCrop = crop?.status === "visible"
              ? verticallyVisible && horizontallyVisible && ["x", "y", "width", "height"].every((key) => Number.isFinite(crop.rect?.[key])) && crop.rect.width > 0 && crop.rect.height > 0 && /^[a-f0-9]{64}$/.test(crop.screenshotSha256 ?? "")
              : crop?.status === "below-viewport"
                ? rect?.y >= height && horizontallyVisible && definition?.allowBelowViewport === true && Object.keys(crop).length === 1
                : crop?.status === "right-of-viewport" && rect?.x >= width && (verticallyVisible || (rect?.y >= height && definition?.allowBelowViewport === true)) && rightPolicyMatchesCapture && Object.keys(crop).length === 1;
            const valid = ["computedStyleSha256", "accessibilitySha256"].every((key) => /^[a-f0-9]{64}$/.test(protectedMeasurement[key] ?? "")) && validRect && validCrop;
            if (!valid) fail(`Invalid protected capability-omission measurement: ${region.id}`);
          }
        }
      }
      lockedRegions.push(region);
    } else if (!region.triggerSelector || !region.skylineSelector || !region.accessibleName || !region.decision) fail(`Incomplete allowed-difference region: ${region.id}`);
  }
  const captureOwners = new Map();
  const selectorOwners = new Map();
  for (const region of lockedRegions) {
    for (const capture of region.captures) {
      const ownership = region.category === "capability-omission" ? "capability-omission"
        : region.category === "branding-identity" ? "branding-identity"
        : region.category === "renderer-rasterization" ? "renderer-rasterization" : "extension";
      const key = `${ownership}:${capture}`;
      const owner = captureOwners.get(key);
      if (owner) fail(`Locked regions ${owner} and ${region.id} overlap capture ${capture}.`);
      captureOwners.set(key, region.id);
    }
    const selectors = region.category === "branding-identity"
      ? [...region.identityPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]), region.triggerNavigationSelector, region.skylineNavigationSelector, ...region.protectedPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector])]
      : region.category === "renderer-rasterization"
      ? [region.triggerSelector, region.skylineSelector]
      : region.category === "presenter-extension"
      ? [region.triggerSelector, region.skylineSelector, region.triggerAnchorSelector, region.skylineAnchorSelector]
      : region.category === "framework-extension"
        ? [region.skylineSelector, region.triggerAnchorSelector, region.skylineAnchorSelector]
        : [...region.selectorPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]), ...(region.protectedSelectors ?? []).map((entry) => entry.selector)];
    for (const selector of new Set(selectors)) {
      const owners = selectorOwners.get(selector) ?? [];
      for (const owner of owners) {
        const disjointLockedCaptures = owner.category === region.category
          && ["capability-omission", "renderer-rasterization"].includes(region.category)
          && !owner.captures.some((capture) => region.captures.includes(capture));
        if (!disjointLockedCaptures) fail(`Locked regions ${owner.id} and ${region.id} collide on selector ${selector}.`);
      }
      owners.push(region);
      selectorOwners.set(selector, owners);
    }
  }
}

function validateBreadcrumbRasterizationRegion(region) {
  const expected = {
    id: "run-breadcrumb-rasterization",
    category: "renderer-rasterization",
    rendererKind: "breadcrumb",
    decision: "NW-216",
    acceptance: [
      "Lock the exact 196 visible breadcrumb captures to their audited finite state and strict DOM, source SVG, CSS, accessibility, geometry, stroke, backdrop, runtime, and crop evidence.",
      "Require the breadcrumb to remain absent on both sides for the other 243 canonical captures; reject unknown captures, states, crossed evidence, and one-sided presence.",
      "Apply no wildcard, coordinate mask, pixel tolerance, or lossy group compression.",
    ],
    citations: [
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-900b4652",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-25c4c4f4",
      "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e414fc8c",
      "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-cc5fa12d",
    ],
    policyFile: "tests/fidelity/breadcrumb-rasterization-policy.json",
    policySha256: "787e2637697c12767ae7afb79d8e03af07a75436a49240c4206ad5eac55c63d1",
    captures: [],
    measurements: {},
  };
  if (!isDeepStrictEqual(region, expected)) fail("Invalid breadcrumb renderer manifest metadata.");
  const policy = readJson(join(scriptRoot, region.policyFile));
  if (digest(JSON.stringify(policy)) !== region.policySha256) fail("Invalid breadcrumb renderer policy hash.");
  const captures = Object.keys(policy.captures ?? {});
  const absent = policy.absentCaptures ?? [];
  const states = policy.states ?? [];
  if (captures.length !== 196 || absent.length !== 243 || states.length !== 9 || new Set([...captures, ...absent]).size !== 439) fail("Invalid breadcrumb renderer policy cardinality.");
  if (states.some((state) => digest(JSON.stringify(state.pixels)) !== state.sha256)) fail("Invalid breadcrumb renderer finite state.");
}

function validateRendererRasterizationRegion(region) {
  const spec = rendererRasterizationSpec(region.id);
  if (!spec) fail(`Invalid renderer-rasterization metadata: ${region.id}`);
  if (JSON.stringify(region.captures) !== JSON.stringify(spec.captures)) fail(`Invalid renderer-rasterization capture: ${region.id}`);
  if (region.triggerSelector !== spec.triggerSelector || region.skylineSelector !== spec.skylineSelector) fail(`Invalid renderer-rasterization selector: ${region.id}`);
  if (JSON.stringify(region.environment) !== JSON.stringify(spec.environment)) fail(`Invalid renderer-rasterization environment: ${region.id}`);
  if (JSON.stringify(region.presentation) !== JSON.stringify(spec.presentation)) fail(`Invalid renderer-rasterization presentation: ${region.id}`);
  const complete = region.category === "renderer-rasterization"
    && region.decision === "NW-216"
    && JSON.stringify(region.acceptance) === JSON.stringify(spec.acceptance)
    && JSON.stringify(region.citations) === JSON.stringify(spec.citations)
    && region.measurements && hasExactKeys(region.measurements, spec.captures);
  if (!complete) fail(`Invalid renderer-rasterization metadata: ${region.id}`);
  if (JSON.stringify(region.pixels) !== JSON.stringify(spec.pixels)) {
    const coordinates = Array.isArray(region.pixels) ? region.pixels.map((pixel) => `${pixel?.x},${pixel?.y}`) : [];
    if (!Array.isArray(region.pixels) || region.pixels.length !== spec.pixels.length) fail(`Renderer-rasterization region ${region.id} must contain ${spec.pixels.length} exact pixels.`);
    if (new Set(coordinates).size !== coordinates.length) fail(`Renderer-rasterization region ${region.id} has a duplicate pixel coordinate.`);
    fail(`Renderer-rasterization region ${region.id} changed exact pixel evidence.`);
  }
  if (!isDeepStrictEqual(region.measurements, spec.measurements)) fail(`Invalid renderer-rasterization measurement: ${region.id}`);
  if (!isDeepStrictEqual(region.alternatives ?? [], spec.alternatives ?? [])) fail(`Invalid renderer-rasterization alternatives: ${region.id}`);
}

function rendererRasterizationSpec(id) {
  const selector = ".text-text-dimmed > [translate='no']";
  const environment = { chromiumRevision: "1208", chromiumVersion: "145.0.7632.6", architecture: "x64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" };
  const runtime = { browserVersion: "145.0.7632.6", platform: "Linux x86_64", deviceScaleFactor: 1, locale: "en-US", timezone: "UTC" };
  const originalCitations = [
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-af981c01",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-5f779354",
  ];
  const extensionCitations = [
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6938d6dc",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-9cebc0a5",
  ];
  const finalCitations = [
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-8170f6fc",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-e977cd30",
  ];
  const themeWideCitations = [
    ...finalCitations,
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-47dfd42d",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-6ad5551b",
  ];
  const lightCitations = [
    ...extensionCitations,
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-6b20c68e",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-86de4313",
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-27e039b2",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-721d1ae5",
    ...themeWideCitations,
  ];
  const classicCitations = [
    ...extensionCitations,
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-4d0553c1",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-299d4a96",
    "https://linear.app/nickwelsh/issue/NW-216/replace-skyline-frontend-with-source-faithful-triggerdev-interface#comment-e496a7d3",
    "https://linear.app/nickwelsh/issue/NW-227/complete-the-source-fidelity-oracle#comment-2389e910",
    ...themeWideCitations,
  ];
  const pixels6 = [
    { x: 3, y: 0, trigger: [29, 30, 35, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 3, y: 1, trigger: [33, 34, 38, 255], skyline: [33, 35, 39, 255] },
    { x: 4, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 5, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 2, y: 2, trigger: [31, 33, 37, 255], skyline: [31, 34, 38, 255] },
  ];
  const pixels12 = [
    ...pixels6.slice(0, 2),
    { x: 350, y: 0, trigger: [37, 40, 43, 255], skyline: [37, 40, 44, 255] },
    { x: 352, y: 0, trigger: [29, 30, 34, 255], skyline: [29, 31, 35, 255] },
    ...pixels6.slice(2, 5),
    { x: 350, y: 1, trigger: [26, 27, 32, 255], skyline: [27, 28, 32, 255] },
    { x: 351, y: 1, trigger: [28, 30, 34, 255], skyline: [29, 31, 35, 255] },
    { x: 353, y: 1, trigger: [33, 34, 39, 255], skyline: [33, 35, 39, 255] },
    pixels6[5],
    { x: 353, y: 2, trigger: [32, 33, 38, 255], skyline: [32, 34, 38, 255] },
  ];
  const pixels13 = [
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
  const classicRight6 = [pixels12[2], pixels12[3], pixels12[7], pixels12[8], pixels12[9], pixels12[11]];
  const lightRight6 = [pixels13[2], pixels13[7], pixels13[8], pixels13[9], pixels13[10], pixels13[12]];
  const lightLeft7 = [pixels13[0], pixels13[1], pixels13[3], pixels13[4], pixels13[5], pixels13[6], pixels13[11]];
  const darkPixels13 = [
    { x: 3, y: 0, trigger: [34, 35, 38, 255], skyline: [35, 36, 39, 255] },
    { x: 4, y: 0, trigger: [54, 56, 59, 255], skyline: [55, 57, 60, 255] },
    { x: 5, y: 0, trigger: [63, 66, 69, 255], skyline: [64, 67, 70, 255] },
    { x: 350, y: 0, trigger: [63, 66, 69, 255], skyline: [64, 67, 70, 255] },
    { x: 351, y: 0, trigger: [54, 57, 59, 255], skyline: [54, 57, 60, 255] },
    { x: 2, y: 1, trigger: [47, 49, 52, 255], skyline: [48, 49, 52, 255] },
    { x: 3, y: 1, trigger: [47, 49, 52, 255], skyline: [48, 49, 52, 255] },
    { x: 4, y: 1, trigger: [32, 32, 35, 255], skyline: [31, 32, 35, 255] },
    { x: 5, y: 1, trigger: [22, 22, 26, 255], skyline: [22, 22, 25, 255] },
    { x: 350, y: 1, trigger: [22, 22, 26, 255], skyline: [22, 22, 25, 255] },
    { x: 351, y: 1, trigger: [32, 33, 36, 255], skyline: [32, 32, 35, 255] },
    { x: 353, y: 1, trigger: [46, 48, 51, 255], skyline: [47, 48, 51, 255] },
    { x: 2, y: 2, trigger: [43, 44, 48, 255], skyline: [43, 45, 48, 255] },
  ];
  const darkRight5 = [darkPixels13[3], darkPixels13[4], darkPixels13[9], darkPixels13[10], darkPixels13[11]];
  const darkLeft8 = [darkPixels13[0], darkPixels13[1], darkPixels13[2], darkPixels13[5], darkPixels13[6], darkPixels13[7], darkPixels13[8], darkPixels13[12]];
  const definition = (captures, acceptance, citations, presentation, pixels, measurement) => ({
    id, category: "renderer-rasterization", decision: "NW-216", acceptance, citations, captures, triggerSelector: selector, skylineSelector: selector, environment, presentation, pixels,
    measurements: Object.fromEntries(captures.map((capture) => [capture, structuredClone(measurement)])),
  });
  if (id === "error-codeblock-corner-rasterization") {
    const captures = ["error-found@1024x768-classic"];
    const shared = rendererRasterizationElement(selector, { x: 656, y: 117, width: 356, height: 58 }, "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b", "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2", "206a05c0a410e6f813bf12948198abbb381269566b3f0e98b3d822e5cc599f83", "260e3e345b11618f2b4d6214d5941be3b01ae92dd3596e1efe87db8d707fafd7", "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9");
    const approved = definition(captures, ["Only exact Classic full twelve-pixel, left-edge six-pixel, or right-edge six-pixel antialias states may differ for this exact capture; zero activates no exception and every other pixel and semantic remains exact."], [...originalCitations, ...themeWideCitations], { borderColor: "rgb(39, 42, 46)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(26, 27, 31)", borderRadius: "6px" }, pixels6, rendererRasterizationMeasurement(runtime, shared, "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50", "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a"));
    approved.alternatives = [{ captures, pixels: pixels12, triggerCropSha256: "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6" }, { captures, pixels: classicRight6, triggerCropSha256: "02739f305658911a62964055dc2ba83eeda901548260509bab81c98547231431" }];
    return approved;
  }
  if (id === "error-codeblock-classic-rasterization") {
    const captures = ["error-found@1440x960-classic", "errors-affected-job-types@1440x960-classic", "errors-application-vendor-frames@1440x960-classic", "errors-linked-runs@1440x960-classic", "errors-long-exception@1440x960-classic", "errors-many-occurrences@1440x960-classic", "errors-single-occurrence@1440x960-classic", "errors-stack-expansion@1440x960-classic"];
    const shared = rendererRasterizationElement(selector, { x: 1072, y: 117, width: 356, height: 58 }, "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b", "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9");
    const approved = definition(captures, ["Only exact Classic full twelve-pixel, left-edge six-pixel, or right-edge six-pixel antialias states may differ across these exact captures; zero activates no exception and every other pixel and semantic remains exact."], classicCitations, { borderColor: "rgb(39, 42, 46)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(26, 27, 31)", borderRadius: "6px" }, pixels12, rendererRasterizationMeasurement(runtime, shared, "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6", "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a"));
    approved.alternatives = [{
      captures,
      pixels: pixels6,
      triggerCropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50",
    }, {
      captures,
      pixels: classicRight6,
      triggerCropSha256: "02739f305658911a62964055dc2ba83eeda901548260509bab81c98547231431",
    }];
    return approved;
  }
  if (id === "error-codeblock-classic-right-rasterization") {
    const captures = ["error-stale-refresh@1440x960-classic"];
    const shared = rendererRasterizationElement(selector, { x: 1072, y: 117, width: 356, height: 58 }, "730f822e40fdbd278386e4f32781ff7de75f68a942605e6ab86655fd63d4050b", "3b8a59ed68b9f3faf39427a09b191a6df3175480c1e7b16c8c28d1055282e7b2", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "c238b73d2cd040fce99d83ae5de65e74a4510609ba7ea7d8bea8e9cece2a95d9");
    const approved = definition(captures, ["Only exact Classic full twelve-pixel, left-edge six-pixel, or right-edge six-pixel antialias states may differ for this exact capture; zero activates no exception and every other pixel and semantic remains exact."], themeWideCitations, { borderColor: "rgb(39, 42, 46)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(26, 27, 31)", borderRadius: "6px" }, classicRight6, rendererRasterizationMeasurement(runtime, shared, "02739f305658911a62964055dc2ba83eeda901548260509bab81c98547231431", "a929eccd0a739f0cf38a51b5c81d03da94667f3a0adc8d933d7ec6988accdf2a"));
    approved.alternatives = [{ captures, pixels: pixels12, triggerCropSha256: "21a8f267584a20c1ab9bb8a549d6526589071322912c39fdccd21825ae95e1b6" }, { captures, pixels: pixels6, triggerCropSha256: "f1c943106aa2c310e8fe77343528038df140599313ee0cbb6a9c3dbed723ab50" }];
    return approved;
  }
  if (id === "error-codeblock-light-rasterization") {
    const captures = ["error-found@1440x960-light", "error-found@1440x960-system-light", "errors-affected-job-types@1440x960-light", "errors-application-vendor-frames@1440x960-light", "errors-linked-runs@1440x960-light", "errors-long-exception@1440x960-light", "errors-many-occurrences@1440x960-light", "errors-single-occurrence@1440x960-light", "errors-stack-expansion@1440x960-light"];
    const shared = rendererRasterizationElement(selector, { x: 1072, y: 117, width: 356, height: 58 }, "6a8b83d2e8057045b6e96b0dac9fb7e569da5335379ed5a76f0f0ab01c569939", "ddeafe10e6831ec6dc1e62eab62f16fe3dfe68937cddcbb42c2fa96562d13096", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "ca33753c04b4519449c72aa01b71b3f6b8b2050a5c57ead95a3f5920d45460de");
    const measurement = rendererRasterizationMeasurement(runtime, shared, "93768ec0233ea8b02028b19b7743d1d263219666ef23354eb3407f4c68759fa3", "a73802a7d3ac38e35d1bcd5119025c1818cae3d5dc9fdeafa69253aaa43332a8");
    const approved = definition(captures, ["Only exact Light full thirteen-pixel, right-edge six-pixel, or left-edge seven-pixel antialias states may differ across these exact captures; zero activates no exception and every other pixel and semantic remains exact."], lightCitations, { borderColor: "color(srgb 0.687749 0.693835 0.709051)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(255, 255, 255)", borderRadius: "6px" }, pixels13, measurement);
    approved.alternatives = [{
      captures,
      pixels: lightRight6,
      triggerCropSha256: "be64f3b53c93b4cc7145fb081f717e2b75becf66632a727985b68a57f3537864",
    }, {
      captures,
      pixels: lightLeft7,
      triggerCropSha256: "f5bba6c913b6a01d71f7926ac77447c974b40961a3ac51fb9f27bc979d95f1b5",
    }];
    return approved;
  }
  if (id === "error-codeblock-light-right-rasterization") {
    const captures = ["error-stale-refresh@1440x960-light"];
    const shared = rendererRasterizationElement(selector, { x: 1072, y: 117, width: 356, height: 58 }, "6a8b83d2e8057045b6e96b0dac9fb7e569da5335379ed5a76f0f0ab01c569939", "ddeafe10e6831ec6dc1e62eab62f16fe3dfe68937cddcbb42c2fa96562d13096", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "ca33753c04b4519449c72aa01b71b3f6b8b2050a5c57ead95a3f5920d45460de");
    const approved = definition(captures, ["Only exact Light full thirteen-pixel, right-edge six-pixel, or left-edge seven-pixel antialias states may differ for this exact capture; zero activates no exception and every other pixel and semantic remains exact."], themeWideCitations, { borderColor: "color(srgb 0.687749 0.693835 0.709051)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "rgb(255, 255, 255)", borderRadius: "6px" }, lightRight6, rendererRasterizationMeasurement(runtime, shared, "be64f3b53c93b4cc7145fb081f717e2b75becf66632a727985b68a57f3537864", "a73802a7d3ac38e35d1bcd5119025c1818cae3d5dc9fdeafa69253aaa43332a8"));
    approved.alternatives = [{ captures, pixels: pixels13, triggerCropSha256: "93768ec0233ea8b02028b19b7743d1d263219666ef23354eb3407f4c68759fa3" }, { captures, pixels: lightLeft7, triggerCropSha256: "f5bba6c913b6a01d71f7926ac77447c974b40961a3ac51fb9f27bc979d95f1b5" }];
    return approved;
  }
  if (id === "error-codeblock-dark-rasterization") {
    const captures = ["error-found@1440x960-dark", "error-found@1440x960-system-dark", "errors-affected-job-types@1440x960-dark", "errors-application-vendor-frames@1440x960-dark", "errors-linked-runs@1440x960-dark", "errors-long-exception@1440x960-dark", "errors-many-occurrences@1440x960-dark", "errors-single-occurrence@1440x960-dark", "errors-stack-expansion@1440x960-dark"];
    const shared = rendererRasterizationElement(selector, { x: 1072, y: 117, width: 356, height: 58 }, "1e958c4fe09cb4648dc66fc7033ad54e0390980460e99a0c6fd29b5a4d222986", "878844aaa73ad5cf97576bef440101116d5c846226f1a6e6a94e2ab114debb34", "a17259fef0d18eff5482408204db132d6835237090d5b066b82a122f7a5d7486", "2fc4ed279e404c1b3772ab0601244b73a96b98c99f1533461ffffe223540224f", "df218850753b506666ad2bcaa018b0bd1cf137690bab6b79070a93b80c59b10f");
    const approved = definition(captures, ["Only exact Dark full thirteen-pixel, left-edge eight-pixel, or right-edge five-pixel antialias states may differ across these exact captures; zero activates no exception and every other pixel and semantic remains exact."], themeWideCitations, { borderColor: "color(srgb 0.271529 0.281647 0.295137)", backgroundColor: "rgba(0, 0, 0, 0)", backdropColor: "color(srgb 0.0698431 0.0725294 0.0832745)", borderRadius: "6px" }, darkPixels13, rendererRasterizationMeasurement(runtime, shared, "cc599cedd33e4bc2c41e5055c216ac59f08433a663dd7813ac5d4bf04d43e6f4", "fad6b57ad8b49208f509ecddb3d2a06b014a0be0c8853de81fc3248349b31984"));
    approved.alternatives = [{
      captures,
      pixels: darkRight5,
      triggerCropSha256: "306da89ee227424ffb06634852e7116cb4fee904905ef7ed0305a62eb0df8297",
    }, {
      captures,
      pixels: darkLeft8,
      triggerCropSha256: "e093373e48bc2777d172b84f3f668f3bbbf4bc6c2b8ee2dff89906bc59892a62",
    }];
    return approved;
  }
}

function rendererRasterizationElement(selector, rect, computedStyleSha256, semanticDomSha256, boxModelSha256, quadsSha256, backdropSha256) {
  return { selector, rect, computedStyleSha256, accessibilitySha256: "b6167fd697fd410afc0259efd4e09027849b730af8f4af8af77591758aac8d6b", semanticDomSha256, effectiveCssRulesSha256: "eeedce158bc50c514818266694318ab8eae3d60904294b427103c5bbff3eb901", boxModelSha256, quadsSha256, backdropSha256 };
}

function rendererRasterizationMeasurement(runtime, shared, triggerCropSha256, skylineCropSha256) {
  return {
    runtime,
    trigger: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "8d795f3af25b11056ed60507ccd2c8614e8cc4d469515688018b5b0f9dab47ba", cropSha256: triggerCropSha256 },
    skyline: { ...shared, domSha256: "ca266b76974d08d425effde2f349e65a1b746b43397ee1498696dd53763d640a", cssRulesSha256: "751946618b4985c6a59b86417e539771259f74e794c7e5ad67377c495f9202a4", cropSha256: skylineCropSha256 },
  };
}

function validateBrandingIdentityRegion(region) {
  const expectedAcceptance = [
    "Skyline retains one Application identity while upstream organization/project switching remains unavailable.",
    "Supported Tasks, Runs, Observability, Logs, Errors, and Queues remain pixel-identical after the exact identity-height reflow, with exact per-side style and accessibility evidence.",
  ];
  const identityPairs = [
    { id: "brand", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)", skylineSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(1)" },
    { id: "application", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(2)", skylineSelector: "[data-testid='side-menu-application']" },
  ];
  const navigationSelector = "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) > :first-child";
  const protectedPairs = [
    ...["tasks", "runs", "logs", "errors", "queues"].map((id) => ({ id, triggerSelector: `[data-action='${id}']`, skylineSelector: `[data-action='${id}']` })),
    { id: "observability", triggerSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) button[aria-expanded='true']", skylineSelector: "[role='separator'][aria-label='Resize side menu'] + div > :nth-child(3) button[aria-expanded='true']" },
  ];
  const complete = region.id === "shell-branding-identity" && region.decision === "NW-226"
    && JSON.stringify(region.acceptance) === JSON.stringify(expectedAcceptance)
    && Array.isArray(region.citations) && region.citations.length === 2
    && region.citations[0] === "https://linear.app/nickwelsh/issue/NW-226/complete-shell-capabilities-and-preferences"
    && /^https:\/\/github\.com\/triggerdotdev\/trigger\.dev\/blob\/[a-f0-9]{40}\/apps\/webapp\/app\/components\/navigation\/SideMenu\.tsx#L\d+-L\d+$/.test(region.citations[1] ?? "")
    && Array.isArray(region.captures) && region.captures.length > 0
    && Array.isArray(region.identityPairs) && Array.isArray(region.protectedPairs)
    && region.measurements && typeof region.measurements === "object";
  if (!complete) fail(`Incomplete branding-identity region: ${region.id}`);
  if (!region.captures.every((capture) => typeof capture === "string" && /@\d+x\d+-(?:classic|dark|light|system-(?:dark|light))$/.test(capture)) || new Set(region.captures).size !== region.captures.length) fail(`Invalid branding-identity capture: ${region.id}`);
  if (region.triggerNavigationSelector !== navigationSelector || region.skylineNavigationSelector !== navigationSelector || !samePairDefinitions(region.identityPairs, identityPairs)) fail(`Invalid branding-identity selector: ${region.id}`);
  if (region.protectedPairs.length !== protectedPairs.length || region.protectedPairs.some((pair, index) => {
    const expected = protectedPairs[index];
    return pair.id !== expected.id || pair.triggerSelector !== expected.triggerSelector || pair.skylineSelector !== expected.skylineSelector
      || (pair.captures !== undefined && (!Array.isArray(pair.captures) || pair.captures.length === 0 || new Set(pair.captures).size !== pair.captures.length || pair.captures.some((capture) => !region.captures.includes(capture))));
  })) fail(`Invalid branding-identity protected selector: ${region.id}`);
  if (Object.keys(region.measurements).length !== region.captures.length || region.captures.some((capture) => !region.measurements[capture])) fail(`Missing branding-identity measurement: ${region.id}`);

  for (const capture of region.captures) {
    const measurement = region.measurements[capture];
    const expectedProtected = region.protectedPairs.filter((pair) => !pair.captures || pair.captures.includes(capture));
    if (!measurement || !hasExactKeys(measurement, ["identityPairs", "navigation", "protectedPairs"])
      || !hasExactKeys(measurement.identityPairs, identityPairs.map(({ id }) => id))
      || !hasExactKeys(measurement.protectedPairs, expectedProtected.map(({ id }) => id))
      || !hasExactKeys(measurement.navigation, ["trigger", "skyline"])) fail(`Missing branding-identity measurement: ${region.id}`);
    for (const pair of identityPairs) validateBrandingIdentityPair(region.id, measurement.identityPairs[pair.id]);
    validateBrandingIdentityPair(region.id, measurement.navigation);
    const identityDelta = identityPairs.reduce((total, pair) => total + measurement.identityPairs[pair.id].trigger.rect.height - measurement.identityPairs[pair.id].skyline.rect.height, 0);
    if (measurement.navigation.trigger.rect.x !== measurement.navigation.skyline.rect.x
      || measurement.navigation.trigger.rect.width !== measurement.navigation.skyline.rect.width
      || measurement.navigation.trigger.rect.y - measurement.navigation.skyline.rect.y !== identityDelta) fail(`Invalid branding-identity reflow: ${region.id}`);
    for (const pair of expectedProtected) {
      const evidence = measurement.protectedPairs[pair.id];
      validateBrandingIdentityPair(region.id, evidence);
      if (evidence.trigger.rect.x !== evidence.skyline.rect.x || evidence.trigger.rect.width !== evidence.skyline.rect.width || evidence.trigger.rect.height !== evidence.skyline.rect.height) fail(`Invalid branding-identity protected geometry: ${region.id}`);
      if (evidence.trigger.rect.y - evidence.skyline.rect.y !== identityDelta) fail(`Invalid branding-identity protected reflow: ${region.id}`);
      if (evidence.trigger.computedStyleSha256 !== evidence.skyline.computedStyleSha256) fail(`Invalid branding-identity protected style: ${region.id}`);
      if (evidence.trigger.accessibilitySha256 !== evidence.skyline.accessibilitySha256) fail(`Invalid branding-identity protected accessibility: ${region.id}`);
      if (evidence.trigger.crop.screenshotSha256 !== evidence.skyline.crop.screenshotSha256) fail(`Invalid branding-identity protected pixels: ${region.id}`);
    }
  }
}

function validateBrandingIdentityPair(id, pair) {
  if (!pair || !hasExactKeys(pair, ["trigger", "skyline"])) fail(`Invalid branding-identity measurement: ${id}`);
  validateBrandingIdentityElement(id, pair.trigger);
  validateBrandingIdentityElement(id, pair.skyline);
}

function validateBrandingIdentityElement(id, element) {
  const valid = element && hasExactKeys(element, ["rect", "computedStyleSha256", "accessibilitySha256", "crop"])
    && validPositiveRect(element.rect)
    && /^[a-f0-9]{64}$/.test(element.computedStyleSha256 ?? "")
    && /^[a-f0-9]{64}$/.test(element.accessibilitySha256 ?? "")
    && element.crop?.status === "visible" && hasExactKeys(element.crop, ["status", "rect", "screenshotSha256"])
    && validPositiveRect(element.crop.rect) && JSON.stringify(element.crop.rect) === JSON.stringify(element.rect)
    && /^[a-f0-9]{64}$/.test(element.crop.screenshotSha256 ?? "");
  if (!valid) fail(`Invalid branding-identity measurement: ${id}`);
}

function samePairDefinitions(actual, expected) {
  return actual.length === expected.length && actual.every((pair, index) => hasExactKeys(pair, ["id", "triggerSelector", "skylineSelector"]) && JSON.stringify(pair) === JSON.stringify(expected[index]));
}

function hasExactKeys(value, keys) {
  return value && typeof value === "object" && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validPositiveRect(rect) {
  return hasExactKeys(rect, ["x", "y", "width", "height"]) && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0;
}

export function actionCaptureId(matrix, scenario) {
  const [width, height] = matrix.primary.viewport;
  const theme = matrix.primary.themes[0];
  if (!theme) fail("Oracle matrix primary theme missing.");
  return `${scenario}@${width}x${height}-${theme}`;
}

export function expectedCaptureIds(matrix) {
  const result = new Set();
  const [primaryWidth, primaryHeight] = matrix.primary.viewport;
  const primaryScenarios = [
    ...matrix.roots.flatMap((surface) => matrix.rootStates.map((state) => `${surface}-${state}`)),
    ...matrix.details.flatMap((surface) => matrix.detailStates.map((state) => `${surface}-${state}`)),
    ...Object.entries(matrix.ownedStates).flatMap(([surface, states]) => states.map((state) => `${surface}-${state}`)),
  ];
  for (const scenario of primaryScenarios) for (const theme of matrix.primary.themes) result.add(`${scenario}@${primaryWidth}x${primaryHeight}-${theme}`);
  const core = [
    ...matrix.roots.map((surface) => `${surface}-populated`),
    ...matrix.details.map((surface) => `${surface}-found`),
    ...matrix.core.shellStates.map((state) => `shell-${state}`),
  ];
  for (const [width, height] of matrix.core.viewports) for (const scenario of core) result.add(`${scenario}@${width}x${height}-${matrix.core.theme}`);
  const [systemWidth, systemHeight] = matrix.system.viewport;
  const systemScenarios = matrix.system.states.flatMap((state) => {
    if (state === "populated-roots") return matrix.roots.map((surface) => `${surface}-populated`);
    if (state === "found-details") return matrix.details.map((surface) => `${surface}-found`);
    return [`shell-${state}`];
  });
  for (const scheme of matrix.system.schemes) {
    for (const scenario of systemScenarios) {
      result.add(`${scenario}@${systemWidth}x${systemHeight}-system-${scheme}`);
    }
  }
  return [...result].sort();
}

function enforceArtifacts(root, bundle) {
  const paths = new Set();
  for (const artifact of bundle.artifacts ?? []) {
    if (paths.has(artifact.path)) fail(`Duplicate oracle artifact: ${artifact.path}`);
    paths.add(artifact.path);
    const path = join(root, artifact.path);
    if (!existsSync(path)) fail(`Missing oracle artifact: ${artifact.path}`);
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || digest(readFileSync(path)) !== artifact.sha256) fail(`Oracle artifact hash mismatch: ${artifact.path}`);
  }
  if (bundle.regeneration?.basis !== "upstream-pin" && bundle.regeneration?.basis !== "accepted-difference") fail("Oracle regeneration lacks an accepted basis.");
  enforceOracleDecision(bundle.regeneration?.decision);
}

function enforceOracleDecision(decision) {
  if (decision !== oracleDecision) fail(`Oracle regeneration requires --decision ${oracleDecision}.`);
}

function expectedArtifactDescriptors(capture) {
  const directory = `tests/fidelity/oracle/artifacts/${capture}`;
  return [
    { path: `${directory}/trigger.png`, capture, type: "screenshot", application: "trigger" },
    { path: `${directory}/skyline.png`, capture, type: "screenshot", application: "skyline" },
    { path: `${directory}/comparison.json`, capture, type: "comparison" },
    { path: `${directory}/accessibility.json`, capture, type: "accessibility-tree" },
    { path: `${directory}/interactions.json`, capture, type: "interaction-transcript" },
  ];
}

function expectedActionDescriptor(action) {
  return { path: `tests/fidelity/oracle/actions/${action}.json`, type: "interaction-transcript", action };
}

export function fidelityInputHashes(root = scriptRoot) {
  const paths = {
    environmentSha256: "tests/fidelity/environment.json",
    fixturesSha256: "tests/fidelity/fixtures.json",
    matrixSha256: "tests/fidelity/matrix.json",
    differencesSha256: "tests/fidelity/allowed-differences.json",
    actionsSha256: "tests/fidelity/actions.json",
    nw223EvidenceLedgerSha256: "tests/fidelity/nw223-evidence-ledger.json",
    importManifestSha256: "resources/js/trigger/import-manifest.json",
    referenceManifestSha256: "tests/fidelity/reference-import-manifest.json",
    referenceCapabilitiesSha256: "tests/fidelity/reference-capabilities.json",
    oracleConfigSha256: "playwright.oracle.config.ts",
    globalSetupSha256: "tests/fidelity/global-setup.ts",
    fidelitySpecSha256: "tests/fidelity/fidelity.spec.ts",
    actionsSpecSha256: "tests/fidelity/actions.spec.ts",
    verifierSha256: "scripts/fidelity-oracle.mjs",
    serveFixtureSha256: "scripts/serve-fixture.mjs",
    uiPreferencesPrepaintSha256: "resources/js/skyline/uiPreferencesPrepaint.js",
    referenceImportCheckerSha256: "scripts/import-fidelity-reference.mjs",
    triggerImportCheckerSha256: "scripts/import-trigger.mjs",
    packageSha256: "package.json",
    dockerfileSha256: "tests/fidelity/Dockerfile",
    ciSha256: ".github/workflows/ci.yml",
    fixtureAdapterSha256: "resources/js/skyline/FixtureAdapter.ts",
    fixtureDataSha256: "resources/js/skyline/fixtures.ts",
    dtoSha256: "resources/js/skyline/dto.ts",
    lockfileSha256: "pnpm-lock.yaml",
  };
  return {
    ...Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, digest(readFileSync(join(root, path)))])),
    skylineDistSha256: treeDigest(join(root, "dist")),
    referenceDistSha256: treeDigest(join(root, "tests/fidelity/reference/dist")),
    fidelitySupportSha256: treeDigest(join(root, "tests/fidelity/support")),
    referenceHostSha256: treeDigest(join(root, "tests/fidelity/reference"), (path) => !path.includes("/dist/") && !path.includes("/vendor/")),
  };
}

function treeDigest(directory, include = () => true) {
  if (!existsSync(directory)) fail(`Oracle input directory missing: ${relative(scriptRoot, directory)}`);
  const entries = [];
  const visit = (path) => {
    for (const name of readdirSync(path).sort()) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) visit(child);
      else if (include(child)) entries.push(`${relative(directory, child)}\0${digest(readFileSync(child))}`);
    }
  };
  visit(directory);
  return digest(entries.join("\n"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--record")) {
    const decisionIndex = process.argv.indexOf("--decision");
    const result = recordFidelityBundle(scriptRoot, decisionIndex >= 0 ? process.argv[decisionIndex + 1] : undefined);
    process.stdout.write(`Recorded ${result.artifacts.length} fidelity artifacts.\n`);
  } else {
    const result = verifyFidelityBundle(scriptRoot);
    process.stdout.write(`Verified ${result.artifacts} fidelity artifacts for ${result.triggerCommit}.\n`);
  }
}
