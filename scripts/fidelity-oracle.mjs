import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { throw new Error(message); };

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
  if (!/^NW-\d+$/.test(decision ?? "")) fail("Oracle recording requires --decision NW-<id>.");
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
  const accepted = new Set(["branding-terminology", "equivalent-fixture-data", "capability-omission", "react-router-url", "invisible-integration", "framework-extension", "presenter-extension"]);
  if (differences.decision !== "NW-216") fail("Allowed-difference manifest lacks its accepted decision.");
  for (const category of differences.categories ?? []) if (!accepted.has(category)) fail(`Unclassified allowed-difference category: ${category}`);
  const lockedRegions = [];
  for (const region of differences.regions ?? []) {
    if (!accepted.has(region.category)) fail(`Unclassified allowed-difference region: ${region.id}`);
    if (region.category === "framework-extension") {
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
        && region.skylineAccessibleRole && typeof region.skylineAccessibleName === "string" && region.anchorAccessibleRole && region.anchorAccessibleName
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
      if (new Set(pairIds).size !== pairIds.length || new Set(pairSelectors).size !== pairSelectors.length || region.selectorPairs.some((pair) => !pair.id || !pair.triggerSelector || !pair.skylineSelector)) fail(`Invalid capability-omission selector pair: ${region.id}`);
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
      lockedRegions.push(region);
    } else if (!region.triggerSelector || !region.skylineSelector || !region.accessibleName || !region.decision) fail(`Incomplete allowed-difference region: ${region.id}`);
  }
  const captureOwners = new Map();
  const selectorOwners = new Map();
  for (const region of lockedRegions) {
    for (const capture of region.captures) {
      const ownership = region.category === "capability-omission" ? "capability-omission" : "extension";
      const key = `${ownership}:${capture}`;
      const owner = captureOwners.get(key);
      if (owner) fail(`Locked regions ${owner} and ${region.id} overlap capture ${capture}.`);
      captureOwners.set(key, region.id);
    }
    const selectors = region.category === "presenter-extension"
      ? [region.triggerSelector, region.skylineSelector, region.triggerAnchorSelector, region.skylineAnchorSelector]
      : region.category === "framework-extension"
        ? [region.skylineSelector, region.triggerAnchorSelector, region.skylineAnchorSelector]
        : region.selectorPairs.flatMap((pair) => [pair.triggerSelector, pair.skylineSelector]);
    for (const selector of new Set(selectors)) {
      const owners = selectorOwners.get(selector) ?? [];
      for (const owner of owners) {
        const disjointCapabilityCaptures = owner.category === "capability-omission" && region.category === "capability-omission"
          && !owner.captures.some((capture) => region.captures.includes(capture));
        if (!disjointCapabilityCaptures) fail(`Locked regions ${owner.id} and ${region.id} collide on selector ${selector}.`);
      }
      owners.push(region);
      selectorOwners.set(selector, owners);
    }
  }
}

export function expectedCaptureIds(matrix) {
  const result = new Set();
  const primaryScenarios = [
    ...matrix.roots.flatMap((surface) => matrix.rootStates.map((state) => `${surface}-${state}`)),
    ...matrix.details.flatMap((surface) => matrix.detailStates.map((state) => `${surface}-${state}`)),
    ...Object.entries(matrix.ownedStates).flatMap(([surface, states]) => states.map((state) => `${surface}-${state}`)),
  ];
  for (const scenario of primaryScenarios) for (const theme of matrix.primary.themes) result.add(`${scenario}@1440x960-${theme}`);
  const core = [
    ...matrix.roots.map((surface) => `${surface}-populated`),
    ...matrix.details.map((surface) => `${surface}-found`),
    ...matrix.core.shellStates.map((state) => `shell-${state}`),
  ];
  for (const [width, height] of matrix.core.viewports) for (const scenario of core) result.add(`${scenario}@${width}x${height}-classic`);
  for (const scheme of matrix.system.schemes) {
    for (const scenario of [...matrix.roots.map((surface) => `${surface}-populated`), ...matrix.details.map((surface) => `${surface}-found`), "shell-appearance", "shell-live-change"]) {
      result.add(`${scenario}@1440x960-system-${scheme}`);
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
  if (bundle.regeneration?.decision !== "NW-216") fail("Oracle regeneration lacks an accepted decision.");
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
