import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { verifyFidelityBundle } from "./fidelity-oracle.mjs";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { throw new Error(message); };

export function assembleFidelityHandoff(bundle, differences, bundleBytes, assemblerBytes, decision) {
  if (decision !== "NW-228") fail("Fidelity handoff requires accepted decision NW-228.");
  if (bundle?.schemaVersion !== 1) fail("Fidelity handoff bundle schema drifted.");
  if (differences?.decision !== "NW-216" || !Array.isArray(differences.regions)) fail("Fidelity handoff allowed differences drifted.");
  if (!/^[a-f0-9]{64}$/.test(bundle.inputs?.differencesSha256 ?? "")) fail("Fidelity handoff difference hash drifted.");
  if (!Array.isArray(bundle.captures) || !Array.isArray(bundle.artifacts)) fail("Fidelity handoff proof counts drifted.");

  const artifactTypes = Object.fromEntries(
    [...new Set(bundle.artifacts.map(({ type }) => type))]
      .sort()
      .map((type) => [type, bundle.artifacts.filter((artifact) => artifact.type === type).length]),
  );

  return {
    schemaVersion: 1,
    spec: "NW-216",
    decision,
    assemblerSha256: digest(assemblerBytes),
    oracle: {
      bundleSha256: digest(bundleBytes),
      triggerCommit: bundle.environment?.triggerCommit,
      fixtureVersion: bundle.environment?.fixtureVersion,
      chromiumRevision: bundle.environment?.chromiumRevision,
      regeneration: bundle.regeneration,
      captures: bundle.captures.length,
      artifacts: bundle.artifacts.length,
      artifactTypes,
    },
    allowedDifferences: {
      sha256: bundle.inputs.differencesSha256,
      decision: differences.decision,
      regions: differences.regions.map(({ id, category, decision: regionDecision }) => ({ id, category, decision: regionDecision })),
    },
  };
}

export function validateFidelityHandoffEnvelope(bundle, differences, bundleBytes, assemblerBytes, handoff) {
  const expected = assembleFidelityHandoff(bundle, differences, bundleBytes, assemblerBytes, handoff?.decision);
  if (!isDeepStrictEqual(handoff, expected)) fail("Fidelity handoff drifted from verified oracle evidence.");
}

export function verifyFidelityHandoff(root = scriptRoot) {
  const paths = handoffPaths(root);
  if (!existsSync(paths.bundle)) fail("Missing verified oracle bundle: tests/fidelity/oracle/bundle.json.");
  verifyFidelityBundle(root);
  if (!existsSync(paths.handoff)) fail("Missing source-fidelity handoff artifact.");
  const bundleBytes = readFileSync(paths.bundle);
  const assemblerBytes = readFileSync(paths.assembler);
  const handoff = readJson(paths.handoff);
  validateFidelityHandoffEnvelope(readJson(paths.bundle), readJson(paths.differences), bundleBytes, assemblerBytes, handoff);
  return handoff;
}

export function recordFidelityHandoff(root = scriptRoot, decision) {
  const paths = handoffPaths(root);
  if (!existsSync(paths.bundle)) fail("Missing verified oracle bundle: tests/fidelity/oracle/bundle.json.");
  verifyFidelityBundle(root);
  const bundleBytes = readFileSync(paths.bundle);
  const assemblerBytes = readFileSync(paths.assembler);
  const handoff = assembleFidelityHandoff(readJson(paths.bundle), readJson(paths.differences), bundleBytes, assemblerBytes, decision);
  writeFileSync(paths.handoff, `${JSON.stringify(handoff, null, 2)}\n`);
  return handoff;
}

function handoffPaths(root) {
  return {
    bundle: join(root, "tests/fidelity/oracle/bundle.json"),
    differences: join(root, "tests/fidelity/allowed-differences.json"),
    handoff: join(root, "tests/fidelity/handoff.json"),
    assembler: fileURLToPath(import.meta.url),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--record")) {
    const decisionIndex = process.argv.indexOf("--decision");
    const result = recordFidelityHandoff(scriptRoot, decisionIndex >= 0 ? process.argv[decisionIndex + 1] : undefined);
    process.stdout.write(`Recorded fidelity handoff ${result.decision}.\n`);
  } else {
    const result = verifyFidelityHandoff(scriptRoot);
    process.stdout.write(`Verified fidelity handoff ${result.decision} for ${result.oracle.triggerCommit}.\n`);
  }
}
