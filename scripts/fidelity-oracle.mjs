import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const bundle = readJson(join(fidelity, "oracle/bundle.json"));

  enforceEnvironment(root, environment, fixtures, fixturesPath);
  validateAllowedDifferences(differences);
  enforceMatrix(matrix, bundle);
  enforceArtifacts(root, bundle);

  return {
    fixtureVersion: environment.fixtureVersion,
    triggerCommit: environment.triggerCommit,
    chromiumRevision: environment.chromiumRevision,
    artifacts: bundle.artifacts.length,
  };
}

function enforceEnvironment(root, environment, fixtures, fixturesPath) {
  const expected = {
    triggerCommit: "ca9a74e84abdf9483c234e82dc54b9ec2c00d8c0",
    playwrightVersion: "1.58.2",
    chromiumRevision: "1208",
    chromiumVersion: "145.0.7632.6",
    linuxImage: "mcr.microsoft.com/playwright:v1.58.2-noble@sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d",
    nodeVersion: "24.18.0",
    pnpmVersion: "10.33.2",
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
  const accepted = new Set(["branding-terminology", "equivalent-fixture-data", "capability-omission", "react-router-url", "invisible-integration"]);
  if (differences.decision !== "NW-216") fail("Allowed-difference manifest lacks its accepted decision.");
  for (const category of differences.categories ?? []) if (!accepted.has(category)) fail(`Unclassified allowed-difference category: ${category}`);
  for (const region of differences.regions ?? []) {
    if (!accepted.has(region.category)) fail(`Unclassified allowed-difference region: ${region.id}`);
    if (!region.triggerSelector || !region.skylineSelector || !region.accessibleName || !region.decision) fail(`Incomplete allowed-difference region: ${region.id}`);
  }
}

function enforceMatrix(matrix, bundle) {
  const required = new Set(expectedCaptureIds(matrix));
  const actual = new Set(bundle.captures ?? []);
  for (const capture of required) if (!actual.has(capture)) fail(`Missing oracle capture: ${capture}`);
  for (const capture of actual) if (!required.has(capture)) fail(`Unclassified oracle capture: ${capture}`);
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
  const expectedTypes = new Set(["screenshot", "accessibility-tree", "interaction-transcript", "comparison"]);
  for (const capture of bundle.captures ?? []) {
    for (const type of expectedTypes) {
      if (!(bundle.artifacts ?? []).some((artifact) => artifact.capture === capture && artifact.type === type)) fail(`Missing ${type} artifact for ${capture}`);
    }
  }
  if (bundle.regeneration?.basis !== "upstream-pin" && bundle.regeneration?.basis !== "accepted-difference") fail("Oracle regeneration lacks an accepted basis.");
  if (bundle.regeneration?.decision !== "NW-216") fail("Oracle regeneration lacks an accepted decision.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyFidelityBundle(scriptRoot);
  process.stdout.write(`Verified ${result.artifacts} fidelity artifacts for ${result.triggerCommit}.\n`);
}
